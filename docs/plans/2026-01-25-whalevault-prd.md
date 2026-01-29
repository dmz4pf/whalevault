# WhaleVault PRD
## Privacy-First Treasury Migration Tool for Solana

**Version:** 3.0
**Date:** January 27, 2026 (updated from v1.0 Jan 25)
**Target:** Solana Privacy Hackathon 2026 ($20,000-$24,500 prize)

---

## 1. Executive Summary

### The Problem
Large Solana wallet holders ("whales") face a critical privacy problem: moving significant funds creates visible on-chain footprints that enable:
- **Front-running** by MEV bots watching mempool
- **Social engineering** attacks based on known holdings
- **Market manipulation** by adversaries tracking whale movements
- **DAO treasury exposure** revealing strategic positions

Current solutions either don't exist on Solana or require complex multi-step processes that whales avoid.

### The Solution
**WhaleVault** is a privacy-first treasury migration tool that enables large holders to shield, withdraw, and swap assets using zero-knowledge proofs on Solana. Built on the Veil SDK, it provides:
- One-click privacy deposits into fixed-denomination pools (shield)
- Anonymous withdrawals to new addresses via relayer (stealth withdraw)
- **Private swaps** — withdraw shielded SOL as any token to any wallet (via Jupiter)
- Encrypted cloud backup of positions via Supabase (zero-knowledge to the server)
- Real-time ZK proof generation with visual feedback
- Opt-in privacy delays to reduce timing correlation

### Success Metric
A working demo where a user can:
1. Connect wallet
2. Shield 1 SOL into a denomination pool
3. Wait for proof generation (with animated feedback)
4. Stealth withdraw to a different address — OR private swap to USDC at a different address
5. Verify the link is broken on-chain (different wallet AND optionally different token)
6. Disconnect, reconnect — positions restored from encrypted cloud backup

---

## 2. Solution Overview

### 2.1 Core User Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         WhaleVault Flow                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. CONNECT        2. SHIELD         3. STEALTH        4. PRIVATE    │
│                                         WITHDRAW          SWAP       │
│  ┌─────────┐      ┌─────────┐       ┌──────────┐     ┌──────────┐   │
│  │ Wallet  │─────▶│ Deposit │──┬───▶│ Withdraw │     │ Withdraw │   │
│  │ + Sign  │      │ SOL into│  │    │ SOL via  │     │ as any   │   │
│  │ encrypt │      │  pool   │  │    │ relayer  │     │ token    │   │
│  │ message │      └────┬────┘  │    └────┬─────┘     └────┬─────┘   │
│  └────┬────┘           │       │         │                 │         │
│       │                ▼       │         ▼                 ▼         │
│       ▼          ┌──────────┐  │    ┌──────────┐     ┌──────────┐   │
│  ┌──────────┐    │Commitment│  │    │ Relayer  │     │ Jupiter  │   │
│  │ Supabase │    │ On-Chain │  │    │ submits  │     │ swap +   │   │
│  │ encrypted│    └──────────┘  │    │ to chain │     │ send to  │   │
│  │ backup   │                  │    └──────────┘     │recipient │   │
│  └──────────┘                  │                     └──────────┘   │
│                                │                                     │
│                                └── Positions backed up to Supabase   │
│                                    (encrypted, zero-knowledge)       │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Features

