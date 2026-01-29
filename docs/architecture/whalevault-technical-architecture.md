
c1 # WhaleVault Technical Architecture

**Version:** 3.0
**Date:** January 27, 2026 (updated from v1.0 Jan 25)
**Status:** V1+V2 Implemented, V3 In Progress

---

## 1. Executive Summary

WhaleVault is a privacy-first treasury migration tool for Solana that enables large holders to shield SOL, stealth withdraw to new addresses, and perform private swaps to any token — all using zero-knowledge proofs.

The architecture follows a five-component pattern:
1. **Frontend (Next.js 14)** — UI, wallet interaction, client-side encryption
2. **Backend (FastAPI)** — Proof generation, relayer, swap execution via Veil SDK
3. **On-chain (Anchor)** — Multi-pool privacy vaults with ZK verification
4. **Supabase** — Encrypted position backup (zero-knowledge to server)
5. **Jupiter API** — Token swap routing for Private Swap feature

Key design decisions:
- Backend handles all cryptographic operations (Veil SDK uses Rust FFI, can't run in browser)
- Relayer submits withdraw/swap txs so user's wallet is never linked to the output
- All position data encrypted client-side (AES-256-GCM) before syncing to Supabase
- Supabase only sees wallet hash + encrypted blob — cannot read any position data

---

## 2. Context & Requirements

### 2.1 Stated Requirements
- Shield SOL into privacy pool with commitment generation
- Unshield SOL with ZK proof verification
- Wallet connection (Phantom, Solflare, Backpack)
- Real-time proof generation progress feedback
- Working demo for hackathon judges

### 2.2 Inferred Requirements
- Optimistic UI updates during proof generation (10-30 seconds)
- Graceful handling of RPC failures and timeouts
- Mobile-responsive design
- Clear error messages for on-chain failures
- Transaction history persistence (localStorage for MVP)

### 2.3 Assumptions
1. **A1**: User has sufficient SOL for gas fees (~0.01 SOL per operation)
2. **A2**: Devnet RPC is available and responsive (<2s latency)
3. **A3**: Proof generation completes within 30 seconds
4. **A4**: User keeps browser tab open during proof generation
5. **A5**: Wallet signature is deterministic across sessions (same message → same key for encryption)
6. **A6**: Jupiter API is available for swap quotes and execution

### 2.4 Constraints
- Program size: 307KB (within 500KB limit)
- Compute units: ~200k per verification
- Merkle tree depth: 20 (supports 2^20 = ~1M commitments per pool)
- MVP uses signature-based proofs (96 bytes: 64 sig + 32 pubkey)
- Relayer keypair managed by backend — single point of failure for withdrawals
- SOL-only shielding (SPL token deposits not supported; output via Jupiter swap only)
- Fixed denomination pools: 1, 10, 100, 1000 SOL

---

## 3. API Contract Design

### 3.1 Base URL
```
Production: https://api.whalevault.app/v1
Development: http://localhost:8000/v1
```

### 3.2 Common Response Envelope

```typescript
// Success Response
{
  "success": true,
  "data": T,
  "timestamp": "2026-01-25T10:30:00Z"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "PROOF_GENERATION_FAILED",
    "message": "Failed to generate ZK proof",
    "details": { ... }  // Optional debug info
  },
  "timestamp": "2026-01-25T10:30:00Z"
}
```

### 3.3 Endpoints

#### POST /api/shield/prepare
Generates commitment for shielding SOL.

**Request:**
```typescript
{
  "amount": number,        // Amount in lamports (1 SOL = 1_000_000_000)
  "depositor": string      // Base58 pubkey of depositor wallet
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "commitment": string,       // Hex-encoded 32-byte commitment
    "secret": string,           // Hex-encoded 64-char secret (STORE SECURELY!)
    "amount": number,           // Echo back amount
    "leafIndex": number | null, // Null until confirmed on-chain
    "instruction": {
      "programId": string,
      "keys": AccountMeta[],
      "data": string            // Base64-encoded instruction data
    }
  }
}
```

**Errors:**
| Code | Message | Cause |
|------|---------|-------|
| `INVALID_AMOUNT` | Amount must be positive | amount <= 0 |
| `AMOUNT_TOO_SMALL` | Minimum shield is 0.001 SOL | amount < 1_000_000 |
| `INVALID_DEPOSITOR` | Invalid Solana address | Bad base58 |

---

#### POST /api/unshield/proof
Generates ZK proof for unshielding SOL. This is a long-running operation.

**Request:**
```typescript
{
  "commitment": string,    // Hex-encoded commitment from shield
  "secret": string,        // Hex-encoded secret from shield
  "amount": number,        // Amount in lamports to unshield
  "recipient": string      // Base58 pubkey of recipient wallet
}
```

**Response (Immediate - returns job ID):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,           // UUID for polling
    "status": "pending",
    "estimatedTime": 15        // Seconds
  }
}
```

**Errors:**
| Code | Message | Cause |
|------|---------|-------|
| `INVALID_COMMITMENT` | Commitment must be 64 hex chars | Bad format |
| `INVALID_SECRET` | Secret must be 64 hex chars | Bad format |
| `COMMITMENT_NOT_FOUND` | Commitment not in Merkle tree | Never shielded or wrong secret |
| `NULLIFIER_SPENT` | This commitment has already been unshielded | Double-spend attempt |

---

#### GET /api/proof/status/{jobId}
Poll for proof generation status.

**Response (Pending):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "pending" | "generating" | "completed" | "failed",
    "progress": number,        // 0-100
    "stage": string,           // "initializing" | "computing_witness" | "generating_proof" | "finalizing"
    "estimatedTimeRemaining": number  // Seconds
  }
}
```

**Response (Completed):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "completed",
    "progress": 100,
    "result": {
      "nullifier": string,     // Hex-encoded 32-byte nullifier
      "proof": string,         // Hex-encoded proof bytes (96 for MVP)
      "amount": number,
      "recipient": string,
      "instruction": {
        "programId": string,
        "keys": AccountMeta[],
        "data": string
      }
    }
  }
}
```

**Response (Failed):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "failed",
    "error": {
      "code": "PROOF_GENERATION_FAILED",
      "message": "Circuit constraint violation"
    }
  }
}
```

---

