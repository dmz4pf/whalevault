# Private Yield — Design Document

**Version:** 0.1 (Research & Framework)
**Date:** January 29, 2026
**Status:** Future Feature — Coming Soon

---

## 1. Executive Summary

**Private Yield** enables users to earn yield on their shielded assets without revealing position size, identity, or strategy on-chain. It acts as a **privacy wrapper** around existing Solana yield protocols.

### The Problem

Today, earning yield on Solana exposes everything:
- Your deposit amount is visible
- Your wallet address is linked to the position
- Your yield strategy is public knowledge
- Competitors, adversaries, and MEV bots can front-run or copy your moves

Whales and institutions avoid DeFi yield because **visibility = vulnerability**.

### The Solution

WhaleVault becomes a **privacy-preserving yield aggregator**:
1. Users deposit into WhaleVault's shielded pools (existing flow)
2. WhaleVault's vault aggregates deposits and deploys to yield protocols
3. Individual user positions remain hidden — only the vault's aggregate position is visible
4. Users withdraw with accumulated yield, breaking the link between depositor and recipient

**On-chain observers see:** "WhaleVault vault deposited 10,000 SOL into Kamino"
**They don't see:** Who owns what share, individual deposit sizes, or withdrawal patterns

---

## 2. Yield Protocol Research

### 2.1 Solana Yield Landscape

| Protocol | Type | Current APY | TVL | Integration Complexity |
|----------|------|-------------|-----|------------------------|
| **Kamino Finance** | Lending + LP Vaults | 5-15% | $1.2B+ | Medium — SDK available |
| **MarginFi** | Lending/Borrowing | 4-12% | $800M+ | Medium — Program CPI |
| **Jito** | Liquid Staking (jitoSOL) | 7-8% | $2B+ | Low — Simple stake |
| **Marinade** | Liquid Staking (mSOL) | 6-7% | $1.5B+ | Low — Simple stake |
| **Drift** | Perps + Lending | 5-20% | $400M+ | High — Complex state |
| **Solend/Save** | Lending | 3-8% | $300M+ | Medium — CPI |
| **Meteora** | LP Vaults | 10-50% (volatile) | $200M+ | Medium — Dynamic fees |

### 2.2 Recommended First Integration: Jito (Liquid Staking)

**Why Jito?**

1. **Simplest integration** — Deposit SOL, receive jitoSOL, that's it
2. **No liquidation risk** — Unlike lending, no collateral management needed
3. **Predictable yield** — ~7-8% APY from MEV rewards + staking
4. **Highly liquid** — Easy to convert back to SOL
5. **Battle-tested** — $2B+ TVL, audited, reliable

**How it works:**
```
User shields 10 SOL → WhaleVault pool
WhaleVault stakes aggregate → Receives jitoSOL
jitoSOL appreciates over time (yield)
User unshields → Gets 10.07 SOL (after 1 month @ 8% APY)
```

### 2.3 Second Integration: Kamino Lending

After Jito, Kamino lending is the next logical step:
- Higher yields (10-15% on SOL lending)
- Slightly more complex (need to track utilization, rates)
- Still no liquidation risk when lending (only borrowing has risk)

### 2.4 What We're NOT Building (V1)

- Leveraged yield strategies (too risky for privacy vault users)
- LP positions (impermanent loss complexity)
- Borrowing (liquidation risk)
- Multi-protocol optimization (complexity explosion)

---

## 3. Architecture Approach

### 3.1 Privacy Wrapper Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER VIEW                                    │
│  "I shielded 10 SOL. It's earning ~7% yield. I can withdraw anytime."│
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   WhaleVault Frontend  │
                    │  - Shows yield APY     │
                    │  - Shows accrued yield │
                    │  - Withdraw with yield │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                       WHALEVAULT BACKEND                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Yield Aggregation Layer                   │    │
│  │  - Tracks user shares (private, encrypted in Supabase)      │    │
│  │  - Manages aggregate position in yield protocol              │    │
│  │  - Calculates yield distribution                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   ON-CHAIN VISIBILITY  │
                    │  "WhaleVault vault"    │
                    │   deposited to Jito    │
                    │   (aggregate only)     │
                    └────────────────────────┘
```

### 3.2 Share Accounting Model

Each user's position is tracked as **shares** of the aggregate yield position:

```typescript
interface YieldPosition {
  id: string;
  userId: string;                    // Wallet hash (privacy-preserving)
  shares: number;                    // User's share of the aggregate
  depositAmount: number;             // Original SOL deposited
  depositTimestamp: string;          // When deposited
  yieldProtocol: 'jito' | 'kamino';  // Which protocol
  status: 'active' | 'withdrawing' | 'withdrawn';
}

// Aggregate state (on-chain visible)
interface YieldVaultState {
  totalShares: number;               // Sum of all user shares
  totalDeposited: number;            // Total SOL in yield protocol
  currentValue: number;              // Current value (deposits + yield)
  protocolToken: string;             // e.g., jitoSOL mint
  protocolBalance: number;           // e.g., jitoSOL balance
}