| Feature | Description | Priority | Volume |
|---------|-------------|----------|--------|
| **Shield SOL** | Deposit SOL into fixed-denomination pools | P0 | V1 |
| **Stealth Withdraw** | Withdraw SOL via relayer to any address | P0 | V1+V2 |
| **Multi-Pool Denominations** | 1, 10, 100, 1000 SOL pools | P0 | V2 |
| **Relayer** | User never signs withdraw tx — relayer submits | P0 | V2 |
| **Wallet Connect** | Phantom, Solflare, Backpack support | P0 | V1 |
| **Proof Status** | Real-time generation progress | P0 | V1 |
| **Private Swap** | Withdraw shielded SOL as any token via Jupiter | P0 | V3 |
| **Encrypted Cloud Backup** | Positions auto-synced to Supabase (AES-256-GCM) | P0 | V3 |
| **Transaction History** | Full history page with filters, powered by Supabase | P1 | V3 |
| **Privacy Delays** | Opt-in time delay (1h/6h/24h) to reduce timing correlation | P1 | V3 |
| **Deposit Receipts** | Encrypted offline backup export/import | P1 | V3 |
| **Pool Health Indicators** | Anonymity set quality per pool | P1 | V4 |
| **UI Enhancement** | Premium visual polish, animations, glassmorphism | P1 | V3.1 |

### 2.3 Future Features (Roadmap)

| Feature | Description | Status |
|---------|-------------|--------|
| **Private Yield** | Earn yield on shielded assets via Jito/Kamino without revealing position | Coming Soon |
| **SPL Token Shielding** | Shield USDC, USDT, and other SPL tokens directly | Planned |
| **Multi-sig Vaults** | Squads-style governance for institutional treasuries | Planned |
| **Viewing Keys** | Selective disclosure for compliance/auditing | Planned |

### 2.4 What We're NOT Building (V1)

- ❌ SPL token shielding (SOL-only deposits; USDC "Coming Soon" in UI)
- ❌ Private transfers between users
- ❌ Mobile native app
- ❌ Multi-sig support
- ❌ On-chain CPI swaps (using relayer-side Jupiter swap instead)
- ❌ Cross-pool transfers

---

## 3. Technical Architecture

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │   Shield   │ │  Stealth   │ │  Private   │ │  History   │       │
│  │    Flow    │ │  Withdraw  │ │   Swap     │ │   Page     │       │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘       │
│        │              │              │              │               │
│        └──────────────┼──────────────┘              │               │
│                       │                              │               │
│                       ▼                              ▼               │
│         ┌───────────────────────┐      ┌───────────────────────┐    │
│         │  @solana/web3.js      │      │  Supabase Client      │    │
│         │  @solana/wallet-adapter│      │  + AES-256-GCM        │    │
│         └───────────┬───────────┘      │  encryption layer     │    │
│                     │                  └───────────┬───────────┘    │
└─────────────────────┼──────────────────────────────┼────────────────┘
                      │                              │
                      ▼                              ▼
┌─────────────────────────────────────┐   ┌──────────────────────┐
│           BACKEND (FastAPI)          │   │     SUPABASE         │
│  ┌──────────┐ ┌──────────┐          │   │  ┌────────────────┐  │
│  │ /shield  │ │  /relay   │          │   │  │  vault_data    │  │
│  │ /unshield│ │  /swap    │          │   │  │  (encrypted)   │  │
│  │ /pool    │ │  /health  │          │   │  └────────────────┘  │
│  └────┬─────┘ └────┬─────┘          │   └──────────────────────┘
│       │            │                 │
│       ▼            ▼                 │
│  ┌──────────┐ ┌──────────┐          │
│  │ Veil SDK │ │ Relayer  │──────┐   │
│  │ (proofs) │ │ Service  │      │   │
│  └────┬─────┘ └──────────┘      │   │
│       │                          │   │
└───────┼──────────────────────────┼───┘
        │                          │
        ▼                          ▼