#### GET /api/pool/status
Get current pool statistics.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "totalValueLocked": number,      // Lamports in pool
    "totalDeposits": number,         // Number of shield operations
    "totalWithdrawals": number,      // Number of unshield operations
    "anonymitySetSize": number,      // Current # of unspent commitments
    "merkleRoot": string,            // Current root (hex)
    "poolAddress": string,           // Pool PDA address
    "vaultAddress": string           // Vault PDA address
  }
}
```

---

#### GET /api/health
Backend health check.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "solanaConnection": "connected" | "degraded" | "disconnected",
    "rpcLatency": number,            // ms
    "proofWorkerStatus": "ready" | "busy"
  }
}
```

---

#### GET /api/pool/status/{denomination} *(V2)*
Get statistics for a specific denomination pool.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "denomination": number,          // Lamports (e.g. 1_000_000_000 = 1 SOL)
    "totalValueLocked": number,
    "totalDeposits": number,
    "anonymitySetSize": number,
    "merkleRoot": string,
    "poolAddress": string,
    "vaultAddress": string
  }
}
```

---

#### GET /api/relay/info *(V2)*
Get relayer status and fee information.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "relayerAddress": string,
    "feeBps": number,               // Fee in basis points (e.g. 50 = 0.5%)
    "balance": number,              // Relayer SOL balance in lamports
    "status": "ready" | "busy" | "low_balance"
  }
}
```

---

#### POST /api/relay/unshield *(V2)*
Submit withdrawal via relayer. User never signs the unshield transaction.

**Request:**
```typescript
{
  "commitment": string,
  "secret": string,
  "amount": number,
  "recipient": string,
  "denomination": number
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "pending"
  }
}
```

---

#### GET /api/swap/quote *(V3)*
Get Jupiter swap quote for SOL → token.

**Request (query params):**
```
?amount={lamports}&outputMint={mint}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "outputAmount": number,          // Output in token's smallest unit
    "rate": number,                  // Exchange rate
    "slippage": number,              // Expected slippage %
    "priceImpact": number,           // Price impact %
    "fee": number                    // Fee in lamports
  }
}
```

---

#### POST /api/swap/execute *(V3)*
Execute private swap: unshield SOL → swap via Jupiter → send token to recipient.

**Request:**
```typescript
{
  "commitment": string,
  "secret": string,
  "amount": number,
  "recipient": string,
  "outputMint": string,
  "denomination": number
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "pending"
  }
}
```

The job follows the same polling pattern as proof generation via `GET /api/proof/status/{jobId}`.

---

### 3.4 Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request body |
| `INVALID_AMOUNT` | 400 | Amount validation failed |
| `INVALID_ADDRESS` | 400 | Invalid Solana address |
| `COMMITMENT_NOT_FOUND` | 404 | Commitment not in pool |
| `JOB_NOT_FOUND` | 404 | Proof job ID not found |
| `NULLIFIER_SPENT` | 409 | Double-spend attempt |
| `POOL_FULL` | 409 | Merkle tree at capacity |
| `PROOF_GENERATION_FAILED` | 500 | Internal proof error |
| `RPC_ERROR` | 502 | Solana RPC failure |
| `TIMEOUT` | 504 | Operation timed out |

---

## 4. Data Models

### 4.1 Frontend State (Zustand Store)

```typescript
// stores/wallet.ts
interface WalletState {
  // Connection
  connected: boolean;
  publicKey: string | null;
  walletName: string | null;  // "Phantom" | "Solflare" | "Backpack"

  // Balance
  balance: number;  // SOL balance in lamports
  balanceLoading: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

// stores/shield.ts
interface ShieldState {
  // Form
  amount: string;  // User input as string

  // Transaction
  status: 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';
  commitment: string | null;
  secret: string | null;  // WARNING: Handle securely!
  txSignature: string | null;
  error: string | null;

  // Actions
  setAmount: (amount: string) => void;
  prepareShield: () => Promise<void>;
  confirmShield: (signedTx: Transaction) => Promise<void>;
  reset: () => void;
}

// stores/unshield.ts
interface UnshieldState {
  // Form
  selectedPosition: Position | null;
  amount: string;
  recipient: string;

  // Proof generation
  status: 'idle' | 'generating' | 'signing' | 'confirming' | 'success' | 'error';
  jobId: string | null;
  progress: number;  // 0-100
  stage: string | null;

  // Result
  txSignature: string | null;
  error: string | null;

  // Actions
  selectPosition: (position: Position) => void;
  setAmount: (amount: string) => void;
  setRecipient: (address: string) => void;
  startUnshield: () => Promise<void>;
  pollProofStatus: () => Promise<void>;
  confirmUnshield: (signedTx: Transaction) => Promise<void>;
  reset: () => void;
}

// types/position.ts — V3 (updated for multi-pool, Supabase, swaps, delays)
interface Position {
  id: string;
  commitment: string;
  secret: string;
  amount: number;
  denomination: number;            // Pool denomination in lamports
  poolAddress: string;             // Pool PDA address
  status: 'pending' | 'confirmed' | 'spent';
  shieldTxSig: string;
  unshieldTxSig: string | null;
  swapOutputToken: string | null;  // Token symbol if private swap
  swapOutputAmount: number | null; // Output amount if private swap
  createdAt: string;
  spentAt: string | null;
  delayUntil: string | null;       // Privacy delay expiry (ISO 8601)
}

// stores/vaultStorage.ts — V3 (replaces localStorage with Supabase)
interface VaultStorageState {
  positions: Position[];
  loading: boolean;
  syncing: boolean;
  lastSynced: string | null;

  // Actions
  loadFromSupabase: () => Promise<void>;
  saveToSupabase: () => Promise<void>;
  addPosition: (position: Position) => Promise<void>;
  updatePosition: (commitment: string, updates: Partial<Position>) => Promise<void>;
}

// stores/privateSwap.ts — V3
interface SwapQuote {
  outputAmount: number;
  rate: number;
  slippage: number;
  priceImpact: number;
  fee: number;
}

interface PrivateSwapState {
  selectedPosition: Position | null;
  recipient: string;
  outputMint: string | null;
  quote: SwapQuote | null;
  status: 'idle' | 'quoting' | 'generating' | 'swapping' | 'success' | 'error';
  jobId: string | null;
  progress: number;
  txSignatures: string[];
  error: string | null;

  // Actions
  selectPosition: (position: Position) => void;
  setRecipient: (address: string) => void;
  setOutputMint: (mint: string) => void;
  fetchQuote: () => Promise<void>;
  executeSwap: () => Promise<void>;
  reset: () => void;
}

// stores/pool.ts — V2 (updated for multi-pool)
interface PoolStats {
  denomination: number;
  totalValueLocked: number;
  totalDeposits: number;
  anonymitySetSize: number;
  poolAddress: string;
}

interface PoolState {
  pools: PoolStats[];              // Stats per denomination
  loading: boolean;
  lastUpdated: string | null;

  // Actions
  fetchAllPoolStats: () => Promise<void>;
  fetchPoolStats: (denomination: number) => Promise<void>;
}
```