// Calculate user's current value
function getUserValue(position: YieldPosition, vault: YieldVaultState): number {
  const shareRatio = position.shares / vault.totalShares;
  return shareRatio * vault.currentValue;
}
```

### 3.3 Flow: Deposit to Yield

```
1. User has shielded position (existing flow)
2. User clicks "Earn Yield" → selects Jito
3. Frontend: POST /api/yield/deposit
   - commitment, secret, amount, protocol: 'jito'
4. Backend:
   a. Generates unshield proof
   b. Relayer unshields SOL to WhaleVault operational wallet
   c. Backend stakes SOL with Jito → receives jitoSOL
   d. Creates YieldPosition record (encrypted in Supabase)
   e. Updates YieldVaultState
5. Frontend: Shows active yield position with APY
```

### 3.4 Flow: Withdraw with Yield

```
1. User clicks "Withdraw" on yield position
2. Frontend: POST /api/yield/withdraw
   - yieldPositionId, recipientAddress
3. Backend:
   a. Calculates user's share value (principal + yield)
   b. Unstakes proportional jitoSOL → receives SOL
   c. Relayer sends SOL to recipient address
   d. Marks YieldPosition as withdrawn
4. Frontend: Shows success with breakdown
   - Principal: 10 SOL
   - Yield earned: 0.07 SOL
   - Total received: 10.07 SOL
```

### 3.5 Yield Tracking & Display

```typescript
// Fetch current APY from protocol
async function getCurrentAPY(protocol: 'jito' | 'kamino'): Promise<number> {
  switch (protocol) {
    case 'jito':
      // Jito APY = (jitoSOL/SOL rate appreciation) annualized
      return await fetchJitoAPY();
    case 'kamino':
      return await fetchKaminoLendingAPY();
  }
}

// Calculate user's accrued yield
function getAccruedYield(position: YieldPosition, vault: YieldVaultState): number {
  const currentValue = getUserValue(position, vault);
  return currentValue - position.depositAmount;
}
```

---

## 4. API Design

### 4.1 New Endpoints

```typescript
// Get available yield protocols and their current APY
GET /api/yield/protocols
Response: {
  protocols: [
    { id: 'jito', name: 'Jito Staking', apy: 7.8, risk: 'low', status: 'active' },
    { id: 'kamino', name: 'Kamino Lending', apy: 12.3, risk: 'medium', status: 'coming_soon' }
  ]
}

// Deposit shielded position into yield
POST /api/yield/deposit
Request: {
  commitment: string,
  secret: string,
  amount: number,
  protocol: 'jito' | 'kamino'
}
Response: {
  jobId: string,
  status: 'pending'
}

// Get user's yield positions
GET /api/yield/positions
Response: {
  positions: YieldPosition[]
}

// Withdraw yield position
POST /api/yield/withdraw
Request: {
  yieldPositionId: string,
  recipientAddress: string
}
Response: {
  jobId: string,
  status: 'pending'
}

// Get yield vault stats (public, aggregate only)
GET /api/yield/stats
Response: {
  totalValueLocked: number,
  protocols: [
    { id: 'jito', tvl: 50000, apy: 7.8 }
  ]
}
```

---

## 5. Data Models

### 5.1 Frontend Types

```typescript
// types/yield.ts
interface YieldProtocol {
  id: 'jito' | 'kamino';
  name: string;
  description: string;
  apy: number;              // Current APY as percentage
  riskLevel: 'low' | 'medium' | 'high';
  status: 'active' | 'coming_soon' | 'paused';
  minDeposit: number;       // Minimum SOL
  icon: string;             // Protocol icon URL
}

interface YieldPosition {
  id: string;
  protocol: YieldProtocol['id'];
  depositAmount: number;    // Original deposit in lamports
  currentValue: number;     // Current value including yield
  accruedYield: number;     // Yield earned in lamports
  apy: number;              // APY at time of deposit
  status: 'active' | 'withdrawing' | 'withdrawn';
  depositedAt: string;      // ISO timestamp
  withdrawnAt?: string;     // ISO timestamp if withdrawn
}

// Zustand store
interface YieldState {
  positions: YieldPosition[];
  protocols: YieldProtocol[];
  loading: boolean;

  // Actions
  fetchProtocols: () => Promise<void>;
  fetchPositions: () => Promise<void>;
  deposit: (commitment: string, secret: string, amount: number, protocol: string) => Promise<void>;
  withdraw: (positionId: string, recipient: string) => Promise<void>;
}
```

### 5.2 Backend Models

```python
# models/yield.py
from pydantic import BaseModel
from enum import Enum
from typing import Optional

class YieldProtocol(str, Enum):
    JITO = "jito"
    KAMINO = "kamino"

class YieldDepositRequest(BaseModel):
    commitment: str
    secret: str
    amount: int
    protocol: YieldProtocol

class YieldWithdrawRequest(BaseModel):
    yield_position_id: str
    recipient_address: str

class YieldPositionResponse(BaseModel):
    id: str
    protocol: YieldProtocol
    deposit_amount: int
    current_value: int
    accrued_yield: int
    apy: float
    status: str
    deposited_at: str
    withdrawn_at: Optional[str]
