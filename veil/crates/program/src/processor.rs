//! Instruction processors
//!
//! Contains the business logic for each instruction.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token;

use crate::instructions::NyxError;
use crate::merkle::TREE_DEPTH;
use crate::token as pool_token;
use crate::verification::{self, MvpProof};
use crate::{Initialize, Shield, ShieldSol, Transfer, Unshield, UnshieldSol};

/// Maximum leaves in tree (2^20)
const MAX_COMMITMENTS: u64 = 1 << TREE_DEPTH;

/// Process Initialize instruction
///
/// # Arguments
/// * `denomination` - Fixed deposit amount in lamports (0 = custom/variable pool)
pub fn process_initialize(ctx: Context<Initialize>, denomination: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Initialize with real Merkle tree and denomination
    pool.initialize(ctx.accounts.authority.key(), ctx.bumps.pool, denomination);

    msg!("Privacy pool initialized");
    msg!("Denomination: {} lamports (0 = custom)", denomination);
    msg!("Initial root: {:?}", pool.current_root());
    Ok(())
}

/// Process Shield SOL instruction
pub fn process_shield_sol(ctx: Context<ShieldSol>, commitment: [u8; 32], amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Validate amount
    require!(amount > 0, NyxError::InvalidAmount);
    require!(
        pool.commitment_count() < MAX_COMMITMENTS,
        NyxError::PoolFull
    );

    // Validate denomination (if fixed pool, amount must match exactly)
    require!(
        pool.validate_amount(amount),
        NyxError::InvalidDenomination
    );

    // Transfer SOL from depositor to vault
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;

    // Add commitment to tree
    let leaf_index = pool.add_commitment(commitment)?;

    // Record deposit for anonymity set tracking
    pool.record_deposit();

    msg!("Shielded {} lamports at index {}", amount, leaf_index);
    msg!("Pool denomination: {} (0=custom)", pool.denomination);
    msg!("Pool deposit count: {}", pool.deposit_count);
    msg!("New root: {:?}", pool.current_root());

    Ok(())
}

/// Process Shield SPL token instruction
pub fn process_shield(ctx: Context<Shield>, commitment: [u8; 32], amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Validate amount
    require!(amount > 0, NyxError::InvalidAmount);
    require!(
        pool.commitment_count() < MAX_COMMITMENTS,
        NyxError::PoolFull
    );

    // Validate denomination (if fixed pool, amount must match exactly)
    require!(
        pool.validate_amount(amount),
        NyxError::InvalidDenomination
    );

    // Transfer SPL tokens from depositor to vault
    let cpi_accounts = token::Transfer {
        from: ctx.accounts.depositor_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.depositor.to_account_info(),
    };
    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );
    token::transfer(cpi_context, amount)?;

    // Add commitment to tree
    let leaf_index = pool.add_commitment(commitment)?;

    // Record deposit for anonymity set tracking
    pool.record_deposit();

    msg!("Shielded {} tokens at index {}", amount, leaf_index);
    msg!("Pool denomination: {} (0=custom)", pool.denomination);
    msg!("Pool deposit count: {}", pool.deposit_count);
    msg!("New root: {:?}", pool.current_root());

    Ok(())
}

/// Process Transfer instruction
pub fn process_transfer(
    ctx: Context<Transfer>,
    nullifier: [u8; 32],
    new_commitment: [u8; 32],
    proof: Vec<u8>,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let nullifier_marker = &mut ctx.accounts.nullifier_marker;
    let clock = Clock::get()?;

    // Validate proof length (96 bytes for MVP: 64 signature + 32 pubkey)
    require!(proof.len() >= MvpProof::SIZE, NyxError::InvalidProof);

    // Note: Double-spend prevention is handled by Anchor's init constraint

    // Get current root for verification
    let root = pool.current_root();

    // Verify the proof
    let valid = verification::verify_transfer_proof(
        &proof,
        &nullifier,
        &new_commitment,
        &root,
    )?;
    require!(valid, NyxError::InvalidProof);

    // Initialize nullifier marker (marks nullifier as spent)
    nullifier_marker.pool = pool.key();
    nullifier_marker.nullifier = nullifier;
    nullifier_marker.spent_at = clock.slot;

    // Record in pool stats
    pool.record_nullifier_spent();

    // Add new commitment
    let leaf_index = pool.add_commitment(new_commitment)?;

    msg!("Private transfer complete");
    msg!("New commitment at index {}", leaf_index);
    msg!("Nullifier spent at slot {}", clock.slot);

    Ok(())
}