### 4.2 Backend Pydantic Models

```python
# models/requests.py
from pydantic import BaseModel, Field, validator
from typing import Optional
import re

class ShieldPrepareRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount in lamports")
    depositor: str = Field(..., min_length=32, max_length=44)

    @validator('depositor')
    def validate_solana_address(cls, v):
        # Base58 alphabet check
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', v):
            raise ValueError('Invalid Solana address')
        return v

    @validator('amount')
    def validate_minimum(cls, v):
        if v < 1_000_000:  # 0.001 SOL minimum
            raise ValueError('Minimum shield amount is 0.001 SOL')
        return v


class UnshieldProofRequest(BaseModel):
    commitment: str = Field(..., min_length=64, max_length=64)
    secret: str = Field(..., min_length=64, max_length=64)
    amount: int = Field(..., gt=0)
    recipient: str = Field(..., min_length=32, max_length=44)

    @validator('commitment', 'secret')
    def validate_hex(cls, v):
        if not re.match(r'^[0-9a-fA-F]{64}$', v):
            raise ValueError('Must be 64 hex characters')
        return v.lower()

    @validator('recipient')
    def validate_solana_address(cls, v):
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', v):
            raise ValueError('Invalid Solana address')
        return v


# models/responses.py
from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum
from datetime import datetime

class ProofStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"

class ProofStage(str, Enum):
    INITIALIZING = "initializing"
    COMPUTING_WITNESS = "computing_witness"
    GENERATING_PROOF = "generating_proof"
    FINALIZING = "finalizing"

class AccountMeta(BaseModel):
    pubkey: str
    is_signer: bool
    is_writable: bool

class InstructionData(BaseModel):
    program_id: str
    keys: List[AccountMeta]
    data: str  # Base64 encoded

class ShieldPrepareResponse(BaseModel):
    commitment: str
    secret: str
    amount: int
    leaf_index: Optional[int] = None
    instruction: InstructionData

class ProofJobResponse(BaseModel):
    job_id: str
    status: ProofStatus
    estimated_time: int = 15

class ProofStatusResponse(BaseModel):
    job_id: str
    status: ProofStatus
    progress: int = 0
    stage: Optional[ProofStage] = None
    estimated_time_remaining: Optional[int] = None
    result: Optional[dict] = None
    error: Optional[dict] = None

class PoolStatusResponse(BaseModel):
    total_value_locked: int
    total_deposits: int
    total_withdrawals: int
    anonymity_set_size: int
    merkle_root: str
    pool_address: str
    vault_address: str

class HealthResponse(BaseModel):
    status: str
    version: str
    solana_connection: str
    rpc_latency: int
    proof_worker_status: str


# V2 additions — Relay models
class RelayUnshieldRequest(BaseModel):
    commitment: str
    secret: str
    amount: int
    recipient: str
    denomination: int

class RelayInfoResponse(BaseModel):
    relayer_address: str
    fee_bps: int
    balance: int
    status: str  # "ready" | "busy" | "low_balance"


# V3 additions — Swap models
class SwapQuoteRequest(BaseModel):
    amount: int = Field(..., gt=0)
    output_mint: str = Field(..., min_length=32, max_length=44)

class SwapExecuteRequest(BaseModel):
    commitment: str = Field(..., min_length=64, max_length=64)
    secret: str = Field(..., min_length=64, max_length=64)
    amount: int = Field(..., gt=0)
    recipient: str = Field(..., min_length=32, max_length=44)
    output_mint: str = Field(..., min_length=32, max_length=44)
    denomination: int = Field(..., gt=0)

class SwapQuoteResponse(BaseModel):
    output_amount: int
    rate: float
    slippage: float
    price_impact: float
    fee: int

class SwapExecuteResponse(BaseModel):
    job_id: str
    status: str
```

### 4.3 On-Chain Account Structures

```rust
// Already defined in Veil SDK, documenting interface:

/// Privacy Pool PDA (seeds: ["privacy_pool"])
/// Size: ~1700 bytes
pub struct PrivacyPool {
    pub authority: Pubkey,                    // 32 bytes
    pub merkle_tree: IncrementalMerkleTree,   // 680 bytes (depth 20)
    pub root_history: [[u8; 32]; 30],         // 960 bytes (30 recent roots)
    pub root_history_index: u8,               // 1 byte
    pub nullifier_count: u64,                 // 8 bytes
    pub relayer_fee_bps: u16,                 // 2 bytes
    pub total_fees_collected: u64,            // 8 bytes
    pub bump: u8,                             // 1 byte
}

/// Nullifier Marker PDA (seeds: ["nullifier", pool, nullifier_bytes])
/// Size: 80 bytes (8 discriminator + 72 data)
pub struct NullifierMarker {
    pub pool: Pubkey,           // 32 bytes
    pub nullifier: [u8; 32],    // 32 bytes
    pub spent_at: u64,          // 8 bytes (slot number)
}

/// PDA Derivations (V2: multi-pool, keyed by denomination):
/// - Pool: Pubkey::find_program_address(["privacy_pool", &denomination.to_le_bytes()], program_id)
/// - Vault: Pubkey::find_program_address(["vault", pool.key()], program_id)
/// - Nullifier: Pubkey::find_program_address(["nullifier", pool.key(), nullifier], program_id)
```

---

## 5. State Management

### 5.1 Proof Generation Progress Tracking

The proof generation is a long-running async operation. Here's how we track it:

```
Frontend                    Backend                     Worker
   |                           |                           |
   |-- POST /unshield/proof -->|                           |
   |<-- { jobId, "pending" } --|                           |
   |                           |-- Queue job ------------->|
   |                           |                           |
   |-- GET /proof/status ----->|                           |
   |<-- { progress: 10% } -----|<-- Update progress -------|
   |                           |                           |
   |-- GET /proof/status ----->|                           |
   |<-- { progress: 50% } -----|<-- Update progress -------|
   |                           |                           |
   |-- GET /proof/status ----->|                           |
   |<-- { status: completed }--|<-- Proof ready -----------|
   |                           |                           |
```

