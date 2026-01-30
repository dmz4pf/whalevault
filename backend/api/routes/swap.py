"""
Swap API endpoints for WhaleVault Private Swap.

Enables users to unshield SOL and swap to any token in a single flow,
preserving privacy by routing through the relayer.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.instruction import Instruction, AccountMeta

# SPL Token program IDs
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")

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


def derive_ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
    """Derive the Associated Token Account address."""
    seeds = [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)]
    ata, _ = Pubkey.find_program_address(seeds, ASSOCIATED_TOKEN_PROGRAM_ID)
    return ata


def create_ata_instruction(payer: Pubkey, owner: Pubkey, mint: Pubkey) -> Instruction:
    """Create instruction to initialize an Associated Token Account."""
    ata = derive_ata(owner, mint)
    return Instruction(
        program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
        accounts=[
            AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
            AccountMeta(pubkey=ata, is_signer=False, is_writable=True),
            AccountMeta(pubkey=owner, is_signer=False, is_writable=False),
            AccountMeta(pubkey=mint, is_signer=False, is_writable=False),
            AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(pubkey=TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        ],
        data=bytes(),
    )


async def ensure_ata_exists(
    rpc_url: str,
    payer_keypair: Keypair,
    owner: str,
    mint: str,
) -> bool:
    """
    Ensure the recipient's ATA exists for the given mint.
    Creates it if it doesn't exist.

    Returns True if ATA was created, False if it already existed.
    """
    owner_pubkey = Pubkey.from_string(owner)
    mint_pubkey = Pubkey.from_string(mint)
    ata = derive_ata(owner_pubkey, mint_pubkey)

    async with AsyncClient(rpc_url) as client:
        # Check if ATA exists
        response = await client.get_account_info(ata)
        if response.value is not None:
            logger.info(f"ATA already exists: {ata}")
            return False

        # Create ATA
        logger.info(f"Creating ATA for owner={owner}, mint={mint}")
        ix = create_ata_instruction(payer_keypair.pubkey(), owner_pubkey, mint_pubkey)

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

    PRIVACY-PRESERVING: The relayer receives the unshielded SOL and signs the swap.
    The user's wallet NEVER appears in the transaction chain.
    Tokens are sent directly to the recipient's Associated Token Account.

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
        # Use the error's status code (503 for transient, 400 for invalid)
        logger.warning(f"Raydium quote failed: {e.message} (transient={e.is_transient})")
        status_code = 503 if e.is_transient else 502
        raise HTTPException(status_code=status_code, detail=f"Raydium quote unavailable: {e.message}")
    except Exception as e:
        logger.exception("Unexpected error fetching Raydium quote")
        raise HTTPException(status_code=502, detail=f"Raydium quote unavailable: {str(e)}")

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

    # Step 2.5: Ensure recipient's ATA exists for output token
    settings = get_settings()
    keypair = relayer._load_keypair()
    try:
        ata_created = await ensure_ata_exists(
            rpc_url=settings.solana_rpc_url,
            payer_keypair=keypair,
            owner=request.recipient,
            mint=request.output_mint,
        )
        if ata_created:
            logger.info(f"Created ATA for recipient {request.recipient}")
    except Exception as e:
        logger.warning(f"Failed to create ATA (may already exist): {e}")

    # Step 3: Build and submit Raydium swap (relayer signs, tokens go to recipient)
    try:
        # Use original quote - re-fetching risks network failures after unshield
        # which would leave SOL stuck in relayer wallet
        swap_tx_bytes = await raydium.get_swap_transaction(
            quote=quote,
            wallet_public_key=relayer.public_key,  # Relayer signs the swap
            recipient_public_key=request.recipient,  # Tokens go to recipient's ATA
        )

        # Sign with relayer keypair
        keypair = relayer._load_keypair()
        tx = VersionedTransaction.from_bytes(swap_tx_bytes)
        signed_tx = VersionedTransaction(tx.message, [keypair])

        # Submit to network via underlying AsyncClient
        solana_client = relayer._get_solana_client()
        response = await solana_client.client.send_raw_transaction(bytes(signed_tx))
        swap_signature = str(response.value)
        logger.info(f"Raydium swap submitted: {swap_signature}")

    except RaydiumAPIError as e:
        # Raydium API failed -- SOL is in relayer wallet
        # Log the specific error type for debugging
        logger.error(
            f"Raydium swap failed after unshield: {e.message} "
            f"(transient={e.is_transient}). SOL remains in relayer wallet."
        )
        return SwapExecuteResponse(
            unshieldSignature=unshield_result.signature,
            swapSignature="",
            outputAmount="0",
            outputMint=request.output_mint,
            recipient=request.recipient,
            fee=fee,
        )
    except Exception as e:
        # Other swap failures -- SOL is in relayer wallet
        logger.exception("Raydium swap transaction failed after successful unshield")
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
