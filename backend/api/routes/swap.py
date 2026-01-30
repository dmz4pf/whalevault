"""
Swap API endpoints for WhaleVault Private Swap.

Enables users to unshield SOL and swap to any token in a single flow,
preserving privacy by routing through the relayer.

Two-Transaction Flow (Raydium limitation):
1. Swap TX: SOL -> Token (tokens land in relayer's ATA)
2. Transfer TX: relayer's ATA -> recipient's ATA

Raydium requires outputAccount to be owned by the signer, preventing
direct routing to recipient in a single transaction.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.instruction import Instruction, AccountMeta
from solders.system_program import transfer as sol_transfer, TransferParams
from solders.signature import Signature

# SPL Token program IDs
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
TOKEN_2022_PROGRAM_ID = Pubkey.from_string("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")

# Transfer retry configuration
MAX_TRANSFER_RETRIES = 3
TRANSFER_RETRY_DELAY_SECONDS = 1.0

# Devnet auto-airdrop configuration
MIN_RELAYER_BALANCE_LAMPORTS = 2_000_000_000  # 2 SOL minimum
AIRDROP_AMOUNT_LAMPORTS = 2_000_000_000  # 2 SOL per airdrop

from api.deps import get_job_queue, get_relayer_service
from config import get_settings
from models.requests import SwapExecuteRequest
from models.responses import SwapExecuteResponse, SwapQuoteResponse, SwapTokenInfo
from proof_queue.job_queue import JobStatus, ProofJobQueue
from services.jupiter_service import JupiterService, get_jupiter_service
from services.raydium_service import RaydiumAPIError, RaydiumService, get_raydium_service
from services.relayer_service import RelayerService
from utils.errors import RelayerError

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_token_program_for_mint(client: AsyncClient, mint: Pubkey) -> Pubkey:
    """Detect whether a mint uses standard SPL Token or Token-2022."""
    try:
        info = await client.get_account_info(mint)
        if info.value and info.value.owner:
            owner = info.value.owner
            if owner == TOKEN_2022_PROGRAM_ID:
                return TOKEN_2022_PROGRAM_ID
    except Exception as e:
        logger.warning(f"Failed to detect token program for {mint}: {e}")
    return TOKEN_PROGRAM_ID  # Default to standard SPL


def derive_ata(owner: Pubkey, mint: Pubkey, token_program: Pubkey = TOKEN_PROGRAM_ID) -> Pubkey:
    """Derive the Associated Token Account address."""
    seeds = [bytes(owner), bytes(token_program), bytes(mint)]
    ata, _ = Pubkey.find_program_address(seeds, ASSOCIATED_TOKEN_PROGRAM_ID)
    return ata


def create_ata_instruction(
    payer: Pubkey, owner: Pubkey, mint: Pubkey, token_program: Pubkey = TOKEN_PROGRAM_ID
) -> Instruction:
    """Create instruction to initialize an Associated Token Account."""
    ata = derive_ata(owner, mint, token_program)
    return Instruction(
        program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
        accounts=[
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=ata, is_signer=False, is_writable=True),
            AccountMeta(pubkey=owner, is_signer=False, is_writable=False),
            AccountMeta(pubkey=mint, is_signer=False, is_writable=False),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(pubkey=token_program, is_signer=False, is_writable=False),
        ],
        data=bytes(),
    )


async def ensure_ata_exists(
    rpc_url: str,
    payer_keypair: Keypair,
    owner: str,
    mint: str,
    token_program: Pubkey | None = None,
) -> bool:
    """
    Ensure the recipient's ATA exists for the given mint.
    Creates it if it doesn't exist.

    Args:
        rpc_url: Solana RPC URL
        payer_keypair: Keypair to pay for ATA creation
        owner: Owner wallet address
        mint: Token mint address
        token_program: Token program ID (auto-detected if None)

    Returns True if ATA was created, False if it already existed.
    """
    owner_pubkey = Pubkey.from_string(owner)
    mint_pubkey = Pubkey.from_string(mint)

    async with AsyncClient(rpc_url) as client:
        # Auto-detect token program if not provided
        if token_program is None:
            token_program = await get_token_program_for_mint(client, mint_pubkey)
            logger.info(f"Detected token program for {mint}: {token_program}")

        ata = derive_ata(owner_pubkey, mint_pubkey, token_program)

        # Check if ATA exists
        response = await client.get_account_info(ata)
        if response.value is not None:
            logger.info(f"ATA already exists: {ata}")
            return False

        # Create ATA
        logger.info(f"Creating ATA for owner={owner}, mint={mint}, program={token_program}")
        ix = create_ata_instruction(payer_keypair.pubkey(), owner_pubkey, mint_pubkey, token_program)

        # Get recent blockhash
        blockhash_resp = await client.get_latest_blockhash()
        recent_blockhash = blockhash_resp.value.blockhash

        # Build and sign transaction
        msg = MessageV0.try_compile(
            payer=payer_keypair.pubkey(),
            instructions=[ix],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash,
        )
        tx = VersionedTransaction(msg, [payer_keypair])

        # Send transaction
        result = await client.send_transaction(tx)
        logger.info(f"ATA created, signature: {result.value}")

        # Wait for confirmation
        await client.confirm_transaction(result.value, commitment="confirmed")
        return True


def create_spl_transfer_instruction(
    source: Pubkey,
    dest: Pubkey,
    owner: Pubkey,
    amount: int,
    token_program: Pubkey = TOKEN_PROGRAM_ID,
    mint: Pubkey | None = None,
    decimals: int = 9,
) -> Instruction:
    """
    Create an SPL Token Transfer instruction.

    For standard SPL Token: uses Transfer (opcode 3)
    For Token-2022: uses TransferChecked (opcode 12) which requires mint and decimals

    Args:
        source: Source token account
        dest: Destination token account
        owner: Owner/authority of source account
        amount: Amount in smallest units
        token_program: Token program ID
        mint: Token mint (required for Token-2022)
        decimals: Token decimals (required for Token-2022)
    """
    is_token_2022 = token_program == TOKEN_2022_PROGRAM_ID

    if is_token_2022 and mint is not None:
        # Token-2022 requires TransferChecked (opcode 12)
        # Data: 1 byte opcode + 8 bytes amount (u64 LE) + 1 byte decimals
        data = bytes([12]) + amount.to_bytes(8, byteorder='little') + bytes([decimals])

        return Instruction(
            program_id=token_program,
            accounts=[
                AccountMeta(pubkey=source, is_signer=False, is_writable=True),
                AccountMeta(pubkey=mint, is_signer=False, is_writable=False),
                AccountMeta(pubkey=dest, is_signer=False, is_writable=True),
                AccountMeta(pubkey=owner, is_signer=True, is_writable=False),
            ],
            data=data,
        )
    else:
        # Standard SPL Token Transfer (opcode 3)
        # Data: 1 byte opcode + 8 bytes amount (u64 LE)
        data = bytes([3]) + amount.to_bytes(8, byteorder='little')

        return Instruction(
            program_id=token_program,
            accounts=[
                AccountMeta(pubkey=source, is_signer=False, is_writable=True),
                AccountMeta(pubkey=dest, is_signer=False, is_writable=True),
                AccountMeta(pubkey=owner, is_signer=True, is_writable=False),
            ],
            data=data,
        )


async def transfer_tokens_to_recipient(
    client: AsyncClient,
    relayer_keypair: Keypair,
    source_ata: Pubkey,
    dest_ata: Pubkey,
    amount: int,
    token_program: Pubkey = TOKEN_PROGRAM_ID,
    mint: Pubkey | None = None,
    decimals: int = 9,
) -> str:
    """
    Transfer SPL tokens from relayer's ATA to recipient's ATA.

    Args:
        client: Solana RPC client
        relayer_keypair: Keypair of the relayer (token owner)
        source_ata: Relayer's Associated Token Account
        dest_ata: Recipient's Associated Token Account
        amount: Amount in token's smallest unit
        token_program: Token program ID (SPL Token or Token-2022)
        mint: Token mint (required for Token-2022 transfer_checked)
        decimals: Token decimals (required for Token-2022 transfer_checked)

    Returns:
        Transaction signature
    """
    transfer_ix = create_spl_transfer_instruction(
        source=source_ata,
        dest=dest_ata,
        owner=relayer_keypair.pubkey(),
        amount=amount,
        token_program=token_program,
        mint=mint,
        decimals=decimals,
    )

    blockhash_resp = await client.get_latest_blockhash()
    blockhash = blockhash_resp.value.blockhash

    msg = MessageV0.try_compile(
        payer=relayer_keypair.pubkey(),
        instructions=[transfer_ix],
        address_lookup_table_accounts=[],
        recent_blockhash=blockhash,
    )
    tx = VersionedTransaction(msg, [relayer_keypair])
    resp = await client.send_raw_transaction(bytes(tx))
    return str(resp.value)


async def ensure_relayer_funded(client: AsyncClient, relayer_pubkey: Pubkey) -> None:
    """
    Check relayer balance and request airdrop if below minimum (devnet only).
    Silently fails if airdrop rate-limited - not critical for operation.
    """
    settings = get_settings()
    if "devnet" not in settings.solana_rpc_url:
        return  # Only auto-airdrop on devnet

    try:
        balance_resp = await client.get_balance(relayer_pubkey)
        balance = balance_resp.value

        if balance < MIN_RELAYER_BALANCE_LAMPORTS:
            logger.info(f"Relayer balance low ({balance / 1e9:.2f} SOL), requesting airdrop...")
            try:
                await client.request_airdrop(relayer_pubkey, AIRDROP_AMOUNT_LAMPORTS)
                logger.info(f"Airdrop requested: {AIRDROP_AMOUNT_LAMPORTS / 1e9} SOL")
                await asyncio.sleep(2)  # Wait for airdrop to confirm
            except Exception as e:
                logger.warning(f"Airdrop failed (may be rate-limited): {e}")
    except Exception as e:
        logger.warning(f"Balance check failed: {e}")


async def send_sol_to_recipient(
    client: AsyncClient,
    relayer_keypair: Keypair,
    recipient: Pubkey,
    lamports: int,
) -> str:
    """
    Send SOL from relayer to recipient (fallback when swap fails).

    Args:
        client: Solana RPC client
        relayer_keypair: Keypair of the relayer
        recipient: Recipient's public key
        lamports: Amount in lamports

    Returns:
        Transaction signature
    """
    transfer_ix = sol_transfer(TransferParams(
        from_pubkey=relayer_keypair.pubkey(),
        to_pubkey=recipient,
        lamports=lamports,
    ))

    blockhash_resp = await client.get_latest_blockhash()
    blockhash = blockhash_resp.value.blockhash

    msg = MessageV0.try_compile(
        payer=relayer_keypair.pubkey(),
        instructions=[transfer_ix],
        address_lookup_table_accounts=[],
        recent_blockhash=blockhash,
    )
    tx = VersionedTransaction(msg, [relayer_keypair])
    resp = await client.send_raw_transaction(bytes(tx))
    return str(resp.value)


@router.get("/quote", response_model=SwapQuoteResponse)
async def get_swap_quote(
    inputMint: str,
    outputMint: str,
    amount: int,
    slippageBps: int = 100,
    jupiter: JupiterService = Depends(get_jupiter_service),
) -> SwapQuoteResponse:
    """
    Get a swap quote from Jupiter.

    Returns pricing info for swapping inputMint -> outputMint.
    """
    try:
        quote = await jupiter.get_quote(
            input_mint=inputMint,
            output_mint=outputMint,
            amount_lamports=amount,
            slippage_bps=slippageBps,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Jupiter quote failed: {e}")

    return SwapQuoteResponse(
        inputMint=quote.input_mint,
        outputMint=quote.output_mint,
        inAmount=quote.in_amount,
        outAmount=quote.out_amount,
        priceImpactPct=quote.price_impact_pct,
        slippageBps=quote.slippage_bps,
        minimumReceived=quote.other_amount_threshold,
    )


@router.post("/execute", response_model=SwapExecuteResponse)
async def execute_swap(
    request: SwapExecuteRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
    relayer: RelayerService = Depends(get_relayer_service),
    jupiter: JupiterService = Depends(get_jupiter_service),
) -> SwapExecuteResponse:
    """
    Execute a private swap: unshield SOL via relayer, then swap to target token.

    Prerequisites:
    1. Proof generation must be complete (call /unshield/proof first)
    2. Relayer must be enabled and funded
    """
    if not relayer.enabled:
        raise HTTPException(status_code=503, detail="Relayer service is currently disabled")

    # Validate proof job
    job = await job_queue.get_status(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Proof job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Proof job not complete (status: {job.status.value})",
        )

    if not job.result:
        raise HTTPException(status_code=500, detail="Proof result missing")

    if not isinstance(job.result, dict):
        raise HTTPException(status_code=500, detail="Invalid proof result")

    proof_hex = job.result.get("proof")
    nullifier_hex = job.result.get("nullifier")

    if not isinstance(proof_hex, str) or not isinstance(nullifier_hex, str):
        raise HTTPException(status_code=500, detail="Proof or nullifier has invalid type")

    if not proof_hex or not nullifier_hex:
        raise HTTPException(status_code=500, detail="Proof or nullifier missing from job result")

    # Step 1: Get Jupiter quote FIRST to fail fast before unshielding
    sol_mint = "So11111111111111111111111111111111111111112"
    try:
        quote = await jupiter.get_quote(
            input_mint=sol_mint,
            output_mint=request.output_mint,
            amount_lamports=job.amount,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Swap quote unavailable: {str(e)}")

    # Step 2: Unshield SOL via relayer (knowing quote is valid)
    try:
        unshield_result = await relayer.relay_unshield(
            nullifier=bytes.fromhex(nullifier_hex),
            recipient=relayer.public_key,  # SOL goes to relayer for swapping
            amount=job.amount,
            proof=bytes.fromhex(proof_hex),
            denomination=job.denomination,
        )
    except RelayerError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unshield failed: {e}")

    fee = unshield_result.fee_paid

    # Step 3: Try swap, return partial success on failure
    try:
        swap_tx_bytes = await jupiter.get_swap_transaction(
            quote=quote,
            user_public_key=relayer.public_key,
        )

        keypair = relayer._load_keypair()
        tx = VersionedTransaction.from_bytes(swap_tx_bytes)
        signed_tx = VersionedTransaction(tx.message, [keypair])

        solana_client = relayer._get_solana_client()
        response = await solana_client.client.send_raw_transaction(bytes(signed_tx))
        swap_signature = str(response.value)
    except Exception as e:
        # Swap failed -- SOL is in relayer wallet. Return partial success with unshield sig.
        logger.exception("Swap transaction failed after successful unshield")
        return SwapExecuteResponse(
            unshieldSignature=unshield_result.signature,
            swapSignature="",
            outputAmount="0",
            outputMint=request.output_mint,
            recipient=request.recipient,
            fee=fee,
        )

    return SwapExecuteResponse(
        unshieldSignature=unshield_result.signature,
        swapSignature=swap_signature,
        outputAmount=quote.out_amount,
        outputMint=request.output_mint,
        recipient=request.recipient,
        fee=fee,
    )


@router.post("/execute-devnet", response_model=SwapExecuteResponse)
async def execute_swap_devnet(
    request: SwapExecuteRequest,
    job_queue: ProofJobQueue = Depends(get_job_queue),
    relayer: RelayerService = Depends(get_relayer_service),
    raydium: RaydiumService = Depends(get_raydium_service),
) -> SwapExecuteResponse:
    """
    Execute a private swap on devnet: unshield SOL via relayer, then swap via Raydium.

    Two-Transaction Flow (Raydium limitation):
    1. Swap TX: SOL -> Token (tokens land in relayer's ATA)
    2. Transfer TX: relayer's ATA -> recipient's ATA

    PRIVACY-PRESERVING: The relayer receives the unshielded SOL and handles all
    subsequent transactions. The user's wallet NEVER appears in the chain.

    Prerequisites:
    1. Proof generation must be complete (call /unshield/proof first)
    2. Relayer must be enabled and funded
    """
    if not relayer.enabled:
        raise HTTPException(status_code=503, detail="Relayer service is currently disabled")

    # Validate proof job
    job = await job_queue.get_status(request.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Proof job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Proof job not complete (status: {job.status.value})",
        )

    if not job.result:
        raise HTTPException(status_code=500, detail="Proof result missing")

    if not isinstance(job.result, dict):
        raise HTTPException(status_code=500, detail="Invalid proof result")

    proof_hex = job.result.get("proof")
    nullifier_hex = job.result.get("nullifier")

    if not isinstance(proof_hex, str) or not isinstance(nullifier_hex, str):
        raise HTTPException(status_code=500, detail="Proof or nullifier has invalid type")

    if not proof_hex or not nullifier_hex:
        raise HTTPException(status_code=500, detail="Proof or nullifier missing from job result")

    # Step 0: Ensure relayer has enough SOL (auto-airdrop on devnet)
    solana_client_temp = relayer._get_solana_client()
    await ensure_relayer_funded(solana_client_temp.client, Pubkey.from_string(relayer.public_key))

    # Step 1: Get Raydium quote FIRST to fail fast before unshielding
    sol_mint = "So11111111111111111111111111111111111111112"
    try:
        quote = await raydium.get_quote(
            input_mint=sol_mint,
            output_mint=request.output_mint,
            amount_lamports=job.amount,
        )
        logger.info(f"Raydium quote: {quote.in_amount} SOL -> {quote.out_amount} tokens")
    except RaydiumAPIError as e:
        logger.warning(f"Raydium quote failed: {e.message} (transient={e.is_transient})")
        status_code = 503 if e.is_transient else 502
        raise HTTPException(status_code=status_code, detail=f"Raydium quote unavailable: {e.message}")
    except Exception as e:
        logger.exception("Unexpected error fetching Raydium quote")
        raise HTTPException(status_code=502, detail=f"Raydium quote unavailable: {str(e)}")

    # Step 1.5: Detect token program and decimals for output mint
    output_mint_pubkey = Pubkey.from_string(request.output_mint)
    token_program = await get_token_program_for_mint(solana_client_temp.client, output_mint_pubkey)
    is_token_2022 = token_program == TOKEN_2022_PROGRAM_ID
    logger.info(f"Output token program: {'Token-2022' if is_token_2022 else 'SPL Token'}")

    # Get token decimals (needed for Token-2022 transfer_checked)
    token_decimals = 9  # Default
    try:
        from solana.rpc.types import TokenAccountOpts
        # Get mint info to determine decimals
        mint_info = await solana_client_temp.client.get_account_info(output_mint_pubkey)
        if mint_info.value and mint_info.value.data:
            # Mint data layout: first 36 bytes are authority, then 1 byte decimals at offset 44
            # Actually SPL Token mint layout: 4 (mint_authority_option) + 32 (mint_authority) + 8 (supply) + 1 (decimals)
            # = decimals at byte 44
            mint_data = mint_info.value.data
            if len(mint_data) > 44:
                token_decimals = mint_data[44]
                logger.info(f"Token decimals: {token_decimals}")
    except Exception as e:
        logger.warning(f"Failed to get token decimals, using default 9: {e}")

    # Step 2: Unshield SOL to RELAYER's wallet (not user's!) for privacy
    try:
        unshield_result = await relayer.relay_unshield(
            nullifier=bytes.fromhex(nullifier_hex),
            recipient=relayer.public_key,  # SOL goes to RELAYER for swapping
            amount=job.amount,
            proof=bytes.fromhex(proof_hex),
            denomination=job.denomination,
        )
        logger.info(f"Unshield to relayer complete: {unshield_result.signature}")
    except RelayerError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unshield failed: {e}")

    fee = unshield_result.fee_paid
    settings = get_settings()
    keypair = relayer._load_keypair()
    solana_client = relayer._get_solana_client()

    # Step 2.5: Ensure recipient's ATA exists for output token
    try:
        ata_created = await ensure_ata_exists(
            rpc_url=settings.solana_rpc_url,
            payer_keypair=keypair,
            owner=request.recipient,
            mint=request.output_mint,
            token_program=token_program,
        )
        if ata_created:
            logger.info(f"Created ATA for recipient {request.recipient}")
    except Exception as e:
        logger.warning(f"Failed to create ATA (may already exist): {e}")

    # Step 3: Build and submit Raydium swap (tokens go to RELAYER's ATA)
    swap_signature = ""
    logger.info(f"Quote: in={quote.in_amount}, out={quote.out_amount}, slippage={quote.slippage_bps}bps")
    try:
        swap_tx_bytes = await raydium.get_swap_transaction(
            quote=quote,
            wallet_public_key=relayer.public_key,
        )
        logger.info(f"Got swap tx bytes: {len(swap_tx_bytes)} bytes")

        tx = VersionedTransaction.from_bytes(swap_tx_bytes)
        signed_tx = VersionedTransaction(tx.message, [keypair])

        response = await solana_client.client.send_raw_transaction(bytes(signed_tx))
        swap_signature = str(response.value)
        logger.info(f"Raydium swap submitted: {swap_signature}")

        # Wait for swap confirmation before transfer
        await solana_client.client.confirm_transaction(
            Signature.from_string(swap_signature),
            commitment="confirmed",
        )
        logger.info(f"Swap confirmed: {swap_signature}")

    except RaydiumAPIError as e:
        logger.error(
            f"Raydium swap failed after unshield: {e.message} "
            f"(transient={e.is_transient}). Attempting SOL fallback."
        )
        return await _handle_swap_failure_with_sol_fallback(
            solana_client.client,
            keypair,
            request,
            unshield_result,
            fee,
            job.amount,
        )
    except Exception as e:
        logger.exception("Raydium swap transaction failed after successful unshield")
        return await _handle_swap_failure_with_sol_fallback(
            solana_client.client,
            keypair,
            request,
            unshield_result,
            fee,
            job.amount,
        )

    # Step 3.5: Verify tokens arrived in relayer's ATA (fixes race condition)
    relayer_pubkey = Pubkey.from_string(relayer.public_key)
    recipient_pubkey = Pubkey.from_string(request.recipient)
    # output_mint_pubkey already defined above in step 1.5

    relayer_ata = derive_ata(relayer_pubkey, output_mint_pubkey, token_program)
    recipient_ata = derive_ata(recipient_pubkey, output_mint_pubkey, token_program)

    # Bug fix #1 & #2: Get ACTUAL token balance instead of quote estimate
    actual_token_amount = 0
    max_balance_checks = 5
    for i in range(max_balance_checks):
        try:
            balance_resp = await solana_client.client.get_token_account_balance(relayer_ata)
            if balance_resp and balance_resp.value:
                actual_token_amount = int(balance_resp.value.amount)
                if actual_token_amount > 0:
                    logger.info(f"Tokens received in relayer ATA: {actual_token_amount} (quote was {quote.out_amount})")
                    break
        except Exception as e:
            logger.warning(f"Balance check {i + 1} failed: {e}")

        if i < max_balance_checks - 1:
            await asyncio.sleep(0.5)

    if actual_token_amount == 0:
        logger.error("Swap confirmed but no tokens visible in relayer ATA. Attempting SOL fallback.")
        return await _handle_swap_failure_with_sol_fallback(
            solana_client.client,
            keypair,
            request,
            unshield_result,
            fee,
            job.amount,
        )

    # Bug fix #3: Verify recipient ATA exists before transfer
    try:
        recipient_ata_info = await solana_client.client.get_account_info(recipient_ata)
        if recipient_ata_info.value is None:
            logger.warning(f"Recipient ATA doesn't exist, creating: {recipient_ata}")
            await ensure_ata_exists(
                rpc_url=settings.solana_rpc_url,
                payer_keypair=keypair,
                owner=request.recipient,
                mint=request.output_mint,
                token_program=token_program,
            )
    except Exception as e:
        logger.warning(f"ATA check/creation failed: {e}")

    # Step 4: Transfer tokens from relayer's ATA to recipient's ATA (with retry)
    transfer_signature = None
    token_amount = actual_token_amount  # Use actual balance, not quote estimate

    for attempt in range(MAX_TRANSFER_RETRIES):
        try:
            transfer_signature = await transfer_tokens_to_recipient(
                client=solana_client.client,
                relayer_keypair=keypair,
                source_ata=relayer_ata,
                dest_ata=recipient_ata,
                amount=token_amount,
                token_program=token_program,
                mint=output_mint_pubkey,  # Required for Token-2022 transfer_checked
                decimals=token_decimals,  # Required for Token-2022 transfer_checked
            )
            logger.info(f"Token transfer succeeded on attempt {attempt + 1}: {transfer_signature}")
            break
        except Exception as e:
            logger.warning(f"Transfer attempt {attempt + 1}/{MAX_TRANSFER_RETRIES} failed: {e}")
            if attempt < MAX_TRANSFER_RETRIES - 1:
                await asyncio.sleep(TRANSFER_RETRY_DELAY_SECONDS)

    if transfer_signature is None:
        logger.error(
            f"CRITICAL: Transfer failed after {MAX_TRANSFER_RETRIES} attempts. "
            f"Tokens in relayer ATA. Swap sig: {swap_signature}, "
            f"Recipient: {request.recipient}, Amount: {token_amount}, "
            f"Mint: {request.output_mint}"
        )
        # Swap succeeded but transfer failed - partial success
        return SwapExecuteResponse(
            unshieldSignature=unshield_result.signature,
            swapSignature=swap_signature,
            transferSignature="",
            outputAmount=str(token_amount),
            outputMint=request.output_mint,
            recipient=request.recipient,
            fee=fee,
        )

    return SwapExecuteResponse(
        unshieldSignature=unshield_result.signature,
        swapSignature=swap_signature,
        transferSignature=transfer_signature,
        outputAmount=str(token_amount),
        outputMint=request.output_mint,
        recipient=request.recipient,
        fee=fee,
    )


async def _handle_swap_failure_with_sol_fallback(
    client: AsyncClient,
    relayer_keypair: Keypair,
    request: SwapExecuteRequest,
    unshield_result,
    fee: int,
    original_amount: int,
) -> SwapExecuteResponse:
    """
    Handle swap failure by sending SOL directly to recipient as fallback.

    When the swap fails, the unshielded SOL is stuck in the relayer wallet.
    Rather than leaving it there, we send it to the recipient minus the fee.
    """
    logger.info(f"SOL fallback called for recipient: {request.recipient}, original_amount: {original_amount}, fee: {fee}")
    recipient_pubkey = Pubkey.from_string(request.recipient)

    # Bug fix #4: Account for gas fees consumed by failed swap attempt
    # Query actual relayer balance instead of assuming original_amount - fee
    MIN_SOL_RESERVE = 5000  # Reserve for transfer tx fee
    try:
        balance_resp = await client.get_balance(relayer_keypair.pubkey())
        available_sol = balance_resp.value - MIN_SOL_RESERVE
        intended_amount = original_amount - fee

        # Use the lesser of intended amount or available balance
        sol_amount = min(intended_amount, available_sol)

        if sol_amount <= 0:
            logger.critical(
                f"Insufficient SOL for fallback. Available: {available_sol}, "
                f"Intended: {intended_amount}, Reserve: {MIN_SOL_RESERVE}"
            )
            return SwapExecuteResponse(
                unshieldSignature=unshield_result.signature,
                swapSignature="",
                transferSignature="",
                outputAmount="0",
                outputMint=request.output_mint,
                recipient=request.recipient,
                fee=fee,
            )

        logger.info(f"SOL fallback: intended={intended_amount}, available={available_sol}, sending={sol_amount}")
    except Exception as e:
        logger.error(f"Failed to check relayer balance: {e}")
        sol_amount = original_amount - fee  # Fallback to original calculation

    try:
        fallback_sig = await send_sol_to_recipient(
            client=client,
            relayer_keypair=relayer_keypair,
            recipient=recipient_pubkey,
            lamports=sol_amount,
        )
        logger.info(f"Fallback: Sent {sol_amount} lamports to recipient: {fallback_sig}")

        return SwapExecuteResponse(
            unshieldSignature=unshield_result.signature,
            swapSignature="",
            transferSignature=fallback_sig,
            outputAmount=str(sol_amount),
            outputMint="So11111111111111111111111111111111111111112",  # SOL mint
            recipient=request.recipient,
            fee=fee,
        )
    except Exception as fallback_error:
        logger.critical(
            f"CRITICAL: Swap AND fallback failed. SOL stuck in relayer. "
            f"Recipient: {request.recipient}, Amount: {original_amount}, "
            f"Error: {fallback_error}"
        )
        return SwapExecuteResponse(
            unshieldSignature=unshield_result.signature,
            swapSignature="",
            transferSignature="",
            outputAmount="0",
            outputMint=request.output_mint,
            recipient=request.recipient,
            fee=fee,
        )


@router.get("/tokens-devnet", response_model=list[SwapTokenInfo])
async def get_swap_tokens_devnet(
    raydium: RaydiumService = Depends(get_raydium_service),
) -> list[SwapTokenInfo]:
    """Get list of tokens available for swapping via Raydium on devnet."""
    try:
        tokens = await raydium.get_token_list()
    except RaydiumAPIError as e:
        # Use 503 for transient errors (retryable), 502 for permanent
        status_code = 503 if e.is_transient else 502
        raise HTTPException(status_code=status_code, detail=f"Failed to fetch devnet token list: {e.message}")
    except Exception as e:
        logger.exception("Unexpected error fetching token list")
        raise HTTPException(status_code=502, detail=f"Failed to fetch devnet token list: {e}")

    return [
        SwapTokenInfo(
            address=t.address,
            symbol=t.symbol,
            name=t.name,
            decimals=t.decimals,
            logoUri=t.logo_uri,
        )
        for t in tokens
    ]


@router.get("/tokens", response_model=list[SwapTokenInfo])
async def get_swap_tokens(
    jupiter: JupiterService = Depends(get_jupiter_service),
) -> list[SwapTokenInfo]:
    """Get list of tokens available for swapping via Jupiter."""
    try:
        tokens = await jupiter.get_token_list()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch token list: {e}")

    return [
        SwapTokenInfo(
            address=t.address,
            symbol=t.symbol,
            name=t.name,
            decimals=t.decimals,
            logoUri=t.logo_uri,
        )
        for t in tokens
    ]
