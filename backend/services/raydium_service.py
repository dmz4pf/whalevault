"""
Raydium Swap API Service for WhaleVault Private Swap (Devnet).
Handles quote fetching and swap transaction building for devnet pools.
Mirrors JupiterService architecture for consistency.
"""

import asyncio
import base64
import logging
import ssl
from dataclasses import dataclass
from typing import Optional

import httpx
from solders.pubkey import Pubkey

from config import get_settings

logger = logging.getLogger(__name__)

# Raydium devnet APIs
RAYDIUM_DEVNET_API = "https://transaction-v1-devnet.raydium.io"
RAYDIUM_DEVNET_POOLS_API = "https://api-v3-devnet.raydium.io"

# Native SOL mint
SOL_MINT = "So11111111111111111111111111111111111111112"

# SPL Token program IDs for ATA derivation
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

# Retry configuration for transient network failures
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 1.0
RETRY_BACKOFF_MULTIPLIER = 2.0

# Errors that are safe to retry (transient network issues)
RETRYABLE_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    ssl.SSLError,
)


class RaydiumAPIError(Exception):
    """
    Custom exception for Raydium API failures.

    Distinguishes between:
    - Transient network errors (retryable)
    - API errors (quote not found, invalid params)
    - Rate limiting
    """
    def __init__(self, message: str, is_transient: bool = False, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.is_transient = is_transient
        self.status_code = status_code


@dataclass
class RaydiumTokenInfo:
    """Token information from Raydium pools."""
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: Optional[str] = None


@dataclass
class RaydiumQuoteResponse:
    """Result of a Raydium quote request."""
    input_mint: str
    output_mint: str
    in_amount: str
    out_amount: str
    other_amount_threshold: str
    price_impact_pct: str
    slippage_bps: int
    raw: dict  # Full response for passing to /transaction/swap-base-in


class RaydiumService:
    """
    Service for interacting with Raydium Swap API (Devnet).

    Provides:
    1. Quote fetching for token swaps
    2. Swap transaction building with custom output account (for privacy)

    Features:
    - Automatic retry with exponential backoff for transient network errors
    - Proper error classification (transient vs permanent)
    - Connection pooling via shared httpx client
    """

    def __init__(self):
        self.api_url = RAYDIUM_DEVNET_API
        self.pools_api_url = RAYDIUM_DEVNET_POOLS_API
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """
        Get or create a shared httpx client with connection pooling.

        Using a shared client reduces SSL handshake failures by reusing
        established connections.

        Note: Uses a custom SSL context with lowered security level for
        Python 3.14 compatibility with Raydium's SSL configuration.
        """
        if self._client is None or self._client.is_closed:
            # Create SSL context with relaxed security for Python 3.14 compatibility
            # The default SECLEVEL=2 in Python 3.14 is too strict for some APIs
            ssl_context = ssl.create_default_context()
            ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')

            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(30.0, connect=10.0),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
                verify=ssl_context,
            )
        return self._client

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        max_retries: int = MAX_RETRIES,
        **kwargs,
    ) -> httpx.Response:
        """
        Make an HTTP request with automatic retry for transient errors.

        Args:
            method: HTTP method ('GET' or 'POST')
            url: Full URL to request
            max_retries: Maximum number of retry attempts
            **kwargs: Additional arguments passed to httpx

        Returns:
            httpx.Response on success

        Raises:
            RaydiumAPIError: On failure after all retries
        """
        client = await self._get_client()
        last_error: Optional[Exception] = None
        delay = RETRY_DELAY_SECONDS

        for attempt in range(max_retries + 1):
            try:
                if method.upper() == 'GET':
                    resp = await client.get(url, **kwargs)
                else:
                    resp = await client.post(url, **kwargs)

                # Check for HTTP errors
                if resp.status_code >= 500:
                    # Server error - retry
                    raise httpx.HTTPStatusError(
                        f"Server error: {resp.status_code}",
                        request=resp.request,
                        response=resp,
                    )
                elif resp.status_code == 429:
                    # Rate limited - retry with longer delay
                    logger.warning(f"Raydium rate limited, attempt {attempt + 1}/{max_retries + 1}")
                    delay = delay * 2  # Double delay for rate limits
                    raise httpx.HTTPStatusError(
                        "Rate limited",
                        request=resp.request,
                        response=resp,
                    )
                elif resp.status_code >= 400:
                    # Client error - don't retry
                    raise RaydiumAPIError(
                        f"Raydium API error: {resp.status_code} - {resp.text}",
                        is_transient=False,
                        status_code=resp.status_code,
                    )

                return resp

            except RETRYABLE_EXCEPTIONS as e:
                last_error = e
                if attempt < max_retries:
                    logger.warning(
                        f"Raydium request failed (attempt {attempt + 1}/{max_retries + 1}): "
                        f"{type(e).__name__}: {e}. Retrying in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                    delay *= RETRY_BACKOFF_MULTIPLIER
                else:
                    logger.error(f"Raydium request failed after {max_retries + 1} attempts: {e}")

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code >= 500 or e.response.status_code == 429:
                    if attempt < max_retries:
                        logger.warning(
                            f"Raydium server error (attempt {attempt + 1}/{max_retries + 1}): "
                            f"{e}. Retrying in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                        delay *= RETRY_BACKOFF_MULTIPLIER
                    else:
                        logger.error(f"Raydium server error after {max_retries + 1} attempts: {e}")
                else:
                    # Non-retryable HTTP error
                    raise RaydiumAPIError(
                        f"Raydium API error: {e.response.status_code}",
                        is_transient=False,
                        status_code=e.response.status_code,
                    )

        # All retries exhausted
        error_msg = f"Raydium API unavailable after {max_retries + 1} attempts"
        if last_error:
            error_msg += f": {type(last_error).__name__}: {last_error}"

        raise RaydiumAPIError(error_msg, is_transient=True, status_code=503)

    async def close(self):
        """Close the HTTP client and release connections."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _derive_ata(self, owner: str, mint: str) -> str:
        """
        Derive Associated Token Account address.

        Args:
            owner: Owner wallet public key
            mint: Token mint address

        Returns:
            ATA address as string
        """
        owner_pubkey = Pubkey.from_string(owner)
        mint_pubkey = Pubkey.from_string(mint)

        # ATA derivation: seeds = [owner, TOKEN_PROGRAM_ID, mint]
        ata, _ = Pubkey.find_program_address(
            [bytes(owner_pubkey), bytes(TOKEN_PROGRAM_ID), bytes(mint_pubkey)],
            ASSOCIATED_TOKEN_PROGRAM_ID,
        )
        return str(ata)

    async def get_token_list(self) -> list[RaydiumTokenInfo]:
        """
        Fetch list of tokens available for swapping on Raydium devnet.
        Returns tokens that have pools paired with SOL.

        Returns:
            List of RaydiumTokenInfo objects

        Raises:
            RaydiumAPIError: On API failure after retries
        """
        resp = await self._request_with_retry(
            'GET',
            f"{self.pools_api_url}/pools/info/mint",
            params={
                "mint1": SOL_MINT,
                "poolType": "all",
                "poolSortField": "liquidity",
                "sortType": "desc",
                "pageSize": "100",
                "page": "1",
            },
        )
        data = resp.json()

        pools = data.get("data", {}).get("data", [])
        seen: set[str] = set()
        tokens: list[RaydiumTokenInfo] = []

        for pool in pools:
            # Get the token that's not SOL
            mint_a = pool.get("mintA", {})
            mint_b = pool.get("mintB", {})
            other = mint_b if mint_a.get("address") == SOL_MINT else mint_a

            address = other.get("address", "")
            symbol = other.get("symbol", "")

            # Skip SOL, duplicates, and tokens without symbols
            if not address or not symbol or address == SOL_MINT or address in seen:
                continue

            seen.add(address)
            tokens.append(RaydiumTokenInfo(
                address=address,
                symbol=symbol,
                name=other.get("name", symbol),
                decimals=other.get("decimals", 9),
                logo_uri=other.get("logoURI"),
            ))

        return tokens

    async def get_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount_lamports: int,
        slippage_bps: int = 100,
    ) -> RaydiumQuoteResponse:
        """
        Fetch a swap quote from Raydium devnet.

        Args:
            input_mint: Input token mint address
            output_mint: Output token mint address
            amount_lamports: Amount in smallest unit of input token
            slippage_bps: Slippage tolerance in basis points (default 1%)

        Returns:
            RaydiumQuoteResponse with pricing and route info

        Raises:
            RaydiumAPIError: On API failure after retries or no route found
        """
        resp = await self._request_with_retry(
            'GET',
            f"{self.api_url}/compute/swap-base-in",
            params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": str(amount_lamports),
                "slippageBps": str(slippage_bps),
                "txVersion": "V0",
            },
        )
        data = resp.json()

        if not data.get("success") or not data.get("data"):
            error_msg = data.get("msg", "Raydium quote failed - no route found")
            raise RaydiumAPIError(error_msg, is_transient=False, status_code=400)

        quote_data = data["data"]
        return RaydiumQuoteResponse(
            input_mint=quote_data["inputMint"],
            output_mint=quote_data["outputMint"],
            in_amount=quote_data["inputAmount"],
            out_amount=quote_data["outputAmount"],
            other_amount_threshold=quote_data["otherAmountThreshold"],
            price_impact_pct=str(quote_data.get("priceImpactPct", "0")),
            slippage_bps=quote_data["slippageBps"],
            raw=data,  # Full response including id, success, version, data
        )

    async def get_swap_transaction(
        self,
        quote: RaydiumQuoteResponse,
        wallet_public_key: str,
    ) -> bytes:
        """
        Get a serialized swap transaction from Raydium.

        Tokens go to the wallet's (signer's) ATA. Raydium requires outputAccount
        to be owned by the signer, so we cannot route directly to a recipient.
        Use a separate transfer transaction to send tokens to the recipient.

        Args:
            quote: RaydiumQuoteResponse from get_quote
            wallet_public_key: Solana public key of the signer (relayer)

        Returns:
            Raw transaction bytes (base64-decoded)

        Raises:
            RaydiumAPIError: On API failure after retries
        """
        resp = await self._request_with_retry(
            'POST',
            f"{self.api_url}/transaction/swap-base-in",
            json={
                "computeUnitPriceMicroLamports": "1000",
                "swapResponse": quote.raw,
                "wallet": wallet_public_key,
                "txVersion": "V0",
                "wrapSol": True,
                "unwrapSol": False,
            },
        )
        data = resp.json()

        if not data.get("success") or not data.get("data"):
            error_msg = data.get("msg", "Failed to build Raydium swap transaction")
            raise RaydiumAPIError(error_msg, is_transient=False, status_code=400)

        return base64.b64decode(data["data"][0]["transaction"])


# Singleton instance
_raydium_service: Optional[RaydiumService] = None


def get_raydium_service() -> RaydiumService:
    """Get the singleton Raydium service instance."""
    global _raydium_service
    if _raydium_service is None:
        _raydium_service = RaydiumService()
    return _raydium_service
