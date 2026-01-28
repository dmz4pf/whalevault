# WhaleVault Volume 3: Private Swaps, Encrypted Cloud Backup & UI Enhancement

**Date:** January 27, 2026
**Status:** Design Complete — Awaiting Approval

---

## Overview

V3 transforms WhaleVault from a SOL-only privacy tool into a full-featured privacy platform with:
- **Private Swaps** — shield SOL, withdraw as any token to any wallet
- **Encrypted cloud backup** — positions auto-synced to Supabase, zero privacy leakage
- **Stealth Withdraw** — renamed unshield with opt-in privacy delays
- **Transaction history** — full audit trail with export/import
- **UI overhaul** — hackathon-ready polish

Three features require PRD + architecture doc updates: Supabase integration, Private Swap, and the rename from Unshield to Stealth Withdraw.

---

## Problem Statement

V2 gave WhaleVault multi-pool denominations and relayer-based withdrawals. But critical gaps remain:

1. **Positions stored in localStorage** — clear browser = lose funds. Unacceptable.
2. **SOL-only output** — whales want to exit to stablecoins, not just SOL.
3. **No transaction history** — users can't see past activity.
4. **Basic UI** — functional but not hackathon-winning. Needs premium polish.
5. **Timing correlation** — shield and immediately withdraw = obvious link.

---

## V3 Feature List

| # | Feature | New Pages | PRD/Arch Update |
|---|---------|-----------|-----------------|
| 1 | Supabase encrypted cloud backup | — | Yes |
| 2 | Private Swap (any token via Jupiter) | `/private-swap` | Yes |
| 3 | Stealth Withdraw (rename + privacy delay) | — | Yes |
| 4 | Transaction history | `/history` | No |
| 5 | Deposit receipt export/import | — | No |
| 6 | USDC "Coming Soon" on shield page | — | No |
| 7 | UI enhancement & polish | All pages | No |

---

## Architecture

### Updated System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                  │
│                                                           │
│  Pages: Dashboard | Shield | Stealth Withdraw |           │
│         Private Swap | History                            │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ useVault     │  │ usePrivate   │  │ useEncryption  │  │
│  │ Storage      │  │ Swap         │  │                │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                   │           │
└─────────┼─────────────────┼───────────────────┼───────────┘
          │                 │                   │
          ▼                 ▼                   ▼
   ┌─────────────┐  ┌─────────────┐     ┌─────────────┐
   │   Backend   │  │  Jupiter    │     │  Supabase   │
   │  (FastAPI)  │  │    API      │     │ (encrypted) │
   │             │  │             │     │             │
   │ - Proofs    │  │ - Quotes    │     │ - vault_data│
   │ - Relayer   │  │ - Swap TXs  │     │   table     │
   │ - Swap exec │  │             │     │             │
   └──────┬──────┘  └─────────────┘     └─────────────┘
          │
          ▼
   ┌─────────────┐
   │   Solana    │
   │   Devnet    │
   └─────────────┘
