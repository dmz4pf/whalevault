# WhaleVault Feature Feasibility Report

**Date:** 2026-01-27
**Scope:** Token swap during unshield + easily feasible features

---

## 1. Token Swap During Unshield

### Concept
User shields SOL → unshields as USDC (or another token). The swap happens atomically during the unshield transaction, adding another layer of privacy since the output token differs from the input.

### Feasibility: MEDIUM-HIGH (doable but non-trivial)

### Architecture

```
User shields 1 SOL into 1-SOL pool
         │
         ▼
User requests unshield (recipient wants USDC)
         │
         ▼
Relayer builds composite transaction:
  IX 1: unshield_sol → relayer receives SOL from vault
  IX 2: Jupiter swap SOL → USDC (CPI or separate IX)
  IX 3: Transfer USDC to recipient
```

### Technical Analysis

**Option A: On-chain CPI to Jupiter (Hard)**
- Modify Rust program to CPI into Jupiter aggregator
- Pros: Atomic, trustless
- Cons: Compute budget (~400k limit), Jupiter CPI complexity, program upgrade needed
- Verdict: **Too complex for current stage**

**Option B: Relayer-side swap (Recommended)**
- Unshield SOL to relayer wallet (existing flow)
- Relayer swaps SOL→token via Jupiter API (off-chain)
- Relayer sends token to recipient
- Pros: No program changes, leverages existing relayer
- Cons: Trust relayer for swap execution, two transactions (not atomic)
- Verdict: **Feasible with current architecture**

**Option C: Separate swap instruction in same TX (Medium)**
- Build transaction with: unshield IX + Jupiter swap IX
- Both in one Solana transaction (atomic)
- Relayer signs both
- Pros: Atomic, no program changes
- Cons: TX size limits, Jupiter IX construction complexity
- Verdict: **Best balance of effort and UX**

### Implementation Estimate (Option B)

| Component | Work |
|-----------|------|
| Backend: Jupiter API integration | New service (~200 LOC) |
| Backend: Swap route endpoint | New route (~80 LOC) |
| Backend: Relayer swap logic | Modify relayer_service.py |
| Frontend: Token selector on unshield | New component |
| Frontend: Swap quote display | API integration |
| Config: Jupiter API key, supported tokens | Minor |

### Privacy Implications
- **Positive**: Output token differs from input → harder to correlate
- **Negative**: Swap is visible on-chain (relayer → DEX → recipient)
- **Mitigation**: Use relayer's existing token balance as buffer (swap asynchronously)

### Risks
1. **Slippage**: Price moves between quote and execution
2. **Liquidity**: Low-liquidity pairs may fail
3. **Relayer balance**: Needs token reserves or real-time swaps
4. **Jupiter dependency**: External service, rate limits

### Verdict
**Go with Option B first** (relayer-side swap). Can upgrade to Option C later. This adds significant user value with moderate effort and zero on-chain program changes.

---

## 2. Easily Feasible Features (Ranked by Impact/Effort)

### Tier 1: Low Effort, High Impact

#### A. Deposit Receipts / Backup Notes
**Effort:** 1-2 hours | **Impact:** High (UX + Safety)

Export a JSON/encrypted file containing position data (commitment, secret, amount, denomination, pool address). Users can import this to recover funds if localStorage is lost.

- Frontend only change
- Add export/import buttons to position cards
- Encrypt with user's wallet signature

#### B. Pool Health Indicators
**Effort:** 2-3 hours | **Impact:** High (Privacy UX)

Show anonymity set quality per pool:
- 🔴 <5 deposits: "Low privacy"
- 🟡 5-20 deposits: "Moderate privacy"
- 🟢 20+ deposits: "Good privacy"
- Recommend waiting if pool is thin

Backend already returns `depositCount`. Just needs frontend visualization.

#### C. Transaction History View
**Effort:** 3-4 hours | **Impact:** Medium-High (UX)

Display shield/unshield history with:
- Timestamps
- Amounts
- Status (shielded/unshielded/pending)
- Explorer links (Solscan)

Data already in localStorage positions. Add a `/history` page.

#### D. Time-Delayed Withdrawals
**Effort:** 2-3 hours | **Impact:** High (Privacy)

Suggest or enforce minimum wait time between shield and unshield:
- "Wait at least 1 hour for better privacy"
- Show countdown timer on positions
- Optional: backend enforces minimum delay

Frontend + minor backend validation. No on-chain changes.

### Tier 2: Medium Effort, High Impact

#### E. Multiple Recipient Splits
**Effort:** 4-5 hours | **Impact:** Medium-High

