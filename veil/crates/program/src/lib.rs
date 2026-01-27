//! Veil - Solana Privacy Program
//!
//! On-chain program for managing privacy pool state.
//! Supports both native SOL and SPL token deposits.

use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

// Valid Base58 program ID (placeholder - replace with actual deployed program ID)
// Using system program format: 32 bytes = 43-44 Base58 chars
declare_id!("3qhVPvz8T1WiozCLEfhUuv8WZHDPpEfnAzq2iSatULc7");

pub mod groth16;
pub mod instructions;
pub mod merkle;
pub mod nullifier;
pub mod processor;
pub mod state;
pub mod token;
pub mod verification;

#[program]
pub mod veil_program {
    use super::*;

    /// Initialize a privacy pool for a specific denomination
    ///
    /// # Arguments
    /// * `denomination` - Fixed deposit amount in lamports (0 = custom/variable pool)
    pub fn initialize(ctx: Context<Initialize>, denomination: u64) -> Result<()> {
        processor::process_initialize(ctx, denomination)
    }

    /// Shield native SOL - deposit SOL and create commitment
    pub fn shield_sol(ctx: Context<ShieldSol>, commitment: [u8; 32], amount: u64) -> Result<()> {
        processor::process_shield_sol(ctx, commitment, amount)
    }

    /// Shield SPL tokens - deposit tokens and create commitment
    pub fn shield(ctx: Context<Shield>, commitment: [u8; 32], amount: u64) -> Result<()> {
        processor::process_shield(ctx, commitment, amount)
    }

    /// Private transfer - spend commitment and create new one
    pub fn transfer(
        ctx: Context<Transfer>,
        nullifier: [u8; 32],
        new_commitment: [u8; 32],
        proof: Vec<u8>,
    ) -> Result<()> {
        processor::process_transfer(ctx, nullifier, new_commitment, proof)
    }

    /// Unshield native SOL - spend commitment and withdraw SOL
    pub fn unshield_sol(
        ctx: Context<UnshieldSol>,
        nullifier: [u8; 32],
        amount: u64,
        proof: Vec<u8>,
    ) -> Result<()> {
        processor::process_unshield_sol(ctx, nullifier, amount, proof)
    }

    /// Unshield SPL tokens - spend commitment and withdraw tokens
    pub fn unshield(
        ctx: Context<Unshield>,
        nullifier: [u8; 32],
        amount: u64,
        proof: Vec<u8>,
    ) -> Result<()> {
        processor::process_unshield(ctx, nullifier, amount, proof)
    }
}

// Re-export pool seed from token module
use token::POOL_SEED;

/// Initialize a new privacy pool with a specific denomination
#[derive(Accounts)]
#[instruction(denomination: u64)]
pub struct Initialize<'info> {
    /// The pool account, derived from denomination
    /// Each denomination (0, 0.1 SOL, 1 SOL, 10 SOL) gets its own pool
    #[account(
        init,
        payer = authority,
        space = 8 + state::PrivacyPool::SIZE,
        seeds = [POOL_SEED, &denomination.to_le_bytes()],
        bump
    )]
    pub pool: Account<'info, state::PrivacyPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Shield native SOL into a specific denomination pool
#[derive(Accounts)]
#[instruction(commitment: [u8; 32], amount: u64)]
pub struct ShieldSol<'info> {
    /// The pool for this denomination (denomination is stored in pool.denomination)
    #[account(
        mut,
        seeds = [POOL_SEED, &pool.denomination.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, state::PrivacyPool>,

    /// Pool's SOL vault PDA
    /// CHECK: Validated by seeds constraint
    #[account(
        mut,
        seeds = [token::VAULT_SEED, pool.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Shield SPL tokens into a specific denomination pool
#[derive(Accounts)]
#[instruction(commitment: [u8; 32], amount: u64)]
pub struct Shield<'info> {
    /// The pool for this denomination
    #[account(
        mut,
        seeds = [POOL_SEED, &pool.denomination.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, state::PrivacyPool>,

    /// Pool's vault authority PDA
    /// CHECK: Validated by seeds constraint
    #[account(
        seeds = [token::VAULT_SEED, pool.key().as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// Pool's token account for this mint
    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key()
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Depositor's token account
    #[account(
        mut,
        constraint = depositor_token_account.mint == vault_token_account.mint
    )]
    pub depositor_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Private transfer within a pool
#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct Transfer<'info> {
    /// The pool for this denomination
    #[account(
        mut,
        seeds = [POOL_SEED, &pool.denomination.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, state::PrivacyPool>,

    /// Nullifier marker PDA - created to mark nullifier as spent
    /// If this account already exists, the transaction fails (double-spend prevention)
    #[account(
        init,
        payer = relayer,
        space = 8 + nullifier::NullifierMarker::SIZE,
        seeds = [nullifier::NULLIFIER_SEED, pool.key().as_ref(), &nullifier],
        bump
    )]
    pub nullifier_marker: Account<'info, nullifier::NullifierMarker>,

    #[account(mut)]
    pub relayer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Unshield native SOL from a specific denomination pool
#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct UnshieldSol<'info> {
    /// The pool for this denomination
    #[account(
        mut,
        seeds = [POOL_SEED, &pool.denomination.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, state::PrivacyPool>,

    /// Nullifier marker PDA - created to mark nullifier as spent
    #[account(
        init,
        payer = relayer,
        space = 8 + nullifier::NullifierMarker::SIZE,
        seeds = [nullifier::NULLIFIER_SEED, pool.key().as_ref(), &nullifier],
        bump
    )]
    pub nullifier_marker: Account<'info, nullifier::NullifierMarker>,

    /// Pool's SOL vault PDA
    /// CHECK: Validated by seeds constraint
    #[account(
        mut,
        seeds = [token::VAULT_SEED, pool.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    /// Recipient receiving the SOL
    /// CHECK: Any account can receive SOL
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    #[account(mut)]
    pub relayer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Unshield SPL tokens from a specific denomination pool
#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct Unshield<'info> {
    /// The pool for this denomination
    #[account(
        mut,
        seeds = [POOL_SEED, &pool.denomination.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, state::PrivacyPool>,

    /// Nullifier marker PDA - created to mark nullifier as spent
    #[account(
        init,
        payer = relayer,
        space = 8 + nullifier::NullifierMarker::SIZE,
        seeds = [nullifier::NULLIFIER_SEED, pool.key().as_ref(), &nullifier],
        bump
    )]
    pub nullifier_marker: Account<'info, nullifier::NullifierMarker>,

    /// Pool's vault authority PDA
    /// CHECK: Validated by seeds constraint
    #[account(
        seeds = [token::VAULT_SEED, pool.key().as_ref()],
        bump
    )]
    pub vault_authority: AccountInfo<'info>,

    /// Pool's token account
    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key()
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Recipient's token account
    #[account(
        mut,
        constraint = recipient_token_account.mint == vault_token_account.mint
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub relayer: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}
