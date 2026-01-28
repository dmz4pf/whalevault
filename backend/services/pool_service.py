import base64
import struct
from dataclasses import dataclass
from typing import Optional
import httpx

from config import FIXED_DENOMINATIONS, CUSTOM_DENOMINATION, get_settings


@dataclass
class PoolStats:
    """Privacy pool statistics."""

    total_value_locked: int
    total_deposits: int
    anonymity_set_size: int
    denomination: int  # 0 = custom


@dataclass
class DenominationPool:
    """Info about a specific denomination pool."""

    denomination: int
    label: str
    name: str
    deposit_count: int
    total_value_locked: int


# Pool PDA seed - must match the on-chain program
POOL_SEED = b"pool"


def derive_pool_pda(program_id: str, denomination: int = 0) -> str:
    """
    Derive the pool PDA address.

    Seeds: [b"pool", denomination_le_bytes]
    """
    from solders.pubkey import Pubkey

    program_pubkey = Pubkey.from_string(program_id)
    denomination_bytes = denomination.to_bytes(8, byteorder="little")
    pool_pda, _ = Pubkey.find_program_address([POOL_SEED, denomination_bytes], program_pubkey)
    return str(pool_pda)


class PoolService:
    """Service for querying privacy pool statistics from Solana."""

    def __init__(self, rpc_url: str, program_id: str):
        self.rpc_url = rpc_url
        self.program_id = program_id

    async def get_pool_status(self, denomination: int = 0) -> PoolStats:
        """
        Get current pool statistics for a specific denomination.

        Args:
            denomination: Pool denomination in lamports (0 = custom)
        """
        try:
            account_data = await self._fetch_pool_account(denomination)
            if account_data:
                stats = self._parse_pool_data(account_data)
                stats.denomination = denomination
                return stats
        except Exception as e:
            print(f"[PoolService] Error fetching pool stats for denom={denomination}: {e}")

        return PoolStats(
            total_value_locked=0,
            total_deposits=0,
            anonymity_set_size=0,
            denomination=denomination,
        )

    async def get_all_pools(self) -> list[DenominationPool]:
        """Get status of all denomination pools."""
        settings = get_settings()
        if settings.mock_pool_data:
            return self._get_mock_pools()

        pools = []

        # Fixed denomination pools
        for denom in FIXED_DENOMINATIONS:
            stats = await self.get_pool_status(denom["amount"])
            pools.append(DenominationPool(
                denomination=denom["amount"],
                label=denom["label"],
                name=denom["name"],
                deposit_count=stats.total_deposits,
                total_value_locked=stats.total_value_locked,
            ))

        # Custom pool
        custom_stats = await self.get_pool_status(CUSTOM_DENOMINATION)
        pools.append(DenominationPool(
            denomination=CUSTOM_DENOMINATION,
            label="Custom",
            name="custom",
            deposit_count=custom_stats.total_deposits,
            total_value_locked=custom_stats.total_value_locked,
        ))

        return pools

    @staticmethod
    def _get_mock_pools() -> list[DenominationPool]:
        """Mock pool data for Phase A development."""
        return [
            DenominationPool(denomination=1_000_000_000, label="1 SOL", name="small", deposit_count=47, total_value_locked=47_000_000_000),
            DenominationPool(denomination=10_000_000_000, label="10 SOL", name="medium", deposit_count=32, total_value_locked=320_000_000_000),
            DenominationPool(denomination=100_000_000_000, label="100 SOL", name="large", deposit_count=12, total_value_locked=1_200_000_000_000),
            DenominationPool(denomination=1_000_000_000_000, label="1K SOL", name="whale", deposit_count=5, total_value_locked=5_000_000_000_000),
            DenominationPool(denomination=10_000_000_000_000, label="10K SOL", name="mega", deposit_count=2, total_value_locked=20_000_000_000_000),
            DenominationPool(denomination=0, label="Custom", name="custom", deposit_count=8, total_value_locked=15_000_000_000),
        ]

    async def _fetch_pool_account(self, denomination: int = 0) -> Optional[bytes]:
        """Fetch the pool account data from Solana RPC by denomination."""
        pool_address = derive_pool_pda(self.program_id, denomination)

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self.rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getAccountInfo",
                    "params": [
                        pool_address,
                        {"encoding": "base64"},
                    ],
                },
            )

            data = response.json()
            result = data.get("result", {})
            value = result.get("value")

            if value and value.get("data"):
                account_data = value["data"]
                if isinstance(account_data, list) and len(account_data) > 0:
                    return base64.b64decode(account_data[0])

        return None

    def _parse_pool_data(self, data: bytes) -> PoolStats:
        """
        Parse pool account data structure.

        On-chain PrivacyPool layout (after 8-byte Anchor discriminator):
        - authority: Pubkey (32 bytes)
        - merkle_tree: IncrementalMerkleTree (680 bytes)
        - root_history: [[u8; 32]; 10] (320 bytes)
        - root_history_index: u8 (1 byte)
        - nullifier_count: u64 (8 bytes)
        - relayer_fee_bps: u16 (2 bytes)
        - total_fees_collected: u64 (8 bytes)
        - bump: u8 (1 byte)
        - denomination: u64 (8 bytes)
        - deposit_count: u64 (8 bytes)

        Total before denomination: 8 + 32 + 680 + 320 + 1 + 8 + 2 + 8 + 1 = 1060
        """
        if len(data) < 1076:  # 1060 + 8 (denomination) + 8 (deposit_count)
            return PoolStats(0, 0, 0, 0)

        try:
            # deposit_count is at offset 1068 (1060 + 8 for denomination)
            denomination = struct.unpack("<Q", data[1060:1068])[0]
            deposit_count = struct.unpack("<Q", data[1068:1076])[0]

            # For TVL, we can estimate from deposit_count * denomination (for fixed pools)
            # or query vault balance directly
            tvl = deposit_count * denomination if denomination > 0 else 0

            return PoolStats(
                total_value_locked=tvl,
                total_deposits=int(deposit_count),
                anonymity_set_size=int(deposit_count),
                denomination=int(denomination),
            )
        except struct.error:
            return PoolStats(0, 0, 0, 0)