┌───────────────────────┐  ┌──────────────────┐
│     SOLANA DEVNET      │  │   JUPITER API    │
│  ┌──────────────────┐  │  │  (token swaps)   │
│  │ Multi-Pool PDAs  │  │  └──────────────────┘
│  │ (1,10,100,1K SOL)│  │
│  │ Vault PDAs       │  │
│  │ Nullifier PDAs   │  │
│  └──────────────────┘  │
│                         │
│  Program: F3NLg...      │
└─────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14 + TypeScript | SSR, great DX, Vercel deployment |
| **Styling** | Tailwind CSS + Framer Motion | Rapid UI, smooth animations |
| **Wallet** | @solana/wallet-adapter | Standard Solana wallet integration |
| **Backend** | FastAPI (Python 3.11+) | Async, great for Veil SDK integration |
| **ZK Layer** | Veil SDK | Python bindings to Rust crypto core |
| **On-Chain** | Anchor 0.29 | Solana program framework |
| **Crypto** | Groth16 + BN254 | ~7,000 constraints, ~200k CU |
| **Storage** | Supabase (PostgreSQL) | Encrypted position backup, zero-knowledge to server |
| **Encryption** | AES-256-GCM (Web Crypto API) | Client-side encryption of all position data |
| **Swaps** | Jupiter Aggregator API | Token swaps for Private Swap feature |
| **Relayer** | Backend-hosted keypair | Submits withdraw/swap txs on user's behalf |

### 3.3 Data Flow

#### Shield (Deposit) Flow:
```
User → Frontend → Backend.generate_commitment(amount, denomination) → Veil SDK
                                                                         │
User ← Frontend ← { commitment, secret, instruction } ←─────────────────┘
         │
         ├── Sign Transaction → Solana: shield_sol(commitment, amount)
         │                         → Pool receives SOL, commitment in Merkle tree
         │
         └── Encrypt position → Supabase: vault_data(wallet_hash, encrypted_blob)
```

#### Stealth Withdraw Flow:
```
User → Frontend → Backend.generate_proof(commitment, secret, recipient)
                                              │
                    Veil SDK generates proof   │
                                              │
Frontend ← { proof, nullifier } ←─────────────┘
         │
         └── POST /relay/unshield → Relayer signs & submits tx
                                       → SOL sent to recipient
                                       → Position marked spent in Supabase
```

#### Private Swap Flow:
```
User → Frontend → GET /swap/quote(amount, outputMint) → Jupiter API
                                                            │
Frontend ← { rate, outputAmount, slippage } ←───────────────┘
         │
         └── POST /swap/execute(commitment, secret, recipient, outputMint)
                  │
                  Backend: 1. Generate proof
                           2. Relayer unshields SOL to relayer wallet
                           3. Relayer swaps SOL → token via Jupiter
                           4. Relayer sends token to recipient
                  │
Frontend ← { txSignatures, status } ←──────────────────────────────────┘
         │
         └── Position marked spent in Supabase with swap metadata
```

### 3.4 API Endpoints

| Endpoint | Method | Purpose | Volume |
|----------|--------|---------|--------|
| `POST /api/shield/prepare` | POST | Generate commitment for deposit | V1 |
| `POST /api/unshield/proof` | POST | Generate ZK proof for withdrawal | V1 |
| `GET /api/pool/status` | GET | Get pool statistics | V1 |
| `GET /api/pool/status/{denomination}` | GET | Get specific pool stats | V2 |
| `GET /api/proof/status/{id}` | GET | Check proof generation progress | V1 |
| `GET /api/relay/info` | GET | Relayer status and fee info | V2 |
| `POST /api/relay/unshield` | POST | Submit withdrawal via relayer | V2 |
| `GET /api/swap/quote` | GET | Get Jupiter swap quote | V3 |
| `POST /api/swap/execute` | POST | Execute private swap via relayer | V3 |
| `GET /api/health` | GET | Backend health check | V1 |

---

## 4. User Interface & UX

