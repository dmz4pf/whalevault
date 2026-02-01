from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from models.requests import PrivateTransferProofRequest
from models.responses import ProofJobResponse, ProofStatus
from proof_queue.job_queue import ProofJobQueue, JobStatus
from api.deps import get_job_queue
from config import ALL_DENOMINATIONS

router = APIRouter()

limiter = Limiter(key_func=get_remote_address)


@router.post("/proof", response_model=ProofJobResponse)
@limiter.limit("5/minute")
async def submit_transfer_proof(
    request: Request,
    proof_request: PrivateTransferProofRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
) -> ProofJobResponse:
    """
    Submit a request to generate a private transfer proof.

    Private transfers move funds from one shielded position to another
    without revealing the sender, recipient, or amount on-chain.

    The sender's commitment is nullified and a new commitment is created
    for the recipient. SOL never leaves the shielded pool.

    After proof generation completes, use /relay/transfer to submit
    the transaction through the relayer.
    """
    # Validate denomination is a valid pool
    denomination = proof_request.denomination or 0
    if denomination not in ALL_DENOMINATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid denomination. Valid options: {ALL_DENOMINATIONS}"
        )

    # For fixed-denomination pools, amount must match denomination exactly
    if denomination > 0 and proof_request.amount != denomination:
        raise HTTPException(
            status_code=400,
            detail=f"Amount ({proof_request.amount}) must match denomination ({denomination}) for fixed pools"
        )

    job = await job_queue.submit_transfer(
        commitment=proof_request.commitment,
        secret=proof_request.secret,
        amount=proof_request.amount,
        recipient=proof_request.recipient,
        denomination=proof_request.denomination or 0,
    )

    return ProofJobResponse(
        jobId=job.id,
        status=ProofStatus(job.status.value),
        estimatedTime=5,
    )
