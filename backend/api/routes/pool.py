from fastapi import APIRouter, Depends

from models.responses import PoolStatusResponse, PoolsListResponse, PoolInfo
from services.pool_service import PoolService
from config import get_settings, Settings

router = APIRouter()


def get_pool_service(settings: Settings = Depends(get_settings)) -> PoolService:
    """Dependency to get PoolService."""
    return PoolService(
        rpc_url=settings.solana_rpc_url,
        program_id=settings.program_id,
    )


@router.get("/status", response_model=PoolStatusResponse)
async def get_pool_status(
    pool_service: PoolService = Depends(get_pool_service),
) -> PoolStatusResponse:
    """
    Get the current status of the default (custom) privacy pool.

    Returns statistics about the pool including total value locked,
    number of deposits, and anonymity set size.
    """
    stats = await pool_service.get_pool_status()

    return PoolStatusResponse(
        totalValueLocked=stats.total_value_locked,
        totalDeposits=stats.total_deposits,
        anonymitySetSize=stats.anonymity_set_size,
    )


@router.get("/pools", response_model=PoolsListResponse)
async def list_pools(
    pool_service: PoolService = Depends(get_pool_service),
    settings: Settings = Depends(get_settings),
) -> PoolsListResponse:
    """
    List all available denomination pools with their anonymity set sizes.

    Returns fixed denomination pools (0.1, 1, 10 SOL) and optionally
    the custom amount pool.
    """
    pools = await pool_service.get_all_pools()

    return PoolsListResponse(
        pools=[
            PoolInfo(
                denomination=p.denomination,
                label=p.label,
                name=p.name,
                depositCount=p.deposit_count,
                totalValueLocked=p.total_value_locked,
            )
            for p in pools
        ],
        customEnabled=settings.custom_pool_enabled,
    )