### 4.1 Screen Flow (6 Screens)

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Nav: Dashboard | Shield | Stealth Withdraw | Private Swap | History
│                                                                    │
│  1. CONNECT      2. DASHBOARD     3. SHIELD                       │
│  ┌───────┐       ┌───────────┐    ┌──────────────┐                │
│  │ Hero  │──────▶│Pool Stats │───▶│ Token Select │                │
│  │Wallet │       │Positions  │    │ Denomination │                │
│  │+Sign  │       │ Activity  │    │ Amount+Sign  │                │
│  └───────┘       └─────┬─────┘    └──────────────┘                │
│                        │                                           │
│           ┌────────────┼────────────┐                              │
│           ▼            ▼            ▼                              │
│  4. STEALTH       5. PRIVATE    6. HISTORY                        │
│     WITHDRAW         SWAP                                         │
│  ┌──────────┐    ┌──────────┐   ┌──────────────┐                  │
│  │ Position │    │ Position │   │ Filter tabs  │                  │
│  │Recipient │    │ Token    │   │ All txs      │                  │
│  │ Delay?   │    │Recipient │   │ Export/Import│                  │
│  │ Confirm  │    │ Quote    │   └──────────────┘                  │
│  └──────────┘    │ Confirm  │                                     │
│                  └──────────┘                                     │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Screen Details

#### Screen 1: Connect (Landing)
- Hero section with value proposition
- Animated gradient background
- "Connect Wallet" CTA — signs encryption message on connect
- Supported wallets: Phantom, Solflare, Backpack

#### Screen 2: Dashboard
- **Pool Stats Card:** TVL per denomination, total deposits, anonymity sets
- **Your Positions:** Shielded positions with amounts, timestamps, privacy delay countdown
- **Quick Actions:** Shield / Stealth Withdraw / Private Swap buttons

#### Screen 3: Shield Flow
- Token selector (SOL active, USDC "Coming Soon" disabled)
- Denomination selector (1, 10, 100, 1000 SOL) with privacy indicators
- Custom amount option (reduced privacy warning)
- Transaction preview → sign → confirmation
- Position auto-saved to Supabase (encrypted)

#### Screen 4: Stealth Withdraw
- Select shielded position
- Enter recipient address
- Privacy delay toggle (opt-in): 1h / 6h / 24h presets
- Recommendation nudge: "Delays make your withdrawal harder to trace"
- If delayed: countdown timer, withdraw button disabled until expired
- Confirm → proof generation → relayer submits → success

#### Screen 5: Private Swap
- Select shielded position
- Enter recipient address
- Token selector (searchable dropdown, featured tokens pinned)
- Jupiter quote display: exchange rate, output amount, slippage, price impact
- Confirm → proof generation → relayer unshields → swaps → sends token

#### Screen 6: History
- Filter tabs: All | Shield | Stealth Withdraw | Private Swap
- Each entry: type, amount, status, timestamp, Solscan link
- Private Swap entries: output token + amount
- Export backup receipt button
- Import backup button

### 4.3 UI Polish Features (V3.1)

| Feature | Implementation |
|---------|----------------|
| **Dark Mode** | Default, with subtle gradients |
| **Glassmorphism** | Frosted glass card effects (V3.1) |
| **ZK Proof Animation** | Particle system showing "proof generating" |
| **Success Confetti** | Canvas-confetti on successful transactions |
| **Toast Notifications** | Sonner for all status updates |
| **Skeleton Loading** | Shimmer placeholders during data fetch |
| **Mobile Responsive** | Full mobile support |
| **Page Transitions** | Fade/slide between routes (V3.1) |
| **Animated Counters** | Pool stats, countdown timers (V3.1) |

### 4.4 Component Architecture

```
frontend/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── MobileNav.tsx
│   ├── wallet/
│   │   ├── WalletProvider.tsx
│   │   └── ConnectButton.tsx
│   ├── dashboard/
│   │   ├── PoolStats.tsx
│   │   └── PositionCard.tsx
│   ├── shield/
│   │   ├── DenominationSelector.tsx
│   │   └── PrivacyWarning.tsx
│   ├── unshield/
│   │   ├── PositionSelector.tsx
│   │   └── RecipientInput.tsx
│   ├── swap/
│   │   ├── TokenSelector.tsx
│   │   └── SwapQuote.tsx
│   ├── history/
│   │   ├── TransactionList.tsx
│   │   └── TransactionCard.tsx
│   └── shared/
│       ├── ProofAnimation.tsx
│       └── SuccessConfetti.tsx
├── hooks/
│   ├── useShield.ts
│   ├── useUnshield.ts
│   ├── usePrivateSwap.ts
│   ├── useVaultStorage.ts
│   ├── usePools.ts
│   └── useProofStatus.ts
├── lib/
│   ├── api.ts
│   ├── supabase.ts
│   ├── encryption.ts
│   ├── tokens.ts
│   ├── receipt.ts
│   ├── constants.ts
│   └── utils.ts
└── app/
    ├── page.tsx (landing)
    ├── dashboard/page.tsx
    ├── shield/page.tsx
    ├── unshield/page.tsx (Stealth Withdraw)
    ├── private-swap/page.tsx
    └── history/page.tsx
```