**Frontend Polling Strategy:**
```typescript
// hooks/useProofStatus.ts
const POLL_INTERVAL = 1000;  // 1 second
const MAX_POLL_TIME = 60000; // 60 seconds timeout

function useProofStatus(jobId: string | null) {
  const [status, setStatus] = useState<ProofStatus | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const startTime = Date.now();

    const poll = async () => {
      const res = await fetch(`/api/proof/status/${jobId}`);
      const data = await res.json();
      setStatus(data.data);

      if (data.data.status === 'completed' || data.data.status === 'failed') {
        return; // Stop polling
      }

      if (Date.now() - startTime > MAX_POLL_TIME) {
        setStatus({ ...status, status: 'failed', error: { message: 'Timeout' } });
        return;
      }

      setTimeout(poll, POLL_INTERVAL);
    };

    poll();
  }, [jobId]);

  return status;
}
```

### 5.2 Optimistic Updates vs Confirmed State

| Action | Optimistic Update | Confirmed Update |
|--------|-------------------|------------------|
| Shield | Show "pending" position immediately after signing | Update to "confirmed" after RPC confirmation |
| Unshield | Show progress bar during proof gen | Remove position after tx confirmation |
| Pool stats | N/A (always fetched fresh) | Update after any shield/unshield |

```typescript
// Example: Shield flow with optimistic updates
async function handleShield() {
  // 1. Prepare (get commitment from backend)
  const { commitment, secret, instruction } = await prepareShield(amount);

  // 2. Optimistic: Add pending position
  addPosition({
    commitment,
    secret,
    amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    txSignature: '',
  });

  // 3. Sign and send transaction
  const signature = await signAndSendTransaction(instruction);

  // 4. Update position with signature (still pending)
  updatePosition(commitment, { txSignature: signature });

  // 5. Wait for confirmation
  const confirmed = await waitForConfirmation(signature);

  // 6. Final: Mark as confirmed
  updatePosition(commitment, { status: 'confirmed' });
}
```

### 5.3 Wallet Connection State Machine

```
                    ┌─────────────┐
                    │ Disconnected│
                    └──────┬──────┘
                           │ connect()
                           ▼
                    ┌─────────────┐
                    │ Connecting  │
                    └──────┬──────┘
                           │ success/fail
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │  Connected  │          │   Error     │
       └──────┬──────┘          └──────┬──────┘
              │ disconnect()           │ retry
              │                        │
              └────────────────────────┘
                         │
                         ▼
                    ┌─────────────┐
                    │ Disconnected│
                    └─────────────┘
```

---

## 6. Error Handling Strategy

### 6.1 Frontend Error Boundaries

```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to monitoring service
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}

// Usage in layout
<ErrorBoundary>
  <WalletProvider>
    <ShieldFlow />
  </WalletProvider>
</ErrorBoundary>
```

### 6.2 API Error Handling

```typescript
// lib/api.ts
class APIError extends Error {
  code: string;
  details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await res.json();

    if (!data.success) {
      throw new APIError(
        data.error.code,
        data.error.message,
        data.error.details
      );
    }

    return data.data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError('NETWORK_ERROR', 'Failed to connect to server');
  }
}
```

### 6.3 On-Chain Error Mapping

```typescript
// lib/errors.ts
const ANCHOR_ERROR_MAP: Record<number, { code: string; message: string }> = {
  // Veil program errors (from instructions.rs)
  6000: { code: 'INVALID_PROOF', message: 'The ZK proof verification failed' },
  6001: { code: 'NULLIFIER_SPENT', message: 'This commitment has already been withdrawn' },
  6002: { code: 'INVALID_AMOUNT', message: 'Invalid amount specified' },
  6003: { code: 'POOL_FULL', message: 'Privacy pool has reached maximum capacity' },
  6004: { code: 'INVALID_ROOT', message: 'Merkle root is not valid or has expired' },
  6005: { code: 'INSUFFICIENT_FUNDS', message: 'Vault has insufficient funds' },

  // Common Anchor errors
  3012: { code: 'ACCOUNT_EXISTS', message: 'Account already exists (double-spend attempt)' },
  2003: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds for transaction' },
};

function parseAnchorError(error: any): { code: string; message: string } {
  // Extract error code from various Anchor error formats
  const errorCode = error?.error?.errorCode?.number
    || error?.InstructionError?.[1]?.Custom
    || error?.logs?.find((l: string) => l.includes('Error Number:'))?.match(/\d+/)?.[0];

  if (errorCode && ANCHOR_ERROR_MAP[errorCode]) {
    return ANCHOR_ERROR_MAP[errorCode];
  }

  // Fallback for unknown errors
  return {
    code: 'UNKNOWN_ERROR',
    message: 'Transaction failed. Please try again.',
  };
}
```

### 6.4 User-Friendly Error Messages

| Technical Error | User Message | Action |
|-----------------|--------------|--------|
| `INVALID_PROOF` | "Verification failed. Please try generating the proof again." | Retry button |
| `NULLIFIER_SPENT` | "This position has already been withdrawn." | Remove from UI |
| `INSUFFICIENT_FUNDS` | "Not enough SOL in your wallet. You need at least X SOL." | Show required amount |
| `NETWORK_ERROR` | "Connection lost. Retrying..." | Auto-retry with backoff |
| `RPC_ERROR` | "Solana network is slow. Please wait..." | Show retry countdown |
| `TIMEOUT` | "This is taking longer than expected. Please try again." | Retry button |

---

## 7. Sequence Diagrams

### 7.1 Shield Flow (Deposit SOL)

