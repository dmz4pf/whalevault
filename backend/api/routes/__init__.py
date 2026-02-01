from fastapi import APIRouter

from .shield import router as shield_router
from .unshield import router as unshield_router
from .proof import router as proof_router
from .pool import router as pool_router
from .health import router as health_router
from .relay import router as relay_router
from .commitment import router as commitment_router
from .swap import router as swap_router
from .transfer import router as transfer_router


api_router = APIRouter()

api_router.include_router(shield_router, prefix="/shield", tags=["shield"])
api_router.include_router(unshield_router, prefix="/unshield", tags=["unshield"])
api_router.include_router(proof_router, prefix="/proof", tags=["proof"])
api_router.include_router(pool_router, prefix="/pool", tags=["pool"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(relay_router, prefix="/relay", tags=["relay"])
api_router.include_router(commitment_router, prefix="/commitment", tags=["commitment"])
api_router.include_router(swap_router, prefix="/swap", tags=["swap"])
api_router.include_router(transfer_router, prefix="/transfer", tags=["transfer"])

__all__ = ["api_router"]