---

## 5. Security Requirements

### 5.1 Smart Contract Security

| Layer | Protection |
|-------|------------|
| **Double-spend** | Nullifier PDAs - attempting to reuse creates duplicate account error |
| **Overflow** | `overflow-checks = true` in release profile |
| **Authority** | Pool PDA seeds, vault authority validation |
| **Reentrancy** | Anchor's account validation + Solana's execution model |

### 5.2 Cryptographic Security

| Component | Implementation |
|-----------|----------------|
| **ZK Proofs** | Groth16 with BN254 curve, ~128-bit security |
| **Commitments** | Pedersen hash (hiding + binding) |
| **Merkle Tree** | Poseidon hash, depth 20 |
| **Randomness** | OS-level CSPRNG via `rand` crate |

### 5.3 Frontend Security

- **Client-side encryption** — all position data (including secrets) encrypted with AES-256-GCM before leaving the browser
- **Wallet-derived encryption key** — key derived from wallet signature of fixed message; deterministic and recoverable
- **Wallet hash for lookup** — SHA-256 of wallet pubkey stored in Supabase; not reversible to on-chain address
- **Supabase sees nothing useful** — encrypted blob + hash + timestamp; no queryable position data
- **Wallet adapter** — standard Solana wallet security
- **HTTPS only** — TLS for all API calls
- **Input validation** — amount bounds, address format, token mint validation

### 5.4 Backend Security

- **No private keys** — backend never touches user wallet keys
- **Relayer keypair** — backend holds relayer keypair for submitting txs on user's behalf
- **Rate limiting** — prevent proof generation and swap spam
- **Input sanitization** — all user inputs validated
- **Stateless** — no session storage; relayer is only stateful component
- **Jupiter API** — quotes validated server-side before swap execution

---

## 6. Success Metrics

### 6.1 Hackathon Demo Metrics (Primary)

| Metric | Target |
|--------|--------|
| Shield SOL | Works in < 30s |
| Unshield SOL | Works in < 45s |
| UI Responsiveness | No jank, smooth animations |
| Error Handling | Graceful failures with clear messages |
| Live Demo | Complete flow without crashes |

### 6.2 Technical Metrics

| Metric | Target |
|--------|--------|
| Proof Generation | < 10 seconds |
| On-chain Verification | < 200k compute units |
| Program Size | < 500KB (currently 307KB ✓) |
| API Latency | < 100ms (excluding proof gen) |

### 6.3 Judging Criteria Alignment

| Criterion | How We Excel |
|-----------|--------------|
| **Innovation** | First whale-focused privacy tool on Solana with Private Swaps |
| **Technical** | Real ZK proofs on-chain, encrypted cloud backup, Jupiter integration |
| **Usability** | Polished UI, stealth withdraw, private swap, one-click flows |
| **Completeness** | Full shield → withdraw/swap cycle, transaction history, backup/recovery |
| **Privacy** | Double layer: different wallet + different token. Encrypted storage. Privacy delays. |

---

## 7. Development Timeline

### V1: Foundation (Jan 12-25) ✅
- Veil SDK integration, program deployment
- Shield + unshield flows (frontend → backend → on-chain)
- Dashboard + positions view