```
┌──────┐          ┌──────────┐          ┌──────────┐          ┌────────┐
│ User │          │ Frontend │          │ Backend  │          │ Solana │
└──┬───┘          └────┬─────┘          └────┬─────┘          └───┬────┘
   │                   │                     │                    │
   │ 1. Enter amount   │                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 2. POST /shield/prepare                  │
   │                   │ ───────────────────>│                    │
   │                   │                     │                    │
   │                   │                     │ [Generate secret]  │
   │                   │                     │ [Compute commitment│
   │                   │                     │  via Rust FFI]     │
   │                   │                     │                    │
   │                   │ 3. { commitment,    │ (~500ms)           │
   │                   │    secret, ix }     │                    │
   │                   │ <───────────────────│                    │
   │                   │                     │                    │
   │                   │ 4. Build transaction│                    │
   │                   │ [Store secret locally]                   │
   │                   │                     │                    │
   │ 5. Sign request   │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │
   │ 6. [Wallet popup] │                     │                    │
   │    Approve        │                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 7. sendTransaction  │                    │
   │                   │ ───────────────────────────────────────>│
   │                   │                     │                    │
   │                   │                     │        [Validate]  │
   │                   │                     │        [Add to tree│
   │                   │                     │        [Transfer $]│
   │                   │                     │                    │
   │                   │ 8. Confirmed        │                    │
   │                   │ <───────────────────────────────────────│
   │                   │                     │         (~2-5s)    │
   │                   │                     │                    │
   │ 9. Success!       │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │

Total time: ~5-10 seconds
- Step 2-3: ~500ms (commitment generation)
- Step 5-6: ~3s (user signing)
- Step 7-8: ~2-5s (on-chain confirmation)
```

### 7.2 Unshield Flow (Withdraw SOL)

```
┌──────┐          ┌──────────┐          ┌──────────┐          ┌────────┐
│ User │          │ Frontend │          │ Backend  │          │ Solana │
└──┬───┘          └────┬─────┘          └────┬─────┘          └───┬────┘
   │                   │                     │                    │
   │ 1. Select position│                     │                    │
   │    Enter recipient│                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 2. POST /unshield/proof                  │
   │                   │ ───────────────────>│                    │
   │                   │                     │                    │
   │                   │ 3. { jobId }        │ [Queue proof job]  │
   │                   │ <───────────────────│                    │
   │                   │                     │         (~100ms)   │
   │                   │                     │                    │
   │ 4. [Show loading] │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │
   │                   │ ┌────────────────────────────────────┐   │
   │                   │ │     PROOF GENERATION LOOP          │   │
   │                   │ │  (polling every 1 second)          │   │
   │                   │ └────────────────────────────────────┘   │
   │                   │                     │                    │
   │                   │ 5. GET /proof/status│                    │
   │                   │ ───────────────────>│                    │
   │                   │                     │ [Worker: generate] │
   │                   │ 6. { progress: 30% }│   (~10-30s total)  │
   │ 7. [Update bar]   │ <───────────────────│                    │
   │ <─────────────────│                     │                    │
   │                   │     ... repeat ...  │                    │
   │                   │                     │                    │
   │                   │ 8. { status:        │                    │
   │                   │    completed,       │                    │
   │                   │    proof, nullifier,│                    │
   │                   │    instruction }    │                    │
   │                   │ <───────────────────│                    │
   │                   │                     │                    │
   │                   │ 9. Build transaction│                    │
   │                   │                     │                    │
   │ 10. Sign request  │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │
   │ 11. [Wallet popup]│                     │                    │
   │     Approve       │                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 12. sendTransaction │                    │
   │                   │ ───────────────────────────────────────>│
   │                   │                     │                    │
   │                   │                     │   [Verify proof]   │
   │                   │                     │   [Create nullifier│
   │                   │                     │   [Transfer SOL]   │
   │                   │                     │                    │
   │                   │ 13. Confirmed       │                    │
   │                   │ <───────────────────────────────────────│
   │                   │                     │         (~2-5s)    │
   │                   │                     │                    │
   │ 14. Success!      │                     │                    │
   │     [Confetti]    │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │

Total time: ~20-45 seconds
- Step 2-3: ~100ms (job creation)
- Step 5-8: ~10-30s (proof generation)
- Step 10-11: ~3s (user signing)
- Step 12-13: ~2-5s (on-chain confirmation)
```

### 7.3 Relayer Unshield Flow *(V2)*

```
┌──────┐          ┌──────────┐          ┌──────────┐          ┌────────┐
│ User │          │ Frontend │          │ Backend  │          │ Solana │
└──┬───┘          └────┬─────┘          └────┬─────┘          └───┬────┘
   │                   │                     │                    │
   │ 1. Select position│                     │                    │
   │    Enter recipient│                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 2. POST /relay/unshield                  │
   │                   │ ───────────────────>│                    │
   │                   │                     │                    │
   │                   │ 3. { jobId }        │ [Generate proof]   │
   │                   │ <───────────────────│                    │
   │                   │                     │                    │
   │                   │   ... poll ...      │ [Proof ready]      │
   │                   │                     │                    │
   │                   │                     │ 4. Relayer signs   │
   │                   │                     │    unshield tx     │
   │                   │                     │ ──────────────────>│
   │                   │                     │                    │
   │                   │                     │    [Verify proof]  │
   │                   │                     │    [Transfer SOL]  │
   │                   │                     │                    │
   │                   │ 5. { status:        │                    │
   │                   │    completed,       │                    │
   │                   │    txSignature }    │                    │
   │                   │ <───────────────────│                    │
   │                   │                     │                    │
   │ 6. Success!       │                     │                    │
   │ <─────────────────│                     │                    │

Key difference from V1: User NEVER signs the unshield tx.
The relayer submits on their behalf, breaking the on-chain link.
```

### 7.4 Private Swap Flow *(V3)*

