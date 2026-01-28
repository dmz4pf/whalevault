# Dual-DEX Swap Architecture Design

**Date:** 2026-01-27
**Status:** Approved

## Overview

Replace the current Jupiter-only (mainnet-only) swap system with a dual-DEX architecture:
- **Mainnet:** Jupiter REST API (existing, atomic via relayer)
- **Devnet:** Raydium SDK V2 (new, two-step: unshield → user-signed swap)

Also replace the static 5-button token picker with a searchable token selector.

## Architecture

### Network-Based Swap Routing

```
                    ┌─────────────────┐
                    │  usePrivateSwap  │
                    │     (hook)       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Network Check  │
                    │  (devnet/main)  │
                    └───┬─────────┬───┘
                        │         │
               ┌────────▼──┐  ┌──▼────────┐
               │  DEVNET   │  │  MAINNET  │
               │           │  │           │
               │ 1. Unshield│  │ Backend   │
               │    via     │  │ /swap/    │
               │    backend │  │ execute   │
               │            │  │ (atomic)  │
               │ 2. Raydium │  │           │
               │    SDK V2  │  │ Jupiter   │
               │    swap    │  │ REST API  │
               │    (client)│  │           │
               └────────────┘  └───────────┘
```

### Devnet Flow (Two-Step)

1. User selects shielded position + output token
2. Frontend fetches Raydium quote via SDK
3. User clicks "Execute Private Swap"
4. Backend unshields SOL → sends to user's wallet
5. Frontend builds Raydium swap tx via SDK
6. User signs swap tx with wallet adapter
7. Frontend confirms both transactions on-chain

### Mainnet Flow (Atomic, Unchanged)

1. User selects position + output token
2. Frontend calls `GET /swap/quote` (Jupiter via backend)
3. User clicks "Execute Private Swap"
4. Frontend calls `POST /swap/execute`
5. Backend: unshields SOL to relayer → Jupiter swap → tokens to recipient
6. Frontend confirms transaction

### Key Difference

| Aspect | Devnet | Mainnet |
|--------|--------|---------|
| DEX | Raydium SDK V2 | Jupiter REST API |
| Swap execution | Frontend (user signs) | Backend (relayer signs) |
| Atomicity | Two transactions | One atomic flow |
| Token pairs | Limited devnet pools | Full Jupiter coverage |
| Quote source | Raydium SDK (local compute) | Jupiter API |

## Searchable Token Selector

Replace the static 5-button grid with a searchable dropdown component.

### Features
- Search input with 300ms debounce
- Search by name, symbol, or mint address
- Featured tokens as quick-select chips (top 5)
- Full scrollable token list from API
- Token logos from `logoUri`
- Network-aware: different tokens per network

### Data Sources
- **Devnet:** Raydium devnet token/pool APIs
- **Mainnet:** Jupiter token list via backend `/swap/tokens`

### Devnet Featured Tokens
- dwSOL (devnet wrapped SOL)
- dUSDC (devnet USDC) — mint: `BEcGFQK1T1tSu3kvHC17cyCkQ5dvXqAJ7ExB2bb5Do7a`
- RAY (devnet RAY) — mint: `FSRvxBNrQWX2Fy2qvKMLL3ryEdRtE3PUTZBcdKwASZTU`

### Mainnet Featured Tokens (unchanged)
- USDC, USDT, BONK, JUP, WIF

## Network-Aware Messaging

Devnet banner on Private Swap page:
> ⚠️ Devnet Mode — Limited token pairs. Swaps use Raydium devnet pools. Switch to mainnet for full token coverage.

Devnet status flow adds explicit steps:
1. Deriving secret...
2. Generating proof...
3. **Unshielding SOL to wallet...**
4. **Building swap route...**
5. **Executing Raydium swap...**
6. Confirming on chain...

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `frontend/components/swap/TokenSelector.tsx` | Searchable token picker |
| `frontend/hooks/useTokenList.ts` | Fetch/cache token list per network |
| `frontend/services/raydium-swap.ts` | Raydium SDK V2 devnet swap logic |

### Modified Files
| File | Change |
|------|--------|
| `frontend/app/private-swap/page.tsx` | TokenSelector + network banner |
| `frontend/hooks/usePrivateSwap.ts` | Devnet branch with Raydium SDK |
| `frontend/lib/tokens.ts` | Devnet featured tokens |
| `frontend/lib/api.ts` | Token list fetch |
| `frontend/package.json` | Add `@raydium-io/raydium-sdk-v2` |

### Unchanged
- Backend `swap.py`, `jupiter_service.py` (mainnet path)
- All shield/unshield logic
- Proof generation system

## Dependencies
- `@raydium-io/raydium-sdk-v2` — Raydium TypeScript SDK

## Implementation Order
1. Add Raydium SDK dependency
2. Build `raydium-swap.ts` service
3. Build `useTokenList` hook
4. Build `TokenSelector` component
5. Update `usePrivateSwap` with devnet branch
6. Update Private Swap page (TokenSelector + banner)
7. Test devnet swap end-to-end
8. Verify mainnet path unchanged

## Risks
- **Devnet pool liquidity**: dwSOL/dUSDC pool has $50M TVL, but other pairs may be thin
- **Raydium SDK bundle size**: SDK is large; may need dynamic import
- **Pool data fetch time**: First fetch can take >1 min; need caching strategy
- **Devnet RPC reliability**: Free devnet RPC may have rate limits

## Sources
- [Raydium SDK V2 Demo](https://github.com/raydium-io/raydium-sdk-V2-demo)
- [Raydium Trade API Docs](https://docs.raydium.io/raydium/for-developers/trade-api)
- [Raydium Devnet API](https://api-v3-devnet.raydium.io/docs/)
- [Chainstack Raydium Guide](https://docs.chainstack.com/docs/solana-how-to-perform-token-swaps-using-the-raydium-sdk)
