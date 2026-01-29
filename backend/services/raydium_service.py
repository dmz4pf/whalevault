"""
Raydium Swap API Service for WhaleVault Private Swap (Devnet).
Handles quote fetching and swap transaction building for devnet pools.
Mirrors JupiterService architecture for consistency.
"""

import base64
from dataclasses import dataclass
from typing import Optional

import httpx
from solders.pubkey import Pubkey

from config import get_settings

# Raydium devnet Trade API
RAYDIUM_DEVNET_API = "https://transaction-v1-devnet.raydium.io"

# SPL Token program IDs for ATA derivation
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")


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
    """

    def __init__(self):
        self.api_url = RAYDIUM_DEVNET_API

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
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.api_url}/compute/swap-base-in",
                params={
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": str(amount_lamports),
                    "slippageBps": str(slippage_bps),
                    "txVersion": "V0",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        if not data.get("success") or not data.get("data"):
            raise RuntimeError(data.get("msg", "Raydium quote failed - no route found"))

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
        recipient_public_key: str,
    ) -> bytes:
        """
        Get a serialized swap transaction from Raydium.

        PRIVACY FEATURE: The wallet signs the transaction, but output tokens
        go to the recipient's ATA. This allows the relayer to sign swaps
        where tokens land in a user's fresh wallet.

        Args:
            quote: RaydiumQuoteResponse from get_quote
            wallet_public_key: Solana public key of the signer (relayer)
            recipient_public_key: Solana public key of token recipient

        Returns:
            Raw transaction bytes (base64-decoded)
        """
        # Derive recipient's ATA for output token
        output_account = self._derive_ata(recipient_public_key, quote.output_mint)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.api_url}/transaction/swap-base-in",
                json={
                    "computeUnitPriceMicroLamports": "1000",
                    "swapResponse": quote.raw,
                    "wallet": wallet_public_key,
                    "txVersion": "V0",
                    "wrapSol": True,
                    "unwrapSol": False,  # Keep as token, send to recipient's ATA
                    "outputAccount": output_account,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        if not data.get("success") or not data.get("data"):
            raise RuntimeError(data.get("msg", "Failed to build Raydium swap transaction"))

        return base64.b64decode(data["data"][0]["transaction"])


# Singleton instance
_raydium_service: Optional[RaydiumService] = None


def get_raydium_service() -> RaydiumService:
    """Get the singleton Raydium service instance."""
    global _raydium_service
    if _raydium_service is None:
        _raydium_service = RaydiumService()
    return _raydium_service