Unshield to multiple addresses in one operation:
- User enters 2-3 recipients with amounts
- Relayer submits multiple unshield TXs
- Breaks amount correlation further

Backend: batch relay endpoint. Frontend: multi-recipient form.

#### F. Relayer Status Dashboard
**Effort:** 3-4 hours | **Impact:** Medium (Ops)

Show relayer health:
- Balance remaining
- Transactions relayed
- Uptime status
- Fee earned

Backend: new `/relay/stats` endpoint. Frontend: admin/status page.

#### G. SPL Token Shielding (USDC)
**Effort:** 6-8 hours | **Impact:** High

On-chain program already supports SPL tokens. Need:
- Backend: expose `shield`/`unshield` (SPL) routes
- Frontend: token selector component
- Config: USDC mint address, decimals

Biggest effort is frontend token selection UX and testing with devnet USDC.

#### H. QR Code for Receiving
**Effort:** 2-3 hours | **Impact:** Medium (UX)

Generate QR codes containing recipient address for mobile-friendly unshield:
- Encode Solana address as QR
- Scan to fill recipient field
- Share link with embedded address

Frontend-only. Use `qrcode.react` library.

### Tier 3: Higher Effort, Strategic

#### I. Compliance Proofs (Opt-in)
**Effort:** 8-10 hours | **Impact:** Strategic

Allow users to optionally prove they own a shielded position without revealing which one:
- "I have funds in WhaleVault" proof
- Useful for compliance/audits
- ZK proof of membership without revealing position

Requires new circuit and proof type. Strategic for legitimacy.

#### J. Cross-Pool Transfers
**Effort:** 10-12 hours | **Impact:** High (Privacy)

Move funds between denomination pools without unshielding:
- Shield 10 SOL in 10-SOL pool
- Transfer to 10x 1-SOL pool entries
- Better denomination flexibility

On-chain program changes needed. Complex but powerful.

---

## 3. Codebase Critique

### Strengths
- **Clean separation**: Backend/Frontend/On-chain are well-isolated
- **Relayer pattern**: Correct approach for privacy (user never signs unshield)
- **Multi-pool architecture**: Good foundation for denomination privacy
- **Deterministic secret derivation**: Elegant recovery mechanism

### Issues Found

#### Critical
1. **Position type missing `denomination` field** — Unshield will fail for non-custom pools since the correct pool PDA can't be derived. Must add `denomination` and `poolAddress` to Position type before Volume 2 is usable.

2. **MVP proofs are not secure** — Current proof system accepts any 96-byte input as valid. Fine for devnet but must be flagged prominently.

#### Important
3. **No retry logic for relayer** — If Solana TX fails, the unshield silently fails. Need retry with exponential backoff.

4. **localStorage is the only position store** — If cleared, funds are lost. Backup/export feature (item A above) should be priority.

5. **Relayer has no balance monitoring** — Will silently fail when SOL runs out.

#### Minor
6. **Hardcoded devnet RPC** in frontend constants — Should be environment-driven.

7. **No rate limiting** on API endpoints — Could be abused.

8. **Pool status endpoint returns mock data** when pool doesn't exist on-chain — Should return explicit "not initialized" status.

---

## 4. Recommended Roadmap

### Immediate (Before V2 frontend launch)
1. Fix Position type to include `denomination` (blocking)
2. Add deposit receipt export (safety net)

### Next Sprint
3. Pool health indicators (privacy UX)
4. Time-delayed withdrawal suggestions (privacy)
5. Transaction history page (UX)

### Following Sprint
6. Token swap via relayer (Option B)
7. SPL token shielding (USDC)
8. Relayer status dashboard

### Future
9. Compliance proofs
10. Cross-pool transfers
11. Groth16 proof system (production security)

---

## Summary

| Feature | Feasibility | Effort | Impact | Priority |
|---------|------------|--------|--------|----------|
| Token swap (relayer) | ✅ High | Medium | High | P1 |
| Deposit receipts | ✅ Very High | Low | High | P0 |
| Pool health indicators | ✅ Very High | Low | High | P0 |
| Time-delayed withdrawals | ✅ Very High | Low | High | P1 |
| Transaction history | ✅ Very High | Low | Medium | P1 |
| Multi-recipient splits | ✅ High | Medium | Medium | P2 |
| SPL token shielding | ✅ High | Medium | High | P2 |
| QR codes | ✅ Very High | Low | Medium | P2 |
| Relayer dashboard | ✅ High | Medium | Medium | P2 |
| Compliance proofs | ⚠️ Medium | High | Strategic | P3 |
| Cross-pool transfers | ⚠️ Medium | High | High | P3 |
| Token swap (on-chain CPI) | ❌ Low | Very High | High | P4 |
