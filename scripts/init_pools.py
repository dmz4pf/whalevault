"""
Initialize denomination pools on-chain.

Creates pool PDAs for each fixed denomination (0.1 SOL, 1 SOL, 10 SOL)
and the custom pool (denomination=0).

Usage:
    python scripts/init_pools.py [--keypair PATH] [--rpc URL] [--program-id ID]
"""

import argparse
import asyncio
import hashlib
import json
import struct
import sys
from pathlib import Path

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.instruction import Instruction, AccountMeta
from solders.transaction import Transaction
from solders.message import Message
from solders.system_program import ID as SYSTEM_PROGRAM_ID


POOL_SEED = b"pool"
PROGRAM_ID = "3qhVPvz8T1WiozCLEfhUuv8WZHDPpEfnAzq2iSatULc7"
RPC_URL = "https://solana-devnet.g.alchemy.com/v2/XKYOAeu10iSorSwkdhh3c"

DENOMINATIONS = [
    (0, "Custom"),
    (100_000_000, "0.1 SOL"),
    (1_000_000_000, "1 SOL"),
    (10_000_000_000, "10 SOL"),
    (100_000_000_000, "100 SOL"),
    (1_000_000_000_000, "1K SOL"),
    (10_000_000_000_000, "10K SOL"),
]


def find_pool_pda(program_id: Pubkey, denomination: int) -> tuple[Pubkey, int]:
    denom_bytes = denomination.to_bytes(8, byteorder="little")
    return Pubkey.find_program_address([POOL_SEED, denom_bytes], program_id)


def build_initialize_ix(program_id: Pubkey, authority: Pubkey, denomination: int) -> Instruction:
    """Build the Anchor initialize instruction for a pool."""
    pool_pda, _ = find_pool_pda(program_id, denomination)

    # Anchor discriminator: sha256("global:initialize")[:8]
    discriminator = hashlib.sha256(b"global:initialize").digest()[:8]
    # Instruction data: discriminator + denomination (u64 LE)
    data = discriminator + struct.pack("<Q", denomination)

    accounts = [
        AccountMeta(pool_pda, is_signer=False, is_writable=True),
        AccountMeta(authority, is_signer=True, is_writable=True),
        AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
    ]

    return Instruction(program_id, data, accounts)


async def check_pool_exists(client: AsyncClient, program_id: Pubkey, denomination: int) -> bool:
    pool_pda, _ = find_pool_pda(program_id, denomination)
    resp = await client.get_account_info(pool_pda, commitment=Confirmed)
    return resp.value is not None


async def main():
    parser = argparse.ArgumentParser(description="Initialize denomination pools")
    parser.add_argument("--keypair", default=str(Path.home() / ".config/solana/id.json"),
                        help="Path to authority keypair JSON")
    parser.add_argument("--rpc", default=RPC_URL, help="Solana RPC URL")
    parser.add_argument("--program-id", default=PROGRAM_ID, help="Program ID")
    args = parser.parse_args()

    # Load keypair
    with open(args.keypair) as f:
        keypair_bytes = bytes(json.load(f))
    authority = Keypair.from_bytes(keypair_bytes)
    program_id = Pubkey.from_string(args.program_id)

    print(f"Authority: {authority.pubkey()}")
    print(f"Program:   {args.program_id}")
    print(f"RPC:       {args.rpc}")
    print()

    client = AsyncClient(args.rpc)

    try:
        for denomination, label in DENOMINATIONS:
            pool_pda, bump = find_pool_pda(program_id, denomination)
            exists = await check_pool_exists(client, program_id, denomination)

            if exists:
                print(f"✓ {label} pool already exists: {pool_pda}")
                continue

            print(f"→ Initializing {label} pool (denomination={denomination})...")
            print(f"  PDA: {pool_pda}")

            ix = build_initialize_ix(program_id, authority.pubkey(), denomination)

            blockhash_resp = await client.get_latest_blockhash()
            blockhash = blockhash_resp.value.blockhash

            msg = Message.new_with_blockhash([ix], authority.pubkey(), blockhash)
            tx = Transaction.new_unsigned(msg)
            tx.sign([authority], blockhash)

            resp = await client.send_transaction(tx)
            sig = resp.value
            print(f"  Tx: {sig}")

            # Wait for confirmation
            await client.confirm_transaction(sig, commitment=Confirmed)
            print(f"  ✓ Confirmed!")
            print()

        print("All pools initialized.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
