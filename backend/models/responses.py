from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ProofStatus(str, Enum):
    """Status of a proof generation job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ShieldPrepareResponse(BaseModel):
    """Response containing prepared shield transaction data."""

    commitment: str = Field(..., description="The commitment hash for the deposit")
    secret: Optional[str] = Field(
        None,
        description="Secret to store securely for withdrawal (only if backend generated commitment)",
    )
    amount: int = Field(..., description="Amount in lamports")
    instruction: dict = Field(..., description="Serialized instruction data for the transaction")
    blockhash: str = Field(..., description="Recent blockhash for transaction signing")


class ProofJobResponse(BaseModel):
    """Response when a proof generation job is submitted."""

    job_id: str = Field(..., alias="jobId", description="Unique identifier for the proof job")
    status: ProofStatus = Field(..., description="Current status of the job")
    estimated_time: int = Field(..., alias="estimatedTime", description="Estimated time in seconds")

    class Config:
        populate_by_name = True


class ProofStatusResponse(BaseModel):
    """Response for proof job status check."""

    job_id: str = Field(..., alias="jobId", description="Unique identifier for the proof job")
    status: ProofStatus = Field(..., description="Current status of the job")
    progress: int = Field(..., ge=0, le=100, description="Progress percentage")
    stage: Optional[str] = Field(None, description="Current processing stage")
    result: Optional[dict] = Field(None, description="Proof result when completed")
    error: Optional[str] = Field(None, description="Error message if failed")

    class Config:
        populate_by_name = True


class UnshieldPrepareResponse(BaseModel):
    """Response containing prepared unshield transaction data."""

    instruction: dict = Field(..., description="Serialized instruction data for the transaction")
    blockhash: str = Field(..., description="Recent blockhash for transaction signing")
    amount: int = Field(..., description="Amount in lamports being unshielded")
    recipient: str = Field(..., description="Recipient address for the unshield")


class PoolStatusResponse(BaseModel):
    """Response containing privacy pool statistics."""

    total_value_locked: int = Field(..., alias="totalValueLocked", description="Total SOL locked in lamports")
    total_deposits: int = Field(..., alias="totalDeposits", description="Number of deposits")
    anonymity_set_size: int = Field(..., alias="anonymitySetSize", description="Size of the anonymity set")

    class Config:
        populate_by_name = True


class PoolInfo(BaseModel):
    """Information about a single denomination pool."""

    denomination: int = Field(..., description="Pool denomination in lamports (0 = custom)")
    label: str = Field(..., description="Human-readable label (e.g. '1 SOL')")
    name: str = Field(..., description="Pool name (e.g. 'medium')")
    deposit_count: int = Field(..., alias="depositCount", description="Number of deposits (anonymity set)")
    total_value_locked: int = Field(..., alias="totalValueLocked", description="Total SOL in pool (lamports)")

    class Config:
        populate_by_name = True


class PoolsListResponse(BaseModel):
    """Response listing all available denomination pools."""

    pools: list[PoolInfo] = Field(..., description="List of all pools")
    custom_enabled: bool = Field(..., alias="customEnabled", description="Whether custom amount pool is available")

    class Config:
        populate_by_name = True


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="Health status")
    version: str = Field(..., description="API version")
    solana_connection: bool = Field(..., alias="solanaConnection", description="Solana RPC connection status")
    rpc_latency: Optional[float] = Field(None, alias="rpcLatency", description="RPC latency in milliseconds")
    program_id: str = Field(..., alias="programId", description="Veil program ID on Solana")

    class Config:
        populate_by_name = True


class RelayUnshieldResponse(BaseModel):
    """Response from relaying an unshield transaction."""

    signature: str = Field(..., description="Transaction signature on Solana")
    fee: int = Field(..., description="Relayer fee charged in lamports")
    amount_sent: int = Field(
        ..., alias="amountSent", description="Amount sent to recipient in lamports (after fee)"
    )
    recipient: str = Field(..., description="Recipient address that received funds")

    class Config:
        populate_by_name = True


class RelayerInfoResponse(BaseModel):
    """Information about the relayer service."""

    enabled: bool = Field(..., description="Whether relayer service is enabled")
    public_key: str = Field(..., alias="publicKey", description="Relayer's Solana public key")
    fee_bps: int = Field(..., alias="feeBps", description="Fee in basis points (100 bps = 1%)")
    balance: int = Field(..., description="Relayer's SOL balance in lamports")

    class Config:
        populate_by_name = True


class SwapQuoteResponse(BaseModel):
    """Response containing a Jupiter swap quote."""

    input_mint: str = Field(..., alias="inputMint")
    output_mint: str = Field(..., alias="outputMint")
    in_amount: str = Field(..., alias="inAmount")
    out_amount: str = Field(..., alias="outAmount")
    price_impact_pct: str = Field(..., alias="priceImpactPct")
    slippage_bps: int = Field(..., alias="slippageBps")
    minimum_received: str = Field(..., alias="minimumReceived")

    class Config:
        populate_by_name = True


class SwapExecuteResponse(BaseModel):
    """Response from executing a private swap.

    Two-transaction flow returns both swap and transfer signatures.
    """

    unshield_signature: str = Field(..., alias="unshieldSignature")
    swap_signature: str = Field(..., alias="swapSignature")
    transfer_signature: str = Field("", alias="transferSignature")
    output_amount: str = Field(..., alias="outputAmount")
    output_mint: str = Field(..., alias="outputMint")
    recipient: str
    fee: int

    class Config:
        populate_by_name = True


class SwapTokenInfo(BaseModel):
    """Token metadata from Jupiter."""

    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: Optional[str] = Field(None, alias="logoUri")

    class Config:
        populate_by_name = True


class ComputeCommitmentResponse(BaseModel):
    """Response containing the computed commitment."""

    commitment: str = Field(..., description="The computed commitment hash (64 hex characters)")
