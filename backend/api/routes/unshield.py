from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from models.requests import UnshieldProofRequest, UnshieldPrepareRequest
from models.responses import ProofJobResponse, ProofStatus, UnshieldPrepareResponse
from proof_queue.job_queue import ProofJobQueue, JobStatus
from services.veil_service import VeilService
from api.deps import get_job_queue, get_veil_service
from utils.serialization import get_recent_blockhash

router = APIRouter()

# Rate limiter for proof generation - expensive operation
limiter = Limiter(key_func=get_remote_address)


@router.post("/proof", response_model=ProofJobResponse)
@limiter.limit("5/minute")
async def submit_unshield_proof(
    request: Request,  # Required for rate limiter
    proof_request: UnshieldProofRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
) -> ProofJobResponse:
    """
    Submit a request to generate an unshield (withdrawal) proof.

    Proof generation is computationally intensive, so this endpoint
    queues the job and returns immediately with a job ID for polling.
    """
    job = await job_queue.submit(
        commitment=proof_request.commitment,
        secret=proof_request.secret,
        amount=proof_request.amount,
        recipient=proof_request.recipient,
        denomination=proof_request.denomination or 0,
    )

    return ProofJobResponse(
        jobId=job.id,
        status=ProofStatus(job.status.value),
        estimatedTime=5,  # Estimated 5 seconds
    )


@router.post("/prepare", response_model=UnshieldPrepareResponse)
async def prepare_unshield(
    request: UnshieldPrepareRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
    veil_service: VeilService = Depends(get_veil_service),
) -> UnshieldPrepareResponse:
    """
    Prepare an unshield transaction after proof generation is complete.

    This endpoint builds the transaction instruction that the frontend
    can sign and submit to Solana.
    """
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

    # Use override recipient or fall back to original proof recipient
    recipient = request.recipient or job.recipient

    # Get proof and nullifier from job result
    proof_hex = job.result.get("proof", "")
    nullifier_hex = job.result.get("nullifier", "")

    if not proof_hex or not nullifier_hex:
        raise HTTPException(status_code=500, detail="Proof or nullifier missing from job result")

    # Convert hex to bytes
    proof_bytes = bytes.fromhex(proof_hex)
    nullifier_bytes = bytes.fromhex(nullifier_hex)

    # Build the instruction
    instruction = veil_service.build_unshield_instruction(
        proof=proof_bytes,
        nullifier=nullifier_bytes,
        amount=job.amount,
        recipient=recipient,
        relayer=request.relayer,
        denomination=job.denomination,
    )

    # Get recent blockhash
    blockhash = await get_recent_blockhash()

    return UnshieldPrepareResponse(
        instruction=instruction,
        blockhash=blockhash,
        amount=job.amount,
        recipient=recipient,
    )