```
┌──────┐          ┌──────────┐          ┌──────────┐   ┌─────────┐   ┌────────┐
│ User │          │ Frontend │          │ Backend  │   │ Jupiter │   │ Solana │
└──┬───┘          └────┬─────┘          └────┬─────┘   └────┬────┘   └───┬────┘
   │                   │                     │              │            │
   │ 1. Select position│                     │              │            │
   │    Select token   │                     │              │            │
   │    Enter recipient│                     │              │            │
   │ ─────────────────>│                     │              │            │
   │                   │                     │              │            │
   │                   │ 2. GET /swap/quote  │              │            │
   │                   │ ───────────────────>│──────────────>            │
   │                   │                     │              │            │
   │                   │ 3. { rate, output } │              │            │
   │ 4. Review quote   │ <──────────────────────────────────│            │
   │ <─────────────────│                     │              │            │
   │                   │                     │              │            │
   │ 5. Confirm swap   │                     │              │            │
   │ ─────────────────>│                     │              │            │
   │                   │                     │              │            │
   │                   │ 6. POST /swap/execute               │            │
   │                   │ ───────────────────>│              │            │
   │                   │                     │              │            │
   │                   │   ... poll ...      │ [Gen proof]  │            │
   │                   │                     │              │            │
   │                   │                     │ 7. Relayer   │            │
   │                   │                     │  unshields   │            │
   │                   │                     │ ─────────────────────────>│
   │                   │                     │              │            │
   │                   │                     │ 8. Relayer swaps         │
   │                   │                     │    SOL → token│           │
   │                   │                     │ ─────────────>│           │
   │                   │                     │              │            │
   │                   │                     │ 9. Relayer sends         │
   │                   │                     │    token to recipient    │
   │                   │                     │ ─────────────────────────>│
   │                   │                     │              │            │
   │                   │ 10. { completed,    │              │            │
   │                   │     txSignatures }  │              │            │
   │                   │ <───────────────────│              │            │
   │                   │                     │              │            │
   │ 11. Success!      │                     │              │            │
   │ <─────────────────│                     │              │            │

Total time: ~30-60 seconds
- Step 2-3: ~500ms (Jupiter quote)
- Step 6-7: ~10-30s (proof generation + unshield)
- Step 8: ~5-10s (Jupiter swap execution)
- Step 9: ~2-5s (token transfer confirmation)
```

---

## 8. Deployment Architecture

### 8.1 Infrastructure Overview

```
                    ┌─────────────────────────────────────────────┐
                    │                   VERCEL                     │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │         Next.js 14 Frontend             │ │
                    │  │  - Static assets via Edge CDN           │ │
                    │  │  - SSR for initial page load            │ │
                    │  │  - Client-side routing                  │ │
                    │  │  - Client-side AES-256-GCM encryption   │ │
                    │  └──────────┬──────────────────┬───────────┘ │
                    └─────────────┼──────────────────┼────────────┘
                                  │                  │
                    HTTPS (API)   │                  │  HTTPS (Supabase)
                                  │                  │
         ┌────────────────────────▼──┐    ┌──────────▼──────────────┐
         │      RAILWAY / RENDER      │    │        SUPABASE          │
         │  ┌──────────────────────┐  │    │  ┌──────────────────┐   │
         │  │    FastAPI Backend   │  │    │  │   vault_data     │   │
         │  │  - Veil SDK (proofs) │  │    │  │  (encrypted blob │   │
         │  │  - Relayer service   │──┼──┐ │  │   + wallet hash) │   │
         │  │  - Jupiter swap exec │  │  │ │  └──────────────────┘   │
         │  └──────────────────────┘  │  │ │  Frontend-only access.  │
         └────────────┬───────────────┘  │ │  Backend never touches. │
                      │                  │ └─────────────────────────┘
           ┌──────────┴──────────┐       │
           │                     │       │
           ▼                     ▼       ▼
    ┌─────────────┐       ┌──────────────────┐
    │SOLANA DEVNET│       │   JUPITER API    │
    │  Multi-Pool │       │  (token swaps)   │
    │  PDAs (1,10,│       └──────────────────┘
    │  100,1K SOL)│
    └─────────────┘
```

### 8.2 Environment Variables

#### Frontend (.env.local)
```bash
# API
NEXT_PUBLIC_API_URL=https://api.whalevault.app/v1
NEXT_PUBLIC_API_URL_DEV=http://localhost:8000/v1

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy

# Supabase (V3)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Feature flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

#### Backend (.env)
```bash
# Server
HOST=0.0.0.0
PORT=8000
WORKERS=2
DEBUG=false

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy

# Relayer (V2)
RELAYER_KEYPAIR=<base58 encoded keypair>

# Jupiter (V3)
JUPITER_API_URL=https://quote-api.jup.ag/v6

# Pool authority (for pool initialization only - remove after init)
# POOL_AUTHORITY_KEYPAIR=<base58 encoded keypair>

# Proof generation
PROOF_TIMEOUT_SECONDS=60
MAX_CONCURRENT_PROOFS=2

# CORS
CORS_ORIGINS=https://whalevault.app,http://localhost:3000

# Logging
LOG_LEVEL=INFO
```

### 8.3 CORS Configuration

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="WhaleVault API", version="1.0.0")

# CORS settings
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=3600,  # Cache preflight for 1 hour
)
```

### 8.4 Deployment Commands

```bash
# Frontend (Vercel)
# Automatic via GitHub integration, or:
vercel --prod

# Backend (Railway)
# railway.json or Procfile:
web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2

# Backend (Render)
# render.yaml:
services:
  - type: web
    name: whalevault-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: SOLANA_RPC_URL
        value: https://api.devnet.solana.com
```

---

## 9. File/Folder Structure

