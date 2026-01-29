# Private Yield Implementation Plan (Jito Integration)

## Overview

Implement Private Yield for WhaleVault — enable users to earn ~7-8% APY on shielded assets via Jito liquid staking while maintaining privacy.

**Architecture:** Privacy Wrapper Pattern — aggregate deposits into vault, deploy to Jito, track user shares encrypted in Supabase.

---

## Phase 1: Backend Foundation (2-3 days)

### Files to Create

**`/backend/models/yield.py`**
- `YieldProtocol` enum (jito, kamino)
- `YieldDepositRequest`, `YieldWithdrawRequest` — Pydantic request models
- `YieldPositionResponse`, `YieldDepositResponse`, `YieldWithdrawResponse` — response models
- `YieldVaultStats` — aggregate stats model

**`/backend/services/jito_service.py`**
- `get_current_apy()` — fetch from Jito stats API (cached 5 min)
- `get_exchange_rate()` — jitoSOL/SOL rate
- `stake_sol(amount, keypair)` — stake SOL → jitoSOL
- `unstake_jitosol(amount, keypair)` — jitoSOL → SOL

**`/backend/services/yield_service.py`**
- `calculate_shares_for_deposit(amount)` — share calculation
- `calculate_value_for_shares(shares)` — current SOL value
- `record_deposit(wallet_hash, amount, protocol)` — create position
- `calculate_withdrawal(position_id)` — principal + yield - fee
- `record_withdrawal(position_id)` — mark withdrawn

---

## Phase 2: Backend API Routes (1-2 days)

### File to Create

**`/backend/api/routes/yield.py`**
```
GET  /yield/protocols  — List protocols with current APY
POST /yield/deposit    — Deposit shielded position to yield
GET  /yield/positions  — Get user's yield positions
POST /yield/withdraw   — Withdraw position with yield
GET  /yield/stats      — Aggregate vault statistics
```

### Files to Modify

**`/backend/api/__init__.py`** — Register yield router

---

## Phase 3: Frontend Types & API (1 day)

### Files to Create

**`/frontend/types/yield.ts`**
- `YieldProtocol`, `YieldPosition`, `YieldDepositResponse`, `YieldWithdrawResponse`

### Files to Modify

**`/frontend/lib/api.ts`** — Add:
- `getYieldProtocols()`
- `depositToYield(jobId, protocol)`
- `getYieldPositions(walletHash)`
- `withdrawYieldPosition(positionId, recipient)`
- `getYieldStats()`

---

## Phase 4: Frontend Store & Hook (2-3 days)

### Files to Create

**`/frontend/stores/yield.ts`**
- Zustand store with localStorage + Supabase sync
- `fetchProtocols()`, `fetchPositions()`, `addPosition()`, `updatePosition()`

**`/frontend/hooks/usePrivateYield.ts`**
- Status state machine: idle → deriving → generating → staking → confirming → success
- `deposit(position, protocol)` — full deposit flow
- `withdraw(yieldPosition, recipient)` — withdrawal flow
- Abort control, polling, error handling (follow useUnshield pattern)

---

## Phase 5: Frontend UI (2-3 days)

### Files to Modify

**`/frontend/app/private-yield/page.tsx`** — Replace Coming Soon with:
- Protocol selection cards (Jito active, Kamino coming soon)
- Shielded position selector dropdown
- Active yield positions list with withdraw buttons
- Deposit/Withdraw modals with status steps
- Vault stats section (TVL, APY, active positions)

---

## Phase 6: Testing (2 days)

### Files to Create

**`/backend/tests/test_yield_service.py`**
- Share calculation tests (empty vault, with existing deposits)
- Withdrawal calculation tests (principal + yield - fee)

**`/frontend/__tests__/hooks/usePrivateYield.test.ts`**
- State machine transitions
- API call mocking

---

## Phase 7: Documentation (1 day)

- Update `/docs/architecture/whalevault-technical-architecture.md`
- Update `/docs/plans/private-yield-design.md` → mark implemented
- Add yield section to `FOR[Dami].md`

---

## Verification

1. **Backend:** `pytest backend/tests/test_yield_service.py`
2. **Frontend:** `cd frontend && npm run typecheck`
3. **E2E:** Manual test deposit/withdraw flow on devnet
4. **API:** Test endpoints via curl or Postman

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| First protocol | Jito (~7-8% APY, lowest risk) |
| Accounting | Share-based (privacy-preserving) |
| Withdrawal | Full only (V1) |
| Fee | 5% of yield earned |
| Storage | Encrypted Supabase |

---

## Dependencies

- Jito Constants: `JITOSOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"`
- Jito Stats API: `https://kobe.mainnet.jito.network/api/v1/stake_pool_stats`
