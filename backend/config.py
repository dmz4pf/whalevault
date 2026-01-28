from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    solana_rpc_url: str = "https://api.devnet.solana.com"
    program_id: str = "3qhVPvz8T1WiozCLEfhUuv8WZHDPpEfnAzq2iSatULc7"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    debug: bool = True

    # Relayer configuration
    relayer_keypair_path: str = "relayer-keypair.json"
    relayer_fee_bps: int = 30  # 0.3% fee
    relayer_enabled: bool = True

    # Custom pool enabled
    custom_pool_enabled: bool = True

    # Jupiter API
    jupiter_api_url: str = "https://api.jup.ag/swap/v1"

    # Mock pool data (Phase A - before real on-chain seeding)
    mock_pool_data: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Fixed denomination pools (amount in lamports)
FIXED_DENOMINATIONS = [
    {"name": "small", "amount": 1_000_000_000, "label": "1 SOL"},       # 1 SOL
    {"name": "medium", "amount": 10_000_000_000, "label": "10 SOL"},   # 10 SOL
    {"name": "large", "amount": 100_000_000_000, "label": "100 SOL"},    # 100 SOL
    {"name": "whale", "amount": 1_000_000_000_000, "label": "1K SOL"},   # 1,000 SOL
    {"name": "mega", "amount": 10_000_000_000_000, "label": "10K SOL"},  # 10,000 SOL
]

# Custom pool denomination (0 = variable amount)
CUSTOM_DENOMINATION = 0

# All valid denominations (including custom)
ALL_DENOMINATIONS = [d["amount"] for d in FIXED_DENOMINATIONS] + [CUSTOM_DENOMINATION]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
