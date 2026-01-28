# Volume 4 Phase B: Real Pool Seeding (after 100 SOL funded)

## Prerequisites
- 100 SOL on devnet wallet at `~/.config/solana/id.json`
- Phase A complete (SDK initialize fixed, mock data working)
- Program deployed on devnet

## Seeding Script: `veil/scripts/seed_pools.py`

### Script Flow

```
1. Load keypair from ~/.config/solana/id.json (or --keypair arg)
2. Connect to devnet RPC
3. For each denomination [0, 100_000_000, 1_000_000_000, 10_000_000_000]:
   a. Initialize pool (skip if already exists)
   b. Generate N commitment/secret pairs using secrets.token_hex(32)
   c. For each pair:
      - Compute commitment via Pedersen (amount, secret)
      - Submit shield transaction
      - Log: "Pool {denom}: deposit {i}/{N} — tx: {sig}"
      - Brief delay between txs (0.5s) to avoid rate limiting
   d. Save secrets to a JSON manifest (for debug/verification, NOT for production)
4. Print summary: pools initialized, deposits per pool, total SOL spent
```

### CLI Args

```
--keypair PATH       # Payer keypair (default: ~/.config/solana/id.json)
--rpc URL            # RPC endpoint (default: devnet)
--program-id ID      # Program ID
--dry-run            # Print plan without submitting
--small N            # Deposits for 0.1 SOL pool (default: 50)
--medium N           # Deposits for 1 SOL pool (default: 30)
--large N            # Deposits for 10 SOL pool (default: 5)
--custom N           # Deposits for custom pool (default: 5)
```

### SOL Budget

| Pool | Denomination | Deposits | SOL Cost | Anonymity |
|------|-------------|----------|----------|-----------|
| Small | 0.1 SOL | 50 | 5 SOL | Good |
| Medium | 1 SOL | 30 | 30 SOL | Good |
| Large | 10 SOL | 5 | 50 SOL | Moderate |
| Custom | Variable | 5 (~1 SOL avg) | ~5 SOL | Low |
| Gas buffer | — | — | ~10 SOL | — |
| **Total** | | **90** | **~100 SOL** | |

### Output Manifest (`seed_manifest.json`)

```json
{
  "timestamp": "2026-01-27T...",
  "program_id": "F3NLg...",
  "cluster": "devnet",
  "pools": [
    {
      "denomination": 1000000000,
      "pool_pda": "...",
      "deposits": [
        { "commitment": "...", "secret": "...", "amount": 1000000000, "tx_sig": "..." }
      ]
    }
  ]
}
```

Secrets are for verification only. These are "dead" deposits — nobody withdraws them. SOL is locked.

### Post-Seeding Steps

1. Run `python scripts/seed_pools.py --dry-run` — verify plan
2. Run `python scripts/seed_pools.py` — watch deposits land
3. Verify on-chain: `solana account <pool_pda>` shows correct deposit counts
4. Set `MOCK_POOL_DATA=false`, restart backend
5. Set `NEXT_PUBLIC_MOCK_POOLS=false`, restart frontend
6. Navigate to /shield — verify real deposit counts
7. Test a real shield + unshield through a seeded pool

### Risks

| Risk | Mitigation |
|------|------------|
| Script fails mid-way | Idempotent — skips initialized pools, logs progress, can resume |
| Rate limiting on devnet | 0.5s delay between txs, configurable via `--delay` flag |
| 100 SOL not enough | `--dry-run` calculates exact cost first |
