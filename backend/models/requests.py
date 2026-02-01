from typing import Optional
from pydantic import BaseModel, Field, model_validator


# Maximum shield/unshield amount: 1000 SOL in lamports
# This prevents absurd values and potential overflow issues
MAX_AMOUNT_LAMPORTS = 1_000_000_000_000  # 1000 SOL

# Minimum amount: 0.001 SOL (to cover transaction fees)
MIN_AMOUNT_LAMPORTS = 1_000_000  # 0.001 SOL


class ShieldPrepareRequest(BaseModel):
    """Request to prepare a shield (deposit) transaction."""

    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports to shield (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    depositor: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Depositor's Solana public key",
    )
    commitment: str | None = Field(
        None,
        min_length=64,
        max_length=64,
        description="Pre-computed commitment from frontend (64 hex characters). If provided, backend won't generate secret.",
    )
    denomination: Optional[int] = Field(
        None,
        ge=0,
        description="Pool denomination in lamports. null/0 = custom pool. Fixed pools: 100000000 (0.1 SOL), 1000000000 (1 SOL), 10000000000 (10 SOL).",
    )

    @model_validator(mode="after")
    def validate_denomination_match(self):
        """For fixed pools, amount must match denomination exactly."""
        if self.denomination is not None and self.denomination > 0:
            if self.amount != self.denomination:
                raise ValueError(
                    f"Amount ({self.amount}) must match denomination ({self.denomination}) for fixed pools"
                )
        return self


class UnshieldProofRequest(BaseModel):
    """Request to generate an unshield (withdrawal) proof."""

    commitment: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The commitment hash from the deposit (64 hex characters)",
    )
    secret: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The secret used to generate the commitment (64 hex characters)",
    )
    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports to unshield (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient's Solana public key",
    )
    denomination: Optional[int] = Field(
        None,
        ge=0,
        description="Pool denomination in lamports. null/0 = custom pool.",
    )


class UnshieldPrepareRequest(BaseModel):
    """Request to prepare an unshield transaction after proof generation."""

    job_id: str = Field(
        ...,
        description="The proof job ID from the /unshield/proof endpoint",
    )
    recipient: str | None = Field(
        None,
        min_length=32,
        max_length=44,
        description="Override recipient address (defaults to original proof recipient)",
    )
    relayer: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="The relayer/signer wallet address (usually the user's connected wallet)",
    )


class RelayUnshieldRequest(BaseModel):
    """Request to relay an unshield transaction through the relayer."""

    job_id: str = Field(
        ...,
        description="The proof job ID from the /unshield/proof endpoint",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient Solana address to receive the funds",
    )


class SwapExecuteRequest(BaseModel):
    """Request to execute a private swap (unshield + swap via Jupiter)."""

    job_id: str = Field(
        ...,
        description="Proof job ID from /unshield/proof",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient address for swapped tokens",
    )
    output_mint: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Output token mint address",
    )


class ComputeCommitmentRequest(BaseModel):
    """Request to compute a commitment from amount and secret."""

    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    secret: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The secret used to generate the commitment (64 hex characters)",
    )


class PrivateTransferProofRequest(BaseModel):
    """Request to generate a private transfer proof (shielded-to-shielded)."""

    commitment: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The sender's commitment hash (64 hex characters)",
    )
    secret: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="The sender's secret used to generate the commitment (64 hex characters)",
    )
    amount: int = Field(
        ...,
        gt=MIN_AMOUNT_LAMPORTS,
        le=MAX_AMOUNT_LAMPORTS,
        description=f"Amount in lamports to transfer (min: {MIN_AMOUNT_LAMPORTS}, max: {MAX_AMOUNT_LAMPORTS})",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient's Solana public key (for reference, not used on-chain)",
    )
    denomination: Optional[int] = Field(
        None,
        ge=0,
        description="Pool denomination in lamports. null/0 = custom pool.",
    )


class RelayTransferRequest(BaseModel):
    """Request to relay a private transfer transaction through the relayer."""

    job_id: str = Field(
        ...,
        description="The proof job ID from the /transfer/proof endpoint",
    )
    recipient: str = Field(
        ...,
        min_length=32,
        max_length=44,
        description="Recipient Solana address (for reference only)",
    )