/// Process Unshield SOL instruction
pub fn process_unshield_sol(
    ctx: Context<UnshieldSol>,
    nullifier: [u8; 32],
    amount: u64,
    proof: Vec<u8>,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let nullifier_marker = &mut ctx.accounts.nullifier_marker;
    let clock = Clock::get()?;

    // Validate
    require!(amount > 0, NyxError::InvalidAmount);
    require!(proof.len() >= MvpProof::SIZE, NyxError::InvalidProof);

    // Note: Double-spend prevention is handled by Anchor's init constraint

    // Get current root for verification
    let root = pool.current_root();
    let recipient_key = ctx.accounts.recipient.key();

    // Verify the proof
    let valid = verification::verify_unshield_proof(
        &proof,
        &nullifier,
        &recipient_key,
        amount,
        &root,
    )?;
    require!(valid, NyxError::InvalidProof);

    // Initialize nullifier marker (marks nullifier as spent)
    nullifier_marker.pool = pool.key();
    nullifier_marker.nullifier = nullifier;
    nullifier_marker.spent_at = clock.slot;

    // Record in pool stats
    pool.record_nullifier_spent();

    // Transfer SOL from vault PDA to recipient using invoke_signed
    let vault_lamports = ctx.accounts.vault.lamports();
    require!(vault_lamports >= amount, pool_token::TokenError::InsufficientFunds);

    // Get vault bump for PDA signing
    let pool_key = pool.key();
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[&[u8]]] = &[&[
        pool_token::VAULT_SEED,
        pool_key.as_ref(),
        &[vault_bump],
    ]];

    // Transfer SOL from vault PDA (requires PDA signature)
    anchor_lang::solana_program::program::invoke_signed(
        &anchor_lang::solana_program::system_instruction::transfer(
            ctx.accounts.vault.key,
            ctx.accounts.recipient.key,
            amount,
        ),
        &[
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.recipient.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    msg!("Unshielded {} lamports", amount);
    msg!("Nullifier spent at slot {}", clock.slot);

    Ok(())
}

/// Process Unshield SPL token instruction
pub fn process_unshield(
    ctx: Context<Unshield>,
    nullifier: [u8; 32],
    amount: u64,
    proof: Vec<u8>,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let nullifier_marker = &mut ctx.accounts.nullifier_marker;
    let clock = Clock::get()?;

    // Validate
    require!(amount > 0, NyxError::InvalidAmount);
    require!(proof.len() >= MvpProof::SIZE, NyxError::InvalidProof);

    // Note: Double-spend prevention is handled by Anchor's init constraint

    // Get current root for verification
    let root = pool.current_root();
    // For SPL tokens, use the token account owner as recipient
    let recipient_key = ctx.accounts.recipient_token_account.owner;

    // Verify the proof
    let valid = verification::verify_unshield_proof(
        &proof,
        &nullifier,
        &recipient_key,
        amount,
        &root,
    )?;
    require!(valid, NyxError::InvalidProof);

    // Initialize nullifier marker (marks nullifier as spent)
    nullifier_marker.pool = pool.key();
    nullifier_marker.nullifier = nullifier;
    nullifier_marker.spent_at = clock.slot;

    // Record in pool stats
    pool.record_nullifier_spent();

    // Transfer SPL tokens from vault to recipient
    let pool_key = pool.key();
    let vault_bump = ctx.bumps.vault_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[
        pool_token::VAULT_SEED,
        pool_key.as_ref(),
        &[vault_bump],
    ]];

    let cpi_accounts = token::Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_context, amount)?;

    msg!("Unshielded {} tokens", amount);
    msg!("Nullifier spent at slot {}", clock.slot);

    Ok(())
}