```

---

## 6. Security Considerations

### 6.1 Trust Model

| Component | Trust Level | Mitigation |
|-----------|-------------|------------|
| WhaleVault Backend | Semi-trusted | Open-source, auditable; operational wallet is hot |
| Yield Protocol (Jito) | External trust | Only use audited, battle-tested protocols |
| Supabase | Zero-knowledge | All position data encrypted client-side |
| User's secret | User-controlled | Never leaves client except for proof generation |

### 6.2 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Yield protocol hack | Low | High | Start with Jito (most battle-tested), cap exposure |
| WhaleVault operational wallet compromise | Low | High | Multi-sig for large withdrawals, insurance fund |
| Share calculation errors | Medium | Medium | Extensive testing, audit, conservative rounding |
| User front-running withdrawals | Low | Low | Time-lock on large withdrawals, FIFO queue |
| jitoSOL depeg | Very Low | Medium | Monitor exchange rate, pause if >1% deviation |

### 6.3 Operational Security

- **Operational wallet**: Multi-sig (2/3) for transactions > 100 SOL
- **Rate limits**: Max 100 SOL deposit per user per day initially
- **Circuit breaker**: Auto-pause if vault value drops >5% unexpectedly
- **Monitoring**: Real-time alerts for unusual activity

---

## 7. UI/UX Design

### 7.1 New Page: `/private-yield`

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Private Yield                                │
│  Earn yield on your shielded assets without revealing your position │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  YOUR YIELD POSITIONS                                          │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ 🔷 Jito Staking                           Active         │  │ │
│  │  │    Deposited: 10.0000 SOL                                │  │ │
│  │  │    Current Value: 10.0712 SOL (+0.71%)                   │  │ │
│  │  │    APY: 7.8%                                             │  │ │
│  │  │    [Withdraw]                                            │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  DEPOSIT TO YIELD                                              │ │
│  │                                                                │ │
│  │  Select Shielded Position:                                     │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ ◉ 10 SOL Pool — Shielded Jan 28                         │  │ │
│  │  │ ○ 1 SOL Pool — Shielded Jan 25                          │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  Select Yield Protocol:                                        │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ ◉ Jito Staking — 7.8% APY (Low Risk)                    │  │ │
│  │  │ ○ Kamino Lending — 12.3% APY (Medium Risk) — Coming Soon│  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  [Deposit to Yield]                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  VAULT STATS (Aggregate)                                       │ │
│  │  Total Value Locked: 50,000 SOL                                │ │
│  │  Protocols: Jito (100%)                                        │ │
│  │  Anonymity Set: 127 depositors                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Coming Soon State (V1 Implementation)

For initial launch, the page shows:
- Feature description and value proposition
- Protocol comparison (Jito, Kamino, etc.)
- "Notify Me" email signup
- Expected launch date

---

## 8. Implementation Phases

### Phase 1: Coming Soon Page (Now)
- [ ] Create `/private-yield` page with coming soon UI
- [ ] Add to navigation (opens in new tab)
- [ ] Email signup for notifications
- [ ] Update PRD and architecture docs

### Phase 2: Jito Integration (Future — 2-3 weeks)
- [ ] Backend: Jito SDK integration
- [ ] Backend: Share accounting system
- [ ] Backend: Yield position storage (encrypted)
- [ ] Frontend: Deposit flow
- [ ] Frontend: Position display with live APY
- [ ] Frontend: Withdraw flow
- [ ] Testing: Unit + integration tests

### Phase 3: Kamino Integration (Future — 2 weeks after Phase 2)
- [ ] Backend: Kamino lending integration
- [ ] Frontend: Protocol selector
- [ ] Risk display and user acknowledgment

### Phase 4: Advanced Features (Future)
- [ ] Auto-compound yield
- [ ] Yield comparison across protocols
- [ ] Historical yield tracking
- [ ] Yield notifications

---

## 9. Open Questions

1. **Multi-protocol deposits**: Can a user have multiple yield positions across different protocols?
   - **Proposed**: Yes, treat each deposit as separate position

2. **Partial withdrawals**: Can users withdraw part of a yield position?
   - **Proposed**: V1 = full withdrawal only; V2 = partial supported

3. **Yield claiming vs compounding**: Claim yield separately or auto-compound?
   - **Proposed**: Auto-compound for simplicity (jitoSOL naturally does this)

4. **Minimum deposit**: What's the minimum for yield positions?
   - **Proposed**: Match pool denominations (1, 10, 100, 1000 SOL)

5. **Fee structure**: Does WhaleVault take a cut of yield?
   - **Proposed**: 5% of yield earned (not principal), disclosed clearly

---

## 10. Success Metrics

| Metric | Target (6 months post-launch) |
|--------|-------------------------------|
| TVL in yield | $1M+ |
| Active yield positions | 100+ |
| Average position duration | 30+ days |
| User retention (re-deposit rate) | >50% |
| Zero security incidents | Yes |

---

*Document created: January 29, 2026*
*Status: Research complete, ready for Coming Soon implementation*