```

### Key Architecture Decision

**Supabase is accessed directly from the frontend**, not through the backend. The backend never touches position data. This ensures:
- Backend stays stateless
- Secrets never pass through our server
- Supabase only stores encrypted blobs it can't read

---

## Implementation Plan

### Step 1: Supabase Setup & Encryption Layer

**New files:**
- `frontend/lib/supabase.ts` — Supabase client initialization
- `frontend/lib/encryption.ts` — AES-256-GCM encrypt/decrypt + key derivation
- `frontend/hooks/useVaultStorage.ts` — replaces localStorage position management

**Supabase schema:**

```sql
create table vault_data (
  id uuid default gen_random_uuid() primary key,
  wallet_hash text unique not null,
  encrypted_data text not null,
  nonce text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: anyone can read/write by wallet_hash (data is encrypted anyway)
alter table vault_data enable row level security;
create policy "Public access" on vault_data for all using (true);
```

**Encryption flow:**

1. Wallet signs message: `"WhaleVault-v1"` → 64-byte signature
2. `encryptionKey = SHA-256(signature)` → 32-byte AES key
3. `walletHash = SHA-256(walletPublicKey)` → table lookup key
4. `encrypt(JSON.stringify(positions), encryptionKey)` → stored in Supabase
5. On load: query by `walletHash`, decrypt with same key

**Encrypted blob structure:**

```json
{
  "positions": [
    {
      "id": "uuid",
      "commitment": "hex",
      "secret": "hex",
      "amount": 1000000000,
      "denomination": 1000000000,
      "poolAddress": "base58",
      "status": "confirmed | spent",
      "shieldTxSig": "base58",
      "unshieldTxSig": "base58 | null",
      "swapOutputToken": "symbol | null",
      "swapOutputAmount": "number | null",
      "createdAt": "iso8601",
      "spentAt": "iso8601 | null",
      "delayUntil": "iso8601 | null"
    }
  ],
  "version": 1
}
```

**Privacy guarantees:**
- Supabase sees: a SHA-256 hash, an encrypted blob, a timestamp
- Cannot map hash to wallet address
- Cannot decrypt position data
- Cannot determine amounts, tokens, or recipients

**Modified files:**
- `frontend/hooks/useShield.ts` — save position to Supabase after shield
- `frontend/hooks/useUnshield.ts` — update position status in Supabase after withdraw
- All components reading positions — switch from localStorage to `useVaultStorage`

---

### Step 2: Private Swap Page & Backend

**New frontend files:**
- `frontend/app/private-swap/page.tsx` — Private Swap page
- `frontend/hooks/usePrivateSwap.ts` — swap flow logic
- `frontend/components/swap/TokenSelector.tsx` — searchable token dropdown
- `frontend/components/swap/SwapQuote.tsx` — displays rate, output amount, slippage
- `frontend/lib/tokens.ts` — featured token list + Jupiter token API integration

**New backend files:**
- `backend/services/jupiter_service.py` — quote fetching, swap TX building, execution
- `backend/api/routes/swap.py` — `/api/swap/quote` and `/api/swap/execute` endpoints
- `backend/models/requests.py` — add `SwapQuoteRequest`, `SwapExecuteRequest`
- `backend/models/responses.py` — add `SwapQuoteResponse`, `SwapExecuteResponse`

**API endpoints:**

```
GET /api/swap/quote?amount={lamports}&outputMint={mint}
→ { outputAmount, rate, slippage, priceImpact, fee }

POST /api/swap/execute
{
  commitment: string,
  secret: string,
  amount: number,
  recipient: string,
  outputMint: string,
  denomination: number
}
→ { jobId, status }  // same polling pattern as proof generation
```

**Backend swap execution flow:**

1. Receive swap request
2. Generate ZK proof (existing proof pipeline)
3. Relayer unshields SOL from pool to relayer wallet
4. Relayer calls Jupiter API to swap SOL → target token
5. Relayer sends target token to recipient address
6. Return transaction signatures

**Featured token list:**

```typescript
const FEATURED_TOKENS = [
  { symbol: "USDC", mint: "EPjFW...", decimals: 6 },
  { symbol: "USDT", mint: "Es9vM...", decimals: 6 },
  { symbol: "BONK", mint: "DezXA...", decimals: 5 },
  { symbol: "JUP",  mint: "JUPyi...", decimals: 6 },
  { symbol: "WIF",  mint: "EKpQG...", decimals: 6 },
];
// Full list fetched from Jupiter token API on demand
```

**User flow:**

1. Select shielded position
2. Enter recipient address
3. Select output token (searchable dropdown, featured tokens pinned)
4. See Jupiter quote (rate, output amount, slippage, price impact)
5. Confirm → proof generation → relayer unshields → relayer swaps → token sent to recipient
6. Position marked as spent in Supabase with swap metadata

---

### Step 3: Stealth Withdraw (Rename + Privacy Delay)

**Modified files:**
- `frontend/app/unshield/page.tsx` — rename to "Stealth Withdraw", add delay toggle
- `frontend/hooks/useUnshield.ts` — check `delayUntil` before allowing withdrawal
- `frontend/components/layout/Header.tsx` — nav: "Unshield" → "Stealth Withdraw"
- All references to "unshield" in user-facing copy → "Stealth Withdraw"

**Privacy delay UI:**

```
┌─────────────────────────────────┐
│ 🕐 Privacy Delay (Optional)     │
│                                  │
│ [toggle: OFF/ON]                 │
│                                  │
│ When enabled:                    │
│ ○ 1 hour  ○ 6 hours  ● 24 hours │
│                                  │
│ ℹ Recommended: delays make your  │
│   withdrawal harder to trace.    │
└─────────────────────────────────┘
```

**Behavior:**
- Toggle is OFF by default
- When ON, user selects preset (1h, 6h, 24h)
- On shield confirmation, `delayUntil` timestamp is calculated and saved to position in Supabase
- Stealth Withdraw page disables the withdraw button for locked positions with countdown: "Available in 5h 23m"
- Delay is purely client-side enforcement — no backend/on-chain changes
- Private Swap page respects the same delay

---

### Step 4: Transaction History Page

**New files:**
- `frontend/app/history/page.tsx` — history page
- `frontend/components/history/TransactionList.tsx` — filtered transaction list
- `frontend/components/history/TransactionCard.tsx` — single transaction entry

**Features:**
- Filter tabs: All | Shield | Stealth Withdraw | Private Swap
- Each entry shows: type, amount, status, timestamp, Solscan link
- Private Swap entries also show: output token, output amount
- Data sourced from Supabase encrypted blob (same positions array)
- No backend changes needed

**Nav update:** Add "History" to navigation (already exists in current nav but page is empty)

---

### Step 5: Deposit Receipt Export/Import

**New files:**
- `frontend/lib/receipt.ts` — export/import logic

**Export:**
- Button on history page: "Export Backup Receipt"
- Downloads `whalevault-backup-{date}.json`
- File contains the same encrypted blob as Supabase
- Can only be decrypted with the user's wallet

**Import:**
- Button on history page: "Import Backup"
- User drops/selects JSON file
- Decrypted with wallet-derived key
- Merged with existing Supabase data (deduplication by commitment)
- Handles version migration if blob format changes

---

### Step 6: Shield Page — USDC Coming Soon

**Modified file:**
- `frontend/app/shield/page.tsx`

**Changes:**
- USDC token card: `opacity-50`, `cursor-not-allowed`
- "Coming Soon" badge overlay on USDC card
- Click handler disabled
- Tooltip on hover: "USDC shielding coming in a future update"

---

### Step 7: UI Enhancement & Polish

**Goal:** Transform the functional UI into a hackathon-winning interface.

**7a. Visual Design System**
- Refine color palette — deeper gradients, better contrast
- Consistent spacing and typography scale
- Card elevation and glassmorphism effects
- Smooth hover/focus states on all interactive elements

**7b. Animations & Transitions**
- Page transitions (fade/slide between routes)
- Card entrance animations (staggered fade-in)
- Button interactions (scale on press, shimmer on hover)
- Proof generation animation — particle system or orbital animation showing "privacy being generated"
- Success state — confetti or vault-door-opening animation
- Loading skeletons for all data-dependent components

**7c. Shield Page Polish**
- Token selector cards: subtle glow on selected state
- Denomination cards: hover lift effect, privacy indicator animation
- Amount input: large, prominent, with live SOL balance
- Transaction preview: glassmorphic card with fee breakdown

**7d. Stealth Withdraw & Private Swap Polish**
- Position selector: card-based with amount and time since shielded
- Privacy delay toggle: smooth animated switch
- Countdown timer: animated digits
- Swap quote card: live-updating rate with token logos
- Token selector: searchable modal with token logos and balances

**7e. Dashboard Polish**
- Pool stats: animated counters
- Position cards: status badges with color coding
- Quick action buttons: prominent CTAs

**7f. History Page Polish**
- Timeline view with connecting lines
- Type-specific icons and colors
- Empty state illustration

**7g. Global Polish**
- Loading states for every async operation
- Error states with retry actions
- Empty states with helpful copy
- Toast notifications (Sonner) for all status updates
- Mobile responsive — all pages work on phone

**Modified files:** All page and component files. This is a pass across the entire frontend.

---

## Nav Structure (Updated)

```
Dashboard | Shield | Stealth Withdraw | Private Swap | History
```

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `frontend/lib/supabase.ts` | Supabase client init |
| `frontend/lib/encryption.ts` | AES-256-GCM encrypt/decrypt, key derivation |
| `frontend/lib/tokens.ts` | Featured token list + Jupiter token API |
| `frontend/lib/receipt.ts` | Deposit receipt export/import |
| `frontend/hooks/useVaultStorage.ts` | Encrypted Supabase position management |
| `frontend/hooks/usePrivateSwap.ts` | Private Swap flow logic |
| `frontend/app/private-swap/page.tsx` | Private Swap page |
| `frontend/app/history/page.tsx` | Transaction history page (exists but empty) |
| `frontend/components/swap/TokenSelector.tsx` | Searchable token dropdown |
| `frontend/components/swap/SwapQuote.tsx` | Swap rate/output display |
| `frontend/components/history/TransactionList.tsx` | Filtered tx list |
| `frontend/components/history/TransactionCard.tsx` | Single tx entry |
| `backend/services/jupiter_service.py` | Jupiter API integration |
| `backend/api/routes/swap.py` | Swap quote + execute endpoints |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/app/shield/page.tsx` | USDC "Coming Soon" disabled state |
| `frontend/app/unshield/page.tsx` | Rename + privacy delay toggle |
| `frontend/hooks/useShield.ts` | Save to Supabase after shield |
| `frontend/hooks/useUnshield.ts` | Read from Supabase, check delay |
| `frontend/components/layout/Header.tsx` | Nav: Unshield → Stealth Withdraw, add Private Swap + History |
| `backend/models/requests.py` | Add SwapQuoteRequest, SwapExecuteRequest |
| `backend/models/responses.py` | Add SwapQuoteResponse, SwapExecuteResponse |
| `backend/config.py` | Add Jupiter API config, Supabase URL |
| All UI components | Visual polish pass |

---

## Implementation Order

1. **Supabase setup + encryption** — foundation for everything else
2. **Migrate positions to Supabase** — replace localStorage reads/writes
3. **Private Swap backend** — Jupiter service + swap endpoints
4. **Private Swap frontend** — page + components
5. **Stealth Withdraw rename + delay** — rename + toggle
6. **History page** — display from Supabase data
7. **Deposit receipts** — export/import
8. **Shield USDC badge** — quick UI change
9. **UI enhancement pass** — polish everything

---

## PRD Updates Required

The following PRD sections need updating:

1. **Section 2.2 Core Features** — add Private Swap, Stealth Withdraw, encrypted backup, history
2. **Section 2.3 What We're NOT Building** — remove "SPL token support" (Private Swap covers output tokens), remove "Relayer network" (V2 added relayer)
3. **Section 3.2 Technology Stack** — add Supabase, Jupiter API
4. **Section 3.4 API Endpoints** — add swap quote/execute endpoints
5. **Section 4.1 Screen Flow** — add Private Swap page, rename Unshield
6. **Section 5.3 Frontend Security** — update: secrets now encrypted in Supabase, not just localStorage

## Architecture Doc Updates Required

1. **Section 2.3 Assumptions** — remove A5 (single pool), remove A6 (localStorage only)
2. **Section 3.3 Endpoints** — add swap endpoints
3. **Section 4.1 Frontend State** — add vault storage, swap state
4. **Section 8.1 Infrastructure** — add Supabase to deployment diagram
5. **Section 8.2 Environment Variables** — add Supabase URL/key, Jupiter API

---

## Verification

1. Connect wallet → signs encryption message → Supabase entry created
2. Shield SOL → position saved to Supabase (encrypted)
3. Disconnect, reconnect → positions load from Supabase
4. Clear localStorage → positions still available from Supabase
5. Stealth Withdraw with delay → countdown shows, button disabled until timer expires
6. Stealth Withdraw without delay → works as before
7. Private Swap → select token, see quote, confirm → recipient receives token
8. History page → shows all operations with correct types and filters
9. Export receipt → valid JSON file downloaded
10. Import receipt on new device → positions restored
11. USDC card on shield page → disabled, shows "Coming Soon"
12. All pages → smooth animations, loading states, mobile responsive

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wallet signature differs across devices | Use deterministic message; test across Phantom/Solflare/Backpack |
| Jupiter API rate limits | Cache quotes (30s TTL), show stale quote warning |
| Swap slippage on large amounts | Show price impact prominently, set max slippage (1%) |
| Relayer runs out of token balance | Relayer swaps real-time, doesn't hold token reserves |
| Supabase downtime | Fall back to localStorage, sync when Supabase recovers |
| Encrypted blob grows too large | Paginate or archive old spent positions |

---

*V3 Plan — January 27, 2026*
