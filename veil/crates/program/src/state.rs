//! Program state
//!
//! Defines the on-chain data structures for the privacy pool.

use anchor_lang::prelude::*;

use crate::instructions::NyxError;
use crate::merkle::IncrementalMerkleTree;

/// Number of recent roots to keep for validity window
/// Reduced from 30 to 10 to save account space
pub const ROOT_HISTORY_SIZE: usize = 10;

/// Default relayer fee in basis points (0.3%)
pub const DEFAULT_RELAYER_FEE_BPS: u16 = 30;

/// Maximum relayer fee in basis points (5%)
pub const MAX_RELAYER_FEE_BPS: u16 = 500;

/// Minimum withdrawal amount (to cover fees)
pub const MIN_WITHDRAWAL_AMOUNT: u64 = 10_000; // 0.00001 SOL

/// Privacy pool state
#[account]
pub struct PrivacyPool {
    /// Pool authority
    pub authority: Pubkey,

    /// Incremental Merkle tree for commitments
    /// - next_index: u64 (8 bytes)
    /// - filled_subtrees: [[u8; 32]; 20] (640 bytes)
    /// - current_root: [u8; 32] (32 bytes)
    pub merkle_tree: IncrementalMerkleTree,

    /// Recent Merkle roots (for validity window)
    /// Allows proofs against slightly older roots during concurrent transactions
    pub root_history: [[u8; 32]; ROOT_HISTORY_SIZE],

    /// Index of the oldest root in history (circular buffer)
    pub root_history_index: u8,

    /// Number of spent nullifiers (for stats)
    pub nullifier_count: u64,

    /// Relayer fee in basis points (e.g., 30 = 0.3%)
    pub relayer_fee_bps: u16,

    /// Total fees collected (for stats)
    pub total_fees_collected: u64,

    /// Bump seed for PDA
    pub bump: u8,

    /// Fixed denomination for this pool (in lamports)
    /// 0 = custom amounts allowed (variable pool)
    /// Non-zero = only this exact amount can be shielded
    pub denomination: u64,

    /// Number of deposits in this pool (anonymity set size)
    pub deposit_count: u64,
}

impl PrivacyPool {
    /// Account size calculation
    pub const SIZE: usize = 32  // authority
        + IncrementalMerkleTree::SIZE  // merkle_tree (680 bytes)
        + (32 * ROOT_HISTORY_SIZE)  // root_history (320 bytes for 10 roots)
        + 1   // root_history_index
        + 8   // nullifier_count
        + 2   // relayer_fee_bps
        + 8   // total_fees_collected
        + 1   // bump
        + 8   // denomination
        + 8;  // deposit_count

    /// Initialize a new privacy pool
    ///
    /// # Arguments
    /// * `authority` - Pool authority pubkey
    /// * `bump` - PDA bump seed
    /// * `denomination` - Fixed deposit amount in lamports (0 = custom/variable)
    pub fn initialize(&mut self, authority: Pubkey, bump: u8, denomination: u64) {
        self.authority = authority;
        self.merkle_tree = IncrementalMerkleTree::new();
        self.root_history = [[0u8; 32]; ROOT_HISTORY_SIZE];
        self.root_history_index = 0;
        self.nullifier_count = 0;
        self.relayer_fee_bps = DEFAULT_RELAYER_FEE_BPS;
        self.total_fees_collected = 0;
        self.bump = bump;
        self.denomination = denomination;
        self.deposit_count = 0;
    }

    /// Check if this is a fixed denomination pool
    pub fn is_fixed_denomination(&self) -> bool {
        self.denomination > 0
    }

    /// Check if amount matches pool denomination (for fixed pools)
    pub fn validate_amount(&self, amount: u64) -> bool {
        if self.denomination == 0 {
            // Custom pool accepts any amount > 0
            amount > 0
        } else {
            // Fixed pool requires exact match
            amount == self.denomination
        }
    }

    /// Increment deposit count (call after successful shield)
    pub fn record_deposit(&mut self) {
        self.deposit_count = self.deposit_count.saturating_add(1);
    }

    /// Calculate relayer fee for a given amount
    pub fn calculate_relayer_fee(&self, amount: u64) -> u64 {
        // fee = amount * fee_bps / 10000
        (amount as u128 * self.relayer_fee_bps as u128 / 10000) as u64
    }

    /// Record a fee payment
    pub fn record_fee_collected(&mut self, fee: u64) {
        self.total_fees_collected = self.total_fees_collected.saturating_add(fee);
    }

    /// Add a commitment to the tree
    pub fn add_commitment(&mut self, commitment: [u8; 32]) -> Result<u64> {
        // Store old root in history before updating
        let old_root = self.merkle_tree.current_root;

        // Insert into Merkle tree
        let leaf_index = self.merkle_tree.insert(commitment)
            .map_err(|_| NyxError::PoolFull)?;

        // Add old root to history (circular buffer)
        self.root_history[self.root_history_index as usize] = old_root;
        self.root_history_index = ((self.root_history_index as usize + 1) % ROOT_HISTORY_SIZE) as u8;

        Ok(leaf_index)
    }

    /// Get current Merkle root
    pub fn current_root(&self) -> [u8; 32] {
        self.merkle_tree.current_root
    }

    /// Get number of commitments in tree
    pub fn commitment_count(&self) -> u64 {
        self.merkle_tree.next_index
    }

    /// Check if root is valid (current or in history)
    pub fn is_valid_root(&self, root: &[u8; 32]) -> bool {
        // Check current root
        if *root == self.merkle_tree.current_root {
            return true;
        }
        // Check history
        self.root_history.iter().any(|r| r == root && *r != [0u8; 32])
    }

    /// Check if nullifier is spent
    /// Note: This requires a separate NullifierSet account for actual lookup
    /// For now, this is a placeholder that always returns false
    pub fn is_nullifier_spent(&self, _nullifier: &[u8; 32]) -> bool {
        // Real implementation uses NullifierSet account
        false
    }

    /// Mark nullifier as spent (increment counter only)
    /// Note: Actual nullifier storage is in NullifierSet account
    pub fn record_nullifier_spent(&mut self) {
        self.nullifier_count += 1;
    }
}

/// Nullifier account (separate account for nullifier set)
#[account]
pub struct NullifierSet {
    /// Pool this nullifier set belongs to
    pub pool: Pubkey,

    /// Nullifier bitmap (each bit represents a nullifier slot)
    pub bitmap: [u8; 1024],
}

impl NullifierSet {
    /// Account size
    pub const SIZE: usize = 32 + 1024;
}
