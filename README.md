# WhaleVault

A privacy layer for Solana powered by zero-knowledge proofs.

## Overview

WhaleVault enables private transactions on Solana through fixed-denomination pools, zkSNARK proofs, and relayer-based withdrawals. Every Solana transaction is public—WhaleVault makes yours invisible.

## Features

- **Shield** - Deposit SOL into fixed-denomination pools (1 SOL, 10 SOL) creating an anonymity set
- **Send to Wallet** - Withdraw privately to any address using zkSNARK proofs
- **Send Shielded Position** - Transfer ownership without unshielding (maximum privacy)
- **Private Swap** - Swap shielded SOL for other tokens via DEX aggregators

## How It Works

**Shielding**: The Veil SDK generates commitments and random secrets. SOL is deposited into the pool and the commitment is added to an on-chain Merkle tree.

**Withdrawing**: A Groth16 zkSNARK proof verifies ownership without revealing which deposit is yours. A relayer submits the transaction—your wallet never signs the withdrawal.

**Private Transfers**: The sender's commitment is nullified and a new commitment is created for the recipient. Funds never leave the pool—only ownership changes on-chain.

**Private Swaps**: After unshielding, the relayer executes token swaps before sending to the recipient.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, Helius RPC |
| Backend | FastAPI, Veil SDK |
| Cryptography | Groth16 proofs (arkworks/Rust), Poseidon hash, Pedersen commitments |
| On-chain | Anchor program, groth16-solana verifier |
| Swaps | Raydium API (devnet), Jupiter (mainnet) |
| Storage | Supabase |

## Future Plans

### Near-Term Enhancements
- **Additional denomination pools** (0.1, 5, 50 SOL) for more flexibility
- **Privacy delay scheduling** - Users choose when withdrawals execute, breaking timing correlations
- **Enhanced transaction history** with privacy scores and anonymity set metrics

### Technical Innovations
- **Decentralized relayer network** - Remove single point of trust, multiple independent relayers compete to submit transactions
- **Stealth addresses** - Recipients generate one-time addresses, no need to share public keys
- **Batch proofs** - Aggregate multiple withdrawals into single transactions for lower fees

### Ecosystem Expansion
- **SPL token support** - Shield USDC, BONK, and other Solana tokens
- **Developer SDK** - Enable other dApps to integrate private payments
- **Private NFT transfers** - Extend privacy to digital collectibles

### Long-Term Vision
- **Cross-chain bridges** - Private transfers to/from EVM chains
- **Mobile application** - Native iOS/Android experience
- **Institutional compliance mode** - Optional proof-of-source for regulated entities

## Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

## License

MIT
