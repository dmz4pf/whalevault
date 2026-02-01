"""
Relayer Service - Signs and submits transactions on behalf of users.

This provides true privacy by breaking the link between the user's wallet
and the withdrawal recipient.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from solders.keypair import Keypair
from solders.pubkey import Pubkey
from veil.solana_client import SolanaClient

from config import get_settings
from utils.errors import RelayerError


@dataclass
class RelayResult:
    """Result of a relay operation."""
    signature: str
    fee_paid: int  # lamports
    amount_sent: int  # lamports (after fee)
    recipient: str


class RelayerService:
    """
    Service for relaying transactions on behalf of users.

    The relayer:
    1. Holds a funded keypair
    2. Signs unshield transactions for users
    3. Submits to Solana
    4. Takes a fee from the withdrawal amount
    """

    def __init__(self):
        settings = get_settings()
        self.fee_bps = settings.relayer_fee_bps
        self.enabled = settings.relayer_enabled
        self._keypair: Optional[Keypair] = None
        self._keypair_path = settings.relayer_keypair_path
        self._solana_client: Optional[SolanaClient] = None
        self._rpc_url = settings.solana_rpc_url
        self._program_id = settings.program_id

    def _load_keypair(self) -> Keypair:
        """Load the relayer keypair from env var or file."""
        if self._keypair is not None:
            return self._keypair

        # First try env var (for Railway/production)
        keypair_json = os.environ.get("RELAYER_KEYPAIR_JSON")
        if keypair_json:
            keypair_bytes = bytes(json.loads(keypair_json))
            self._keypair = Keypair.from_bytes(keypair_bytes)
            return self._keypair

        # Fall back to file (for local dev)
        keypair_path = Path(self._keypair_path)
        if not keypair_path.exists():
            raise RelayerError(
                "Relayer keypair not found",
                details={"path": str(keypair_path)}
            )

        with open(keypair_path, "r") as f:
            keypair_bytes = bytes(json.load(f))

        self._keypair = Keypair.from_bytes(keypair_bytes)
        return self._keypair

    def _get_solana_client(self) -> SolanaClient:
        """Get or create Solana client."""
        if self._solana_client is None:
            self._solana_client = SolanaClient(
                rpc_url=self._rpc_url,
                program_id=self._program_id,
            )
        return self._solana_client

    @property
    def public_key(self) -> str:
        """Get the relayer's public key."""
        return str(self._load_keypair().pubkey())

    def calculate_fee(self, amount: int) -> int:
        """
        Calculate the relayer fee for a given amount.

        Args:
            amount: Amount in lamports

        Returns:
            Fee in lamports
        """
        fee = (amount * self.fee_bps) // 10000
        # Minimum fee to cover gas (~5000 lamports)
        return max(fee, 5000)

    def calculate_amount_after_fee(self, amount: int) -> int:
        """
        Calculate the amount recipient receives after fee deduction.

        Args:
            amount: Original amount in lamports

        Returns:
            Amount after fee in lamports
        """
        fee = self.calculate_fee(amount)
        return amount - fee

    async def relay_unshield(
        self,
        nullifier: bytes,
        recipient: str,
        amount: int,
        proof: bytes,
        denomination: int = 0,
    ) -> RelayResult:
        """
        Relay an unshield transaction.

        The relayer signs and submits the transaction, taking a fee.

        Args:
            nullifier: Nullifier bytes (32 bytes)
            recipient: Recipient Solana address
            amount: Full amount in lamports
            proof: ZK proof bytes

        Returns:
            RelayResult with signature and fee info
        """
        if not self.enabled:
            raise RelayerError("Relayer is disabled")

        # Validate inputs
        if len(nullifier) != 32:
            raise RelayerError("Invalid nullifier length", details={"length": len(nullifier)})

        print(f"[Relayer] Validating recipient: '{recipient}' (len={len(recipient)})")
        try:
            Pubkey.from_string(recipient)
        except Exception as e:
            print(f"[Relayer] Invalid recipient: {e}")
            raise RelayerError(f"Invalid recipient address: {recipient}", details={"recipient": recipient, "error": str(e)})

        # Calculate fee
        fee = self.calculate_fee(amount)
        amount_after_fee = amount - fee

        # Get keypair and client
        keypair = self._load_keypair()
        client = self._get_solana_client()

        # Submit transaction
        # Note: For MVP, we send full amount. Fee tracking is off-chain.
        # In production, modify program to split: (amount - fee) to recipient, fee to relayer
        try:
            signature = await client.submit_unshield_transaction(
                nullifier=nullifier,
                destination=recipient,
                amount=amount,  # Full amount for now
                proof=proof,
                payer_keypair=bytes(keypair),
                token="SOL",
                denomination=denomination,
            )
        except Exception as e:
            import traceback
            print(f"[Relayer] Transaction failed: {e}")
            print(f"[Relayer] Traceback: {traceback.format_exc()}")
            raise RelayerError(
                f"Failed to submit transaction: {str(e)}",
                details={"error": str(e), "traceback": traceback.format_exc()}
            )

        return RelayResult(
            signature=signature,
            fee_paid=fee,
            amount_sent=amount,  # For MVP, full amount (fee is notional)
            recipient=recipient,
        )

    async def relay_transfer(
        self,
        nullifier: bytes,
        new_commitment: bytes,
        proof: bytes,
        denomination: int = 0,
    ) -> str:
        """
        Relay a private transfer transaction.

        Private transfers move funds from one shielded commitment to another
        without any SOL leaving the pool. The relayer signs the transaction.

        Args:
            nullifier: Nullifier bytes (32 bytes)
            new_commitment: New commitment for recipient (32 bytes)
            proof: ZK proof bytes

        Returns:
            Transaction signature
        """
        if not self.enabled:
            raise RelayerError("Relayer is disabled")

        if len(nullifier) != 32:
            raise RelayerError("Invalid nullifier length", details={"length": len(nullifier)})

        if len(new_commitment) != 32:
            raise RelayerError("Invalid new_commitment length", details={"length": len(new_commitment)})

        keypair = self._load_keypair()
        client = self._get_solana_client()

        try:
            signature = await client.submit_transfer_transaction(
                nullifier=nullifier,
                new_commitment=new_commitment,
                proof=proof,
                payer_keypair=bytes(keypair),
            )
        except Exception as e:
            import traceback
            print(f"[Relayer] Transfer transaction failed: {e}")
            print(f"[Relayer] Traceback: {traceback.format_exc()}")
            raise RelayerError(
                f"Failed to submit transfer transaction: {str(e)}",
                details={"error": str(e), "traceback": traceback.format_exc()}
            )

        return signature

    async def get_balance(self) -> int:
        """Get the relayer's SOL balance in lamports."""
        client = self._get_solana_client()
        pubkey = self._load_keypair().pubkey()
        response = await client.client.get_balance(pubkey)
        return response.value

    async def close(self):
        """Close the Solana client connection."""
        if self._solana_client:
            await self._solana_client.close()


# Singleton instance
_relayer_service: Optional[RelayerService] = None


def get_relayer_service() -> RelayerService:
    """Get the singleton relayer service instance."""
    global _relayer_service
    if _relayer_service is None:
        _relayer_service = RelayerService()
    return _relayer_service