### 9.1 Frontend (Next.js 14 App Router)

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page (connect wallet CTA)
│   ├── globals.css             # Tailwind imports + custom vars
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard after connect
│   ├── shield/
│   │   └── page.tsx            # Shield flow (+ USDC "Coming Soon")
│   ├── unshield/
│   │   └── page.tsx            # Stealth Withdraw (renamed V3)
│   ├── private-swap/           # V3
│   │   └── page.tsx            # Private Swap flow
│   └── history/                # V3
│       └── page.tsx            # Transaction history
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Navigation + wallet button
│   │   ├── Footer.tsx          # Links, version
│   │   └── MobileNav.tsx       # Bottom nav for mobile
│   │
│   ├── wallet/
│   │   ├── WalletProvider.tsx  # Solana wallet adapter setup
│   │   ├── ConnectButton.tsx   # Connect/disconnect button
│   │   └── WalletModal.tsx     # Wallet selection modal
│   │
│   ├── dashboard/
│   │   ├── PoolStats.tsx       # TVL per denomination, anonymity sets
│   │   ├── PositionsList.tsx   # User's shielded positions
│   │   ├── PositionCard.tsx    # Single position (w/ delay countdown)
│   │   └── ActivityFeed.tsx    # Recent pool activity
│   │
│   ├── shield/
│   │   ├── ShieldForm.tsx      # Amount input + balance
│   │   ├── DenominationSelector.tsx # V2: denomination picker
│   │   ├── AmountInput.tsx     # SOL amount with max button
│   │   └── ShieldConfirm.tsx   # Review + sign modal
│   │
│   ├── unshield/
│   │   ├── UnshieldForm.tsx    # Position + recipient form
│   │   ├── PositionSelector.tsx# Select position dropdown
│   │   ├── RecipientInput.tsx  # Address input with validation
│   │   ├── PrivacyDelay.tsx    # V3: opt-in delay toggle (1h/6h/24h)
│   │   └── UnshieldConfirm.tsx # Review + sign modal
│   │
│   ├── swap/                   # V3
│   │   ├── TokenSelector.tsx   # Searchable token dropdown
│   │   └── SwapQuote.tsx       # Rate, output, slippage display
│   │
│   ├── history/                # V3
│   │   ├── TransactionList.tsx # Filtered transaction list
│   │   └── TransactionCard.tsx # Single transaction entry
│   │
│   ├── proof/
│   │   ├── ProofProgress.tsx   # Progress bar + stage text
│   │   └── ProofAnimation.tsx  # Animated particles/orbs
│   │
│   ├── feedback/
│   │   ├── SuccessConfetti.tsx # Canvas confetti on success
│   │   ├── ErrorDisplay.tsx    # Error message with retry
│   │   └── Toast.tsx           # Toast notifications (Sonner)
│   │
│   └── ui/                     # Shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── progress.tsx
│       └── skeleton.tsx
│
├── hooks/
│   ├── useShield.ts            # Shield flow logic
│   ├── useUnshield.ts          # Unshield flow logic (+ delay check)
│   ├── usePrivateSwap.ts       # V3: Private Swap flow
│   ├── useVaultStorage.ts      # V3: Supabase encrypted storage
│   ├── useProofStatus.ts       # Proof polling
│   ├── usePools.ts             # V2: multi-pool stats
│   └── useWallet.ts            # Wallet state wrapper
│
├── stores/
│   ├── wallet.ts               # Zustand wallet store
│   ├── shield.ts               # Zustand shield store
│   ├── unshield.ts             # Zustand unshield store
│   ├── vaultStorage.ts         # V3: Zustand vault storage (Supabase)
│   ├── privateSwap.ts          # V3: Zustand swap store
│   └── pool.ts                 # Zustand pool store (multi-pool)
│
├── lib/
│   ├── api.ts                  # API client with error handling
│   ├── solana.ts               # Solana utilities (PDA derivation)
│   ├── supabase.ts             # V3: Supabase client init
│   ├── encryption.ts           # V3: AES-256-GCM encrypt/decrypt
│   ├── tokens.ts               # V3: Featured tokens + Jupiter API
│   ├── receipt.ts              # V3: Deposit receipt export/import
│   ├── errors.ts               # Error mapping
│   ├── utils.ts                # General utilities
│   └── constants.ts            # Program ID, seeds, denominations
│
├── types/
│   ├── api.ts                  # API request/response types
│   ├── position.ts             # Position types (V3 updated)
│   └── pool.ts                 # Pool types
│
├── public/
│   ├── logo.svg
│   ├── whale-icon.svg
│   └── og-image.png
│
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

### 9.2 Backend (FastAPI)

```
backend/
├── main.py                     # FastAPI app entry point
│
├── api/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── shield.py           # POST /api/shield/prepare
│   │   ├── unshield.py         # POST /api/unshield/proof
│   │   ├── relay.py            # V2: POST /api/relay/unshield, GET /api/relay/info
│   │   ├── swap.py             # V3: GET /api/swap/quote, POST /api/swap/execute
│   │   ├── proof.py            # GET /api/proof/status/{id}
│   │   ├── pool.py             # GET /api/pool/status, /api/pool/status/{denomination}
│   │   └── health.py           # GET /api/health
│   │
│   └── middleware/
│       ├── __init__.py
│       ├── error_handler.py    # Global exception handling
│       └── logging.py          # Request logging
│
├── models/
│   ├── __init__.py
│   ├── requests.py             # Pydantic request models (+ relay, swap)
│   ├── responses.py            # Pydantic response models (+ relay, swap)
│   └── errors.py               # Error codes and messages
│
├── services/
│   ├── __init__.py
│   ├── veil_service.py         # Veil SDK wrapper
│   ├── proof_service.py        # Proof generation management
│   ├── relay_service.py        # V2: Relayer tx submission
│   ├── jupiter_service.py      # V3: Jupiter API quote + swap
│   ├── pool_service.py         # Pool state fetching (multi-pool)
│   └── solana_service.py       # Solana RPC client
│
├── workers/
│   ├── __init__.py
│   └── proof_worker.py         # Background proof generation
│
├── utils/
│   ├── __init__.py
│   ├── validation.py           # Input validation helpers
│   └── encoding.py             # Hex/base58 conversion
│
├── config.py                   # Settings from environment (+ Jupiter, relayer)
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 9.3 Key Files and Responsibilities

| File | Responsibility |
|------|----------------|
| `frontend/app/layout.tsx` | Root layout with WalletProvider, Toaster, error boundary |
| `frontend/components/wallet/WalletProvider.tsx` | Solana wallet adapter configuration |
| `frontend/stores/vaultStorage.ts` | V3: Position CRUD with Supabase encrypted persistence |
| `frontend/hooks/useVaultStorage.ts` | V3: Encrypt/decrypt positions, sync to Supabase |
| `frontend/hooks/usePrivateSwap.ts` | V3: Private Swap flow (quote → execute → poll) |
| `frontend/lib/encryption.ts` | V3: AES-256-GCM encrypt/decrypt, wallet-derived key |
| `frontend/lib/supabase.ts` | V3: Supabase client initialization |
| `frontend/lib/tokens.ts` | V3: Featured token list + Jupiter token API |
| `frontend/lib/api.ts` | Typed API client with automatic error parsing |
| `backend/main.py` | FastAPI app with CORS, routes, middleware |
| `backend/services/veil_service.py` | Wraps Veil SDK for commitment/proof generation |
| `backend/services/relay_service.py` | V2: Relayer keypair management + tx submission |
| `backend/services/jupiter_service.py` | V3: Jupiter API quote fetching + swap execution |
| `backend/workers/proof_worker.py` | Async proof generation with progress updates |
| `backend/api/routes/relay.py` | V2: Relayer unshield + info endpoints |
| `backend/api/routes/swap.py` | V3: Swap quote + execute endpoints |

---

## 10. Alternatives Considered

### 10.1 Client-Side Proof Generation

**Description:** Generate ZK proofs in the browser using WASM.

**Pros:**
- No backend dependency for proofs
- User secrets never leave the browser
- Simpler deployment (static site only)

**Cons:**
- Veil SDK uses Rust FFI, not WASM-compatible without significant work
- Browser memory constraints for large circuits
- Inconsistent performance across devices

**When to choose:** If Veil SDK had WASM bindings and we had 2+ weeks.

---

### 10.2 WebSocket for Proof Status

**Description:** Use WebSocket instead of polling for proof progress.

**Pros:**
- Real-time updates without polling overhead
- Lower latency for status changes

**Cons:**
- More complex backend state management
- Connection management complexity
- Overkill for 10-30 second operations

**When to choose:** If we had multiple concurrent proof operations per user.

---

### 10.3 Redis for Job Queue

**Description:** Use Redis instead of in-memory queue for proof jobs.

**Pros:**
- Persistent across server restarts
- Horizontally scalable
- Shared state across workers

**Cons:**
- Additional infrastructure dependency
- Overkill for hackathon demo
- Added complexity

**When to choose:** For production deployment with high concurrency.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Proof generation exceeds 30s | Medium | High | Show progress stages, set user expectations, implement timeout with graceful failure |
| Devnet RPC rate limiting | Low | Medium | Implement exponential backoff, use backup RPC endpoint |
| User closes tab during proof gen | Medium | Medium | Store job ID in localStorage, allow resume on return |
| Wallet adapter compatibility issues | Low | Medium | Test with top 3 wallets, graceful fallback to manual signing |
| Secret exposure in localStorage | Medium | High | Encrypt secrets with user-derived key, warn users about browser security |
| Backend single point of failure | High | High | Accept for MVP, document Railway/Render auto-restart |
| Program compute budget exceeded | Low | High | Already tested at ~200k CU, within 1.4M limit |
| Mobile UX issues | Medium | Low | Test on iPhone/Android, ensure touch targets are large enough |

---

## 12. Open Questions

### Resolved (V2/V3)

1. **Secret Storage**: ✅ **RESOLVED** — AES-256-GCM encryption with wallet-signature-derived key. Encrypted blob stored in Supabase. Key = SHA-256(wallet signature of "WhaleVault-v1"). Wallet hash = SHA-256(pubkey) for lookup.

2. **Proof Job Expiry**: 5 minutes in memory, then require re-generation.

3. **Position Sync**: ✅ **RESOLVED** — Yes, via Supabase encrypted cloud backup. Positions auto-sync on shield/unshield. Disconnect and reconnect on any device → positions restored.

4. **Pool Stats Caching**: 30-second cache, refresh on shield/unshield.

5. **Transaction History**: ✅ **RESOLVED** — Supabase encrypted blob (positions array with full metadata). History page reads from same source. Solscan links via tx signatures.

6. **Error Retry Strategy**: 3 retries with exponential backoff (1s, 2s, 4s).

### Still Open (Low Priority / Polish Phase)

7. **Analytics**: Track proof generation times for optimization?
8. **Sound Effects**: Include on success/error?
9. **Dark/Light Mode**: Dark mode is default. Light mode toggle deferred.

---

## Appendix A: Program ID and PDAs

```typescript
// Constants
const PROGRAM_ID = "A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy";

