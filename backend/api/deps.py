from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from config import Settings, get_settings
from proof_queue.job_queue import ProofJobQueue
from services.veil_service import VeilService
from services.pool_service import PoolService
from services.relayer_service import RelayerService, get_relayer_service
from services.jupiter_service import JupiterService, get_jupiter_service


# Singleton instances
_job_queue: ProofJobQueue | None = None


def get_job_queue(
    settings: Settings = Depends(get_settings),
) -> ProofJobQueue:
    """Get or create the singleton job queue."""
    global _job_queue
    if _job_queue is None:
        _job_queue = ProofJobQueue(program_id=settings.program_id)
    return _job_queue


@lru_cache
def get_veil_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> VeilService:
    """Get the veil service instance."""
    return VeilService(program_id=settings.program_id)


@lru_cache
def get_pool_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> PoolService:
    """Get the pool service instance."""
    return PoolService(
        rpc_url=settings.solana_rpc_url,
        program_id=settings.program_id,
    )


# Type aliases for dependency injection
VeilServiceDep = Annotated[VeilService, Depends(get_veil_service)]
JobQueueDep = Annotated[ProofJobQueue, Depends(get_job_queue)]
PoolServiceDep = Annotated[PoolService, Depends(get_pool_service)]
RelayerServiceDep = Annotated[RelayerService, Depends(get_relayer_service)]
JupiterServiceDep = Annotated[JupiterService, Depends(get_jupiter_service)]
