"""
Relay API endpoints for relayer-based transactions.

The relayer signs and submits transactions on behalf of users,
providing true privacy by breaking the link between user wallet
and withdrawal recipient.
"""

from fastapi import APIRouter, Depends, HTTPException

from models.requests import RelayUnshieldRequest, RelayTransferRequest
from models.responses import RelayUnshieldResponse, RelayerInfoResponse, RelayTransferResponse
from proof_queue.job_queue import ProofJobQueue, JobStatus, JobType
from services.relayer_service import RelayerService
from api.deps import get_job_queue, get_relayer_service
from utils.errors import RelayerError

router = APIRouter()


@router.get("/info", response_model=RelayerInfoResponse)
async def get_relayer_info(
    relayer: RelayerService = Depends(get_relayer_service),
) -> RelayerInfoResponse:
    """
    Get information about the relayer service.

    Returns the relayer's public key, fee structure, and balance.
    Use this to display relayer info to users before withdrawal.
    """
    try:
        balance = await relayer.get_balance()
    except Exception:
        balance = 0  # If we can't get balance, report 0

    return RelayerInfoResponse(
        enabled=relayer.enabled,
        publicKey=relayer.public_key,
        feeBps=relayer.fee_bps,
        balance=balance,
    )


@router.post("/unshield", response_model=RelayUnshieldResponse)
async def relay_unshield(
    request: RelayUnshieldRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
    relayer: RelayerService = Depends(get_relayer_service),
) -> RelayUnshieldResponse:
    """
    Relay an unshield transaction through the relayer.

    The relayer signs and submits the transaction, taking a small fee.
    This provides true privacy because the user's wallet never signs
    the withdrawal transaction - only the ZK proof authorizes it.

    Prerequisites:
    1. Proof generation must be complete (call /unshield/proof first)
    2. Relayer must be enabled and have sufficient balance
    """
    if not relayer.enabled:
        raise HTTPException(
            status_code=503,
            detail="Relayer service is currently disabled"
        )

    # Get the proof job
    job = await job_queue.get_status(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Proof job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Proof job not complete (status: {job.status.value})"
        )

    if not job.result:
        raise HTTPException(status_code=500, detail="Proof result missing")

    # Get proof and nullifier from job result
    proof_hex = job.result.get("proof", "")
    nullifier_hex = job.result.get("nullifier", "")

    if not proof_hex or not nullifier_hex:
        raise HTTPException(
            status_code=500,
            detail="Proof or nullifier missing from job result"
        )

    # Convert hex to bytes
    proof_bytes = bytes.fromhex(proof_hex)
    nullifier_bytes = bytes.fromhex(nullifier_hex)

    try:
        # Relay the transaction
        result = await relayer.relay_unshield(
            nullifier=nullifier_bytes,
            recipient=request.recipient,
            amount=job.amount,
            proof=proof_bytes,
            denomination=job.denomination,
        )

        return RelayUnshieldResponse(
            signature=result.signature,
            fee=result.fee_paid,
            amountSent=result.amount_sent,
            recipient=result.recipient,
        )

    except RelayerError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Relay failed: {str(e)}"
        )


@router.post("/transfer", response_model=RelayTransferResponse)
async def relay_transfer(
    request: RelayTransferRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
    relayer: RelayerService = Depends(get_relayer_service),
) -> RelayTransferResponse:
    """
    Relay a private transfer transaction through the relayer.

    Private transfers move funds from one shielded commitment to another.
    No SOL leaves the pool - only the commitment changes.

    The recipient will need the returned recipient_secret and new_commitment
    to later unshield the funds. These must be shared off-chain.

    Prerequisites:
    1. Transfer proof generation must be complete (call /transfer/proof first)
    2. Relayer must be enabled
    """
    if not relayer.enabled:
        raise HTTPException(
            status_code=503,
            detail="Relayer service is currently disabled"
        )

    # Get the proof job
    job = await job_queue.get_status(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Proof job not found")

    if job.job_type != JobType.TRANSFER:
        raise HTTPException(
            status_code=400,
            detail="Invalid job type - expected transfer proof job"
        )

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Proof job not complete (status: {job.status.value})"
        )

    if not job.result:
        raise HTTPException(status_code=500, detail="Proof result missing")

    # Get proof data from job result
    proof_hex = job.result.get("proof", "")
    nullifier_hex = job.result.get("nullifier", "")
    new_commitment_hex = job.result.get("new_commitment", "")
    recipient_secret_hex = job.result.get("recipient_secret", "")

    if not all([proof_hex, nullifier_hex, new_commitment_hex, recipient_secret_hex]):
        raise HTTPException(
            status_code=500,
            detail="Transfer proof data incomplete"
        )

    # Convert hex to bytes
    proof_bytes = bytes.fromhex(proof_hex)
    nullifier_bytes = bytes.fromhex(nullifier_hex)
    new_commitment_bytes = bytes.fromhex(new_commitment_hex)

    try:
        # Relay the transfer transaction
        signature = await relayer.relay_transfer(
            nullifier=nullifier_bytes,
            new_commitment=new_commitment_bytes,
            proof=proof_bytes,
            denomination=job.denomination,
        )

        # No fee for transfers (SOL doesn't leave pool)
        return RelayTransferResponse(
            signature=signature,
            fee=0,
            recipientSecret=recipient_secret_hex,
            newCommitment=new_commitment_hex,
            amount=job.amount,
            recipient=request.recipient,
        )

    except RelayerError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transfer relay failed: {str(e)}"
        )