// PDA Derivations (using @solana/web3.js) — V2: multi-pool
function getPoolPDA(programId: PublicKey, denomination: bigint): [PublicKey, number] {
  const denomBytes = Buffer.alloc(8);
  denomBytes.writeBigUInt64LE(denomination);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("privacy_pool"), denomBytes],
    programId
  );
}

function getVaultPDA(programId: PublicKey, pool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), pool.toBuffer()],
    programId
  );
}

function getNullifierPDA(
  programId: PublicKey,
  pool: PublicKey,
  nullifier: Buffer
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), pool.toBuffer(), nullifier],
    programId
  );
}
```

---

## Appendix B: Instruction Discriminators

```typescript
// From Veil SDK - first 8 bytes of sha256("global:<instruction_name>")
const DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  shieldSol: Buffer.from([183, 4, 24, 123, 20, 45, 203, 91]),
  shield: Buffer.from([112, 186, 93, 111, 79, 168, 36, 51]),
  transfer: Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]),
  unshieldSol: Buffer.from([45, 127, 188, 9, 224, 78, 199, 57]),
  unshield: Buffer.from([126, 89, 240, 247, 56, 193, 126, 10]),
};
```

---

---

## 13. Future: Private Yield Architecture

> **Status:** Coming Soon — See `/docs/plans/private-yield-design.md` for full design.

### 13.1 High-Level Approach

Private Yield acts as a **privacy wrapper** around existing Solana yield protocols (Jito, Kamino). Users deposit shielded assets, WhaleVault aggregates them, and deploys to yield protocols. Individual positions remain hidden — only the aggregate is visible on-chain.

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRIVATE YIELD FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User's Shielded Position                                       │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                            │
│  │  Deposit to     │  User proves ownership, backend unshields │
│  │  Yield          │  and deposits to yield protocol           │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              WhaleVault Yield Aggregator                 │    │
│  │  - Aggregates all user deposits                         │    │
│  │  - Deposits aggregate to Jito/Kamino                    │    │
│  │  - Tracks user shares (encrypted in Supabase)           │    │
│  │  - Distributes yield proportionally                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  ON-CHAIN (Visible)                        │  │
│  │  "WhaleVault vault staked 50,000 SOL with Jito"           │  │
│  │                                                            │  │
│  │  Individual user deposits: HIDDEN                         │  │
│  │  Individual user shares: HIDDEN                           │  │
│  │  Individual withdrawals: HIDDEN (goes through relayer)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Key Components (Future Implementation)

| Component | Description |
|-----------|-------------|
| `/api/yield/protocols` | List available protocols with current APY |
| `/api/yield/deposit` | Deposit shielded position to yield protocol |
| `/api/yield/withdraw` | Withdraw with accumulated yield |
| `YieldPosition` type | Encrypted position with share accounting |
| `usePrivateYield` hook | Frontend state management for yield flow |

### 13.3 Supported Protocols (Planned)

| Protocol | Type | Risk | Priority |
|----------|------|------|----------|
| **Jito** | Liquid Staking | Low | First integration |
| **Kamino** | Lending | Medium | Second integration |

---

*Document generated: January 25, 2026*
*Updated for V2 (multi-pool, relayer) + V3 (Supabase, Private Swap, Stealth Withdraw): January 27, 2026*
*Updated for V5 Private Yield architecture preview: January 29, 2026*
*Ready for implementation*
