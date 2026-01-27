from fastapi import APIRouter, Depends

from models.requests import ShieldPrepareRequest
from models.responses import ShieldPrepareResponse
from services.veil_service import VeilService
from config import get_settings, Settings
from utils.serialization import serialize_instruction, get_recent_blockhash

router = APIRouter()


def get_veil_service(settings: Settings = Depends(get_settings)) -> VeilService:
    """Dependency to get VeilService."""
    return VeilService(program_id=settings.program_id)


@router.post("/prepare", response_model=ShieldPrepareResponse)
async def prepare_shield(
    request: ShieldPrepareRequest,
    veil_service: VeilService = Depends(get_veil_service),
) -> ShieldPrepareResponse:
    """
    Prepare a shield (deposit) transaction.

    If commitment is provided (from frontend wallet signature derivation),
    uses that commitment directly. Otherwise generates commitment and secret
    on the backend (legacy behavior).

    The denomination parameter selects which pool to deposit into:
    - null/0: Custom pool (any amount)
    - 100000000: 0.1 SOL fixed pool
    - 1000000000: 1 SOL fixed pool
    - 10000000000: 10 SOL fixed pool
    """
    # Check if frontend provided pre-computed commitment
    if request.commitment:
        # New flow: frontend derives secret from wallet signature,
        # computes commitment, and sends it here
        commitment = request.commitment
        secret = None  # Secret stays on frontend
    else:
        # Legacy flow: backend generates commitment and secret
        result = veil_service.generate_commitment(
            amount=request.amount,
            depositor=request.depositor,
        )
        commitment = result.commitment
        secret = result.secret

    # Determine denomination (null → 0 = custom pool)
    denomination = request.denomination or 0

    # Build instruction data for the correct denomination pool
    instruction = veil_service.build_shield_instruction(
        commitment=commitment,
        amount=request.amount,
        depositor=request.depositor,
        denomination=denomination,
    )

    # Serialize instruction and fetch blockhash
    serialized_instruction = serialize_instruction(instruction)
    blockhash = await get_recent_blockhash()

    return ShieldPrepareResponse(
        commitment=commitment,
        secret=secret,
        amount=request.amount,
        instruction=serialized_instruction,
        blockhash=blockhash,
    )
