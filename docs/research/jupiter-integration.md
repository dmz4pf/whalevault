# Jupiter V6 Swap API Integration Guide

> Research document for WhaleVault V3 Private Swap relayer integration.
> Last updated: 2026-01-27

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Quote Endpoint](#1-quote-endpoint)
3. [Swap Endpoint](#2-swap-endpoint)
4. [Token List Endpoint](#3-token-list-endpoint)
5. [Server-Side Execution Flow](#4-server-side-execution-flow-relayer-pattern)
6. [Rate Limits & Error Codes](#5-rate-limits--error-codes)
7. [Featured Token Mints](#6-featured-token-mints)

---

## API Overview

**Base URL (current):** `https://api.jup.ag/swap/v1`

> **DEPRECATION NOTICE:** `lite-api.jup.ag` and the `/v6` path are being deprecated on 31 January 2026. The new canonical base is `https://api.jup.ag/swap/v1`. All examples in this document use the new base URL.

**Legacy base (still works as of Jan 2026):** `https://quote-api.jup.ag/v6`

The flow is always: **Quote** -> **Swap** -> **Sign & Send**.

---

## 1. Quote Endpoint

```
GET https://api.jup.ag/swap/v1/quote
```

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `inputMint` | string | Yes | - | Mint address of the input token |
| `outputMint` | string | Yes | - | Mint address of the output token |
| `amount` | uint64 | Yes | - | Amount in **smallest unit** (lamports for SOL, i.e. 1 SOL = 1000000000) |
| `slippageBps` | uint16 | No | 50 | Slippage tolerance in basis points (50 = 0.5%) |
| `swapMode` | string | No | ExactIn | `ExactIn` or `ExactOut` |
| `dexes` | string[] | No | - | Comma-separated; route uses ONLY these DEXes |
| `excludeDexes` | string[] | No | - | Comma-separated; route excludes these DEXes |
| `restrictIntermediateTokens` | boolean | No | true | Limits intermediate tokens to stable ones |
| `onlyDirectRoutes` | boolean | No | false | Single-hop only (may give worse price) |
| `asLegacyTransaction` | boolean | No | false | Use legacy tx instead of versioned |
| `platformFeeBps` | uint16 | No | - | Fee in bps; requires `feeAccount` in /swap |
| `maxAccounts` | uint64 | No | 64 | Max accounts estimate for the quote |

### Example: Quote for 1 SOL -> USDC

```bash
curl -s "https://api.jup.ag/swap/v1/quote?\
inputMint=So11111111111111111111111111111111111111112&\
outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&\
amount=1000000000&\
slippageBps=50"
```

### Response Shape (`QuoteResponse`)

```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "inAmount": "1000000000",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outAmount": "187550000",
  "otherAmountThreshold": "186612250",
  "swapMode": "ExactIn",
  "slippageBps": 50,
  "platformFee": {
    "amount": "0",
    "feeBps": 0
  },
  "priceImpactPct": "0.0012",
  "routePlan": [
    {
      "swapInfo": {
        "ammKey": "...",
        "label": "Raydium CLMM",
        "inputMint": "So11111111111111111111111111111111111111112",
        "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "inAmount": "1000000000",
        "outAmount": "187550000",
        "feeAmount": "150000",
        "feeMint": "So11111111111111111111111111111111111111112"
      },
      "percent": 100
    }
  ],
  "contextSlot": 312000000,
  "timeTaken": 0.035
}
```

**Key fields for our relayer:**
- `outAmount` - the expected output (before slippage)
- `otherAmountThreshold` - minimum acceptable output (after slippage)
- The entire `QuoteResponse` object is passed directly to the `/swap` endpoint

---

## 2. Swap Endpoint

```
POST https://api.jup.ag/swap/v1/swap
Content-Type: application/json
```

### Request Body

```json
{
  "quoteResponse": { /* entire QuoteResponse from step 1 */ },
  "userPublicKey": "YourWalletPublicKeyBase58",
  "wrapAndUnwrapSol": true,
  "dynamicComputeUnitLimit": true,
  "dynamicSlippage": true,
  "prioritizationFeeLamports": {
    "priorityLevelWithMaxLamports": {
      "maxLamports": 1000000,
      "priorityLevel": "veryHigh"
    }
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `quoteResponse` | object | Yes | Full quote response from `/quote` |
| `userPublicKey` | string | Yes | Base58 public key of the signer/payer |
| `wrapAndUnwrapSol` | boolean | No | Auto wrap/unwrap SOL (default true) |
| `dynamicComputeUnitLimit` | boolean | No | Auto-estimate compute units |
| `dynamicSlippage` | boolean | No | Dynamic slippage adjustment |
| `prioritizationFeeLamports` | object | No | Priority fee config |
| `asLegacyTransaction` | boolean | No | Use legacy tx format |
| `feeAccount` | string | No | Required if `platformFeeBps` was set in quote |

### Response Shape

```json
{
  "swapTransaction": "base64-encoded-serialized-transaction...",
  "lastValidBlockHeight": 312000500,
  "prioritizationFeeLamports": 5000,
  "computeUnitLimit": 400000,
  "prioritizationType": {
    "computeBudget": {
      "microLamports": 12500,
      "estimatedMicroLamports": 10000
    }
  },
  "dynamicSlippageReport": {
    "slippageBps": 50,
    "otherAmount": 186612250,
    "simulatedIncurredSlippageBps": 5
  },
  "simulationError": null
}
```

**Critical:** `swapTransaction` is a base64-encoded serialized `VersionedTransaction`. The relayer must deserialize, sign, and submit it.

---

## 3. Token List Endpoint

```
GET https://token.jup.ag/all       # All known tokens (~14,000+)
GET https://token.jup.ag/strict    # Verified/strict tokens only (~500)
```

### Response Shape (array of tokens)

```json
[
  {
    "address": "So11111111111111111111111111111111111111112",
    "chainId": 101,
    "decimals": 9,
    "name": "Wrapped SOL",
    "symbol": "SOL",
    "logoURI": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    "tags": ["old-registry"],
    "extensions": {}
  }
]
```

**For WhaleVault UI:** Use the `strict` list for the token selector dropdown. Cache it (refreshes rarely). Index by `address` for O(1) lookup.

---

## 4. Server-Side Execution Flow (Relayer Pattern)

This is the critical path for WhaleVault's privacy-preserving swap. The relayer acts as the signer so the user's wallet never touches the DEX directly.

### Flow

```
User (shielded funds)
  -> WhaleVault Relayer (server-side)
    -> Jupiter Quote API
    -> Jupiter Swap API
    -> Deserialize tx
    -> Sign with relayer keypair
    -> Submit to Solana RPC
  -> Output tokens sent to user's unshield address
```

### Python Implementation

```python
"""
Jupiter V6 Swap - Server-side relayer execution
Dependencies: pip install solana solders httpx base64
"""
import base64
import httpx
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed

JUPITER_BASE = "https://api.jup.ag/swap/v1"
SOLANA_RPC = "https://api.mainnet-beta.solana.com"

# --- Load relayer keypair from env/secret manager ---
# NEVER hardcode. Load from environment or vault.
import json, os
relayer_keypair = Keypair.from_bytes(
    bytes(json.loads(os.environ["RELAYER_KEYPAIR_JSON"]))
)


async def execute_swap(
    input_mint: str,
    output_mint: str,
    amount: int,  # in smallest unit (lamports for SOL)
    slippage_bps: int = 50,
) -> str:
    """
    Execute a swap through Jupiter on behalf of shielded user.
    Returns the transaction signature.
    """
    async with httpx.AsyncClient(timeout=30) as http:
        # Step 1: Get quote
        quote_resp = await http.get(
            f"{JUPITER_BASE}/quote",
            params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": str(amount),
                "slippageBps": slippage_bps,
                "restrictIntermediateTokens": "true",
            },
        )
        quote_resp.raise_for_status()
        quote = quote_resp.json()

        # Sanity check: ensure we got a valid quote
        if not quote.get("outAmount"):
            raise ValueError(f"No route found for {input_mint} -> {output_mint}")

        # Step 2: Get swap transaction
        swap_resp = await http.post(
            f"{JUPITER_BASE}/swap",
            json={
                "quoteResponse": quote,
                "userPublicKey": str(relayer_keypair.pubkey()),
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "dynamicSlippage": True,
                "prioritizationFeeLamports": {
                    "priorityLevelWithMaxLamports": {
                        "maxLamports": 1_000_000,
                        "priorityLevel": "veryHigh",
                    }
                },
            },
        )
        swap_resp.raise_for_status()
        swap_data = swap_resp.json()

        # Check for simulation errors
        if swap_data.get("simulationError"):
            raise RuntimeError(
                f"Swap simulation failed: {swap_data['simulationError']}"
            )

        # Step 3: Deserialize and sign
        raw_tx = base64.b64decode(swap_data["swapTransaction"])
        tx = VersionedTransaction.from_bytes(raw_tx)

        # Sign the transaction message with our relayer keypair
        signed_tx = VersionedTransaction(
            tx.message,
            [relayer_keypair],
        )

        # Step 4: Submit to Solana
        async with AsyncClient(SOLANA_RPC) as rpc:
            tx_sig = await rpc.send_raw_transaction(
                bytes(signed_tx),
                opts={
                    "skip_preflight": False,
                    "preflight_commitment": Confirmed,
                    "max_retries": 3,
                },
            )

            # Wait for confirmation
            await rpc.confirm_transaction(
                tx_sig.value,
                commitment=Confirmed,
                last_valid_block_height=swap_data["lastValidBlockHeight"],
            )

            return str(tx_sig.value)


# --- Usage example ---
# import asyncio
# sig = asyncio.run(execute_swap(
#     input_mint="So11111111111111111111111111111111111111112",   # SOL
#     output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", # USDC
#     amount=1_000_000_000,  # 1 SOL
#     slippage_bps=100,      # 1%
# ))
# print(f"Swap executed: https://solscan.io/tx/{sig}")
```

### TypeScript/Node.js Implementation (Alternative)

```typescript
import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const JUPITER_BASE = "https://api.jup.ag/swap/v1";
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Load relayer keypair from secret
const relayerKeypair = Keypair.fromSecretKey(
  bs58.decode(process.env.RELAYER_SECRET_KEY!)
);

async function executeSwap(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps = 50
): Promise<string> {
  // 1. Quote
  const quoteUrl = new URL(`${JUPITER_BASE}/quote`);
  quoteUrl.searchParams.set("inputMint", inputMint);
  quoteUrl.searchParams.set("outputMint", outputMint);
  quoteUrl.searchParams.set("amount", amount.toString());
  quoteUrl.searchParams.set("slippageBps", slippageBps.toString());

  const quote = await fetch(quoteUrl).then((r) => r.json());

  // 2. Swap transaction
  const swapData = await fetch(`${JUPITER_BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: relayerKeypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1_000_000,
          priorityLevel: "veryHigh",
        },
      },
    }),
  }).then((r) => r.json());

  if (swapData.simulationError) {
    throw new Error(`Simulation failed: ${JSON.stringify(swapData.simulationError)}`);
  }

  // 3. Deserialize, sign, send
  const txBuf = Buffer.from(swapData.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([relayerKeypair]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  // 4. Confirm
  await connection.confirmTransaction({
    signature: sig,
    blockhash: tx.message.recentBlockhash,
    lastValidBlockHeight: swapData.lastValidBlockHeight,
  });

  return sig;
}
```

---

## 5. Rate Limits & Error Codes

### Rate Limits

| Tier | Limit | Window | Notes |
|---|---|---|---|
| **Lite (free)** | ~60 requests | 60 seconds | Sliding window. Public, no key required |
| **Pro** | Higher limits | 10 seconds | Paid plan, per-account limits |
| **QuickNode Metis (free)** | 10 req/s | - | Up to 25M requests/month |
| **QuickNode Metis (mid)** | 50 req/s | - | Up to 130M requests/month |
| **QuickNode Metis (top)** | 999 req/s | - | Enterprise tier |

When rate limited, the API returns HTTP `429 Too Many Requests`.

**For WhaleVault:** The free Lite tier is sufficient for initial launch. At scale, use QuickNode Metis or self-host the Jupiter swap API binary.

### Common Error Codes

| Code | Meaning | Action |
|---|---|---|
| `6001` | Slippage tolerance exceeded | Retry with higher `slippageBps` or use `dynamicSlippage: true` |
| `-1005` | Transaction expired | Retry immediately; the blockhash went stale |
| `429` (HTTP) | Rate limited | Back off and retry after window resets |
| `simulationError` in response | Tx simulation failed | Check logs; often means insufficient balance or account issues |
| `custom program error: #XXXX` | DEX-specific error | Check the specific DEX program's IDL for error code meaning |

### Troubleshooting Tips

1. **"No route found"**: The token pair may have no liquidity. Check if mints are correct.
2. **Transaction too large**: Reduce `maxAccounts` or use `onlyDirectRoutes: true`.
3. **Stale quotes**: Quotes expire quickly. Fetch and submit within ~10 seconds.
4. **SOL wrapping issues**: Ensure `wrapAndUnwrapSol: true` when swapping native SOL.

---

## 6. Featured Token Mints

For the WhaleVault swap UI token selector:

```typescript
export const FEATURED_TOKENS = {
  SOL: {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  USDC: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  USDT: {
    mint: "Es9vMF1kJgwSuLmfQRPScmLvVQ9iP5EBmqPevEfpZ3nQ",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMF1kJgwSuLmfQRPScmLvVQ9iP5EBmqPevEfpZ3nQ/logo.png",
  },
  BONK: {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  },
  JUP: {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
  },
  WIF: {
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    symbol: "WIF",
    name: "dogwifhat",
    decimals: 6,
    logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiez5tczwuq5vwa5tcm.ipfs.nftstorage.link",
  },
} as const;
```

---

## Sources

- [Jupiter Quote API Reference](https://dev.jup.ag/api-reference/swap/quote)
- [Jupiter Swap API Docs](https://dev.jup.ag/docs/swap-api/build-swap-transaction)
- [Jupiter API Rate Limits](https://dev.jup.ag/docs/api-rate-limit)
- [Jupiter Python SDK](https://github.com/0xTaoDev/jupiter-python-sdk)
- [QuickNode Metis Jupiter API](https://marketplace.quicknode.com/add-on/metis-jupiter-swap-api)
- [Helius + Jupiter Integration Guide](https://www.helius.dev/docs/sending-transactions/jupiter-swap-api-via-sender)