### V2: Multi-Pool & Relayer (Jan 25-26) ✅
- Fixed denomination pools (1, 10, 100, 1000 SOL)
- Relayer-based withdrawals (user never signs unshield tx)
- Denomination selector UI with privacy indicators

### V3: Private Swaps & Cloud Backup (Jan 27-29)
- Supabase encrypted cloud backup
- Private Swap page (Jupiter integration)
- Stealth Withdraw (rename + privacy delays)
- Transaction history page
- Deposit receipt export/import

### V3.1: UI Enhancement (Jan 29-30)
- Visual design system polish
- Animations and transitions
- Mobile responsive pass

### V4: Pool Seeding (Post-hackathon or when funded)
- Initialize all pools on-chain
- Seed pools with deposits for anonymity
- Pool health indicators

### V5: Private Yield (Future — Q1 2026)
- Privacy-preserving yield aggregation
- Jito liquid staking integration (first protocol)
- Kamino lending integration (second protocol)
- See: `/docs/plans/private-yield-design.md`

### V6: Institutional Features (Future — Q2 2026)
- Multi-sig privacy vaults (Squads integration)
- Viewing keys for selective disclosure
- Compliance-friendly audit trails

---

## 8. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Proof gen too slow | Medium | High | Pre-generate test proofs, optimize circuit |
| Devnet congestion | Low | Medium | Retry logic, clear user messaging |
| Wallet adapter issues | Low | Low | Test with Phantom, Solflare, Backpack |
| Wallet signature differs across devices | Low | High | Test deterministic signing across wallets |
| Jupiter API rate limits | Medium | Medium | Cache quotes (30s TTL), show stale warning |
| Swap slippage on large amounts | Medium | Medium | Show price impact, set max slippage (1%) |
| Supabase downtime | Low | Medium | Fall back to localStorage, sync on recovery |
| Demo day nerves | Medium | High | Record backup video, practice 5x |

---

## 9. Deliverables Checklist

### Required for Submission
- [x] Deployed program on devnet
- [ ] Working frontend (Vercel)
- [ ] Working backend (Railway/Render)
- [ ] Demo video (< 3 min)
- [ ] GitHub repo with README
- [ ] Architecture diagram
- [ ] Supabase project configured

### Core Features
- [x] Shield SOL into denomination pools
- [x] Stealth withdraw via relayer
- [ ] Private Swap (any token via Jupiter)
- [ ] Encrypted cloud backup (Supabase)
- [ ] Transaction history page
- [ ] Deposit receipt export/import
- [ ] Privacy delay toggle

### Nice to Have
- [ ] USDC shielding (coming soon badge in UI)
- [ ] UI polish pass (V3.1)
- [ ] Pool seeding (V4)

---

## 10. Technical Verification Status

### Completed ✅
- Veil SDK cloned and compiled
- Program builds successfully (307KB)
- Program ID generated: `A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy`
- blake3 compatibility issue resolved (patched to v1.5.0)
- Solana CLI configured for devnet

### Pending ⏳
- Deploy program to devnet (need ~2.14 SOL, have 2 SOL)
- Test shield/unshield on devnet
- Backend integration with Veil SDK
- Frontend development

---

## Appendix A: Key Code References

### Cargo.toml Patch (blake3 Compatibility)
```toml
[profile.release]
overflow-checks = true

[patch.crates-io]
blake3 = { git = "https://github.com/BLAKE3-team/BLAKE3", tag = "1.5.0" }
```

### Program Entry Point
```rust
// crates/program/src/lib.rs
declare_id!("A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy");

#[program]
pub mod veil_program {
    pub fn shield_sol(ctx: Context<ShieldSol>, commitment: [u8; 32], amount: u64) -> Result<()>
    pub fn unshield_sol(ctx: Context<UnshieldSol>, nullifier: [u8; 32], amount: u64, proof: Vec<u8>) -> Result<()>
}
```

---

*Document generated: January 25, 2026*
*Author: Claude Code + Human collaboration*
