"""
Jupiter Swap API Service for WhaleVault Private Swap.
Handles quote fetching, swap transaction building, and token list caching.
"""

import base64
import time
from dataclasses import dataclass
from typing import Optional

import httpx

from config import get_settings


@dataclass
class QuoteResponse:
    """Result of a Jupiter quote request."""
    input_mint: str
    output_mint: str
    in_amount: str
    out_amount: str
    other_amount_threshold: str
    price_impact_pct: str
    slippage_bps: int
    raw: dict  # Full response for passing to /swap


@dataclass
class TokenInfo:
    """Jupiter token metadata."""
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: Optional[str] = None


class JupiterService:
    """
    Service for interacting with Jupiter Swap API.

    Provides:
    1. Quote fetching for token swaps
    2. Swap transaction building
    3. Token list with caching
    """

    def __init__(self):
        settings = get_settings()
        self.api_url = settings.jupiter_api_url
        self._token_cache: list[TokenInfo] = []
        self._token_cache_time: float = 0
        self._cache_ttl: float = 300  # 5 minutes

    async def get_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount_lamports: int,
        slippage_bps: int = 100,
    ) -> QuoteResponse:
        """
        Fetch a swap quote from Jupiter.

        Args:
            input_mint: Input token mint address
            output_mint: Output token mint address
            amount_lamports: Amount in smallest unit of input token
            slippage_bps: Slippage tolerance in basis points (default 1%)

        Returns:
            QuoteResponse with pricing and route info
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.api_url}/quote",
                params={
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": str(amount_lamports),
                    "slippageBps": slippage_bps,
                    "restrictIntermediateTokens": "true",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        return QuoteResponse(
            input_mint=data["inputMint"],
            output_mint=data["outputMint"],
            in_amount=data["inAmount"],
            out_amount=data["outAmount"],
            other_amount_threshold=data["otherAmountThreshold"],
            price_impact_pct=data.get("priceImpactPct", "0"),
            slippage_bps=data["slippageBps"],
            raw=data,
        )

    async def get_swap_transaction(
        self, quote: QuoteResponse, user_public_key: str
    ) -> bytes:
        """
        Get a serialized swap transaction from Jupiter.

        Args:
            quote: QuoteResponse from get_quote (raw field is passed through)
            user_public_key: Solana public key of the swapper

        Returns:
            Raw transaction bytes (base64-decoded)

        Raises:
            RuntimeError: If Jupiter simulation fails
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.api_url}/swap",
                json={
                    "quoteResponse": quote.raw,
                    "userPublicKey": user_public_key,
                    "wrapAndUnwrapSol": True,
                    "dynamicComputeUnitLimit": True,
                    "dynamicSlippage": True,
                    "prioritizationFeeLamports": {
                        "priorityLevelWithMaxLamports": {
                            "maxLamports": 1_000_000,
                            "priorityLevel": "veryHigh",
                        }
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("simulationError"):
            raise RuntimeError(f"Swap simulation failed: {data['simulationError']}")

        return base64.b64decode(data["swapTransaction"])

    async def get_token_list(self) -> list[TokenInfo]:
        """
        Get tradeable token list from Jupiter (cached 5 min).

        Returns:
            List of TokenInfo with address, symbol, name, decimals
        """
        now = time.time()
        if self._token_cache and (now - self._token_cache_time) < self._cache_ttl:
            return self._token_cache

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get("https://token.jup.ag/strict")
            resp.raise_for_status()
            tokens = resp.json()

        self._token_cache = [
            TokenInfo(
                address=t["address"],
                symbol=t["symbol"],
                name=t["name"],
                decimals=t["decimals"],
                logo_uri=t.get("logoURI"),
            )
            for t in tokens
        ]
        self._token_cache_time = now
        return self._token_cache


# Singleton instance
_jupiter_service: Optional[JupiterService] = None


def get_jupiter_service() -> JupiterService:
    """Get the singleton Jupiter service instance."""
    global _jupiter_service
    if _jupiter_service is None:
        _jupiter_service = JupiterService()
    return _jupiter_service
