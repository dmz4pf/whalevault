import binascii
from dataclasses import dataclass
from typing import Tuple

from solders.pubkey import Pubkey
from veil import _rust_core, generate_secret
from veil.utils import hex_to_bytes

from utils.errors import ValidationError


# System Program ID (constant)
SYSTEM_PROGRAM_ID = "11111111111111111111111111111111"

# Seeds for PDAs (must match on-chain program)
POOL_SEED = b"pool"
VAULT_SEED = b"vault"
NULLIFIER_SEED = b"nullifier"


def bytes_to_hex(data: bytes) -> str:
    """Convert bytes to hex string for JSON serialization."""
    return data.hex()


def validate_hex(value: str, field_name: str) -> bytes:
    """Validate and decode a hex string."""
    try:
        return hex_to_bytes(value)
    except (ValueError, binascii.Error) as e:
        raise ValidationError(
            f"Invalid hex encoding for {field_name}",
            details={"field": field_name, "error": str(e)}
        )


def find_pool_pda(program_id: Pubkey, denomination: int = 0) -> Tuple[Pubkey, int]:
    """Derive the pool PDA address.

    Seeds: [b"pool", denomination_le_bytes]
    """
    denomination_bytes = denomination.to_bytes(8, byteorder="little")
    return Pubkey.find_program_address([POOL_SEED, denomination_bytes], program_id)


def find_vault_pda(program_id: Pubkey, pool: Pubkey) -> Tuple[Pubkey, int]:
    """Derive the vault PDA address."""
    return Pubkey.find_program_address([VAULT_SEED, bytes(pool)], program_id)


def find_nullifier_marker_pda(program_id: Pubkey, pool: Pubkey, nullifier: bytes) -> Tuple[Pubkey, int]:
    """Derive the nullifier marker PDA address."""
    return Pubkey.find_program_address([NULLIFIER_SEED, bytes(pool), nullifier], program_id)


@dataclass
class CommitmentResult:
    """Result of commitment generation."""

    commitment: str
    secret: str


@dataclass
class ProofResult:
    """Result of proof generation."""

    proof: str
    nullifier: str
    public_inputs: dict


@dataclass
class TransferProofResult:
    """Result of private transfer proof generation."""

    proof: str
    nullifier: str
    new_commitment: str
    recipient_secret: str
    public_inputs: dict


class VeilService:
    """Service for cryptographic operations using Veil SDK."""

    def __init__(self, program_id: str):
        self.program_id = program_id

    def generate_commitment(self, amount: int, depositor: str) -> CommitmentResult:
        """
        Generate a commitment for a deposit using Veil SDK.

        Args:
            amount: Amount in lamports to shield
            depositor: Public key of the depositor (unused in commitment, kept for interface)

        Returns:
            CommitmentResult with hex-encoded commitment and secret
        """
        secret_hex = generate_secret()
        secret_bytes = hex_to_bytes(secret_hex)

        commitment_bytes = _rust_core.generate_commitment(
            amount=amount,
            secret=secret_bytes
        )

        return CommitmentResult(
            commitment=bytes_to_hex(commitment_bytes),
            secret=secret_hex,
        )

    def generate_proof(
        self,
        commitment: str,
        secret: str,
        amount: int,
        recipient: str,
        merkle_root: str = None,
        path_elements: list = None,
        path_indices: list = None,
    ) -> ProofResult:
        """
        Generate a zero-knowledge proof for withdrawal.

        For MVP: Uses placeholder proof (Poseidon hash chain)
        For Production: Uses real Groth16 ZK proof when merkle data provided

        Args:
            commitment: Hex-encoded commitment
            secret: Hex-encoded secret used to create the commitment
            amount: Amount in lamports being withdrawn
            recipient: Public key of the recipient
            merkle_root: (Optional) Current Merkle root for ZK proof
            path_elements: (Optional) Merkle proof siblings
            path_indices: (Optional) Path direction bits

        Returns:
            ProofResult with hex-encoded proof, nullifier, and public inputs
        """
        secret_bytes = validate_hex(secret, "secret")
        commitment_bytes = validate_hex(commitment, "commitment")

        # Generate nullifier
        nullifier_bytes = _rust_core.generate_nullifier(
            commitment=commitment_bytes,
            secret=secret_bytes
        )
        nullifier_hex = bytes_to_hex(nullifier_bytes)

        # Check if we have Merkle data for real ZK proof
        if merkle_root and path_elements and path_indices:
            # Production: Generate real Groth16 proof
            from services.proof_generator import generate_zk_proof

            # Convert recipient pubkey to 32-byte hex
            recipient_bytes = bytes(32)
            try:
                from solders.pubkey import Pubkey
                recipient_bytes = bytes(Pubkey.from_string(recipient))
            except Exception:
                recipient_bytes = recipient.encode().ljust(32, b'\x00')[:32]

            recipient_hex = "0x" + recipient_bytes.hex()

            zk_result = generate_zk_proof(
                root=merkle_root if merkle_root.startswith("0x") else "0x" + merkle_root,
                nullifier_hash="0x" + nullifier_hex,
                recipient=recipient_hex,
                amount=amount,
                secret="0x" + secret,
                path_elements=["0x" + e if not e.startswith("0x") else e for e in path_elements],
                path_indices=path_indices,
            )

            return ProofResult(
                proof=zk_result.proof_bytes,
                nullifier=nullifier_hex,
                public_inputs={
                    "root": merkle_root,
                    "nullifier": nullifier_hex,
                    "recipient": recipient,
                    "amount": amount,
                },
            )

        # MVP fallback: Generate placeholder proof (for testing without Merkle tree)
        # The Solana program expects 96-byte MVP proofs: [signature (64) | pubkey (32)]
        # MVP verification only checks that signature and pubkey are non-zero
        amount_bytes = amount.to_bytes(32, byteorder='big')
        recipient_bytes = recipient.encode().ljust(32, b'\x00')[:32]

        # Generate deterministic "signature" from commitment data (64 bytes)
        hash1 = _rust_core.poseidon_hash([commitment_bytes, nullifier_bytes])
        hash2 = _rust_core.poseidon_hash([amount_bytes, recipient_bytes])
        signature_part1 = _rust_core.poseidon_hash([hash1, hash2])  # 32 bytes
        signature_part2 = _rust_core.poseidon_hash([hash2, hash1])  # 32 bytes
        signature_bytes = signature_part1 + signature_part2  # 64 bytes

        # Generate deterministic "pubkey" from secret (32 bytes)
        pubkey_bytes = _rust_core.poseidon_hash([secret_bytes, commitment_bytes])  # 32 bytes

        # Combine into 96-byte MVP proof format
        proof_bytes = signature_bytes + pubkey_bytes  # 96 bytes total

        return ProofResult(
            proof=bytes_to_hex(proof_bytes),
            nullifier=nullifier_hex,
            public_inputs={
                "commitment": commitment,
                "nullifier": nullifier_hex,
                "recipient": recipient,
                "amount": amount,
            },
        )

    def build_shield_instruction(
        self,
        commitment: str,
        amount: int,
        depositor: str,
        denomination: int = 0,
    ) -> dict:
        """
        Build the instruction data for a shield transaction.

        Args:
            commitment: Hex-encoded commitment
            amount: Amount in lamports to shield
            depositor: Public key of the depositor
            denomination: Pool denomination in lamports (0 = custom)

        Returns:
            Instruction data dict for Solana transaction

        Note:
            Account order must match Veil program's ShieldSol struct:
            [pool, vault, depositor, system_program]
        """
        # Parse program ID and derive PDAs for the correct denomination pool
        program_pubkey = Pubkey.from_string(self.program_id)
        pool_pda, _ = find_pool_pda(program_pubkey, denomination)
        vault_pda, _ = find_vault_pda(program_pubkey, pool_pda)

        return {
            "programId": self.program_id,
            "keys": [
                {"pubkey": str(pool_pda), "isSigner": False, "isWritable": True},
                {"pubkey": str(vault_pda), "isSigner": False, "isWritable": True},
                {"pubkey": depositor, "isSigner": True, "isWritable": True},
                {"pubkey": SYSTEM_PROGRAM_ID, "isSigner": False, "isWritable": False},
            ],
            "data": {
                "commitment": commitment,
                "amount": amount,
            },
        }

    def build_unshield_instruction(
        self,
        proof: bytes,
        nullifier: bytes,
        amount: int,
        recipient: str,
        relayer: str,
        denomination: int = 0,
    ) -> dict:
        """
        Build the instruction data for an unshield transaction.

        Args:
            proof: The ZK proof bytes
            nullifier: The nullifier hash (32 bytes)
            amount: Amount in lamports to withdraw
            recipient: Recipient wallet address (base58)
            relayer: Relayer/signer wallet address (base58)
            denomination: Pool denomination in lamports (0 = custom)

        Returns:
            Instruction data dict for Solana transaction

        Note:
            Account order must match Veil program's UnshieldSol struct:
            [pool, nullifier_marker, vault, recipient, relayer, system_program]
        """
        import hashlib
        import struct
        import base64

        # Parse program ID and derive PDAs for the correct denomination pool
        program_pubkey = Pubkey.from_string(self.program_id)
        pool_pda, _ = find_pool_pda(program_pubkey, denomination)
        vault_pda, _ = find_vault_pda(program_pubkey, pool_pda)
        nullifier_marker_pda, _ = find_nullifier_marker_pda(program_pubkey, pool_pda, nullifier)

        # Build instruction data: discriminator + nullifier + amount + proof
        # Anchor discriminator = first 8 bytes of sha256("global:unshield_sol")
        discriminator = hashlib.sha256(b"global:unshield_sol").digest()[:8]

        # Pack: discriminator (8) + nullifier (32) + amount (8, little-endian u64) + proof (Vec<u8>)
        # Vec<u8> in Borsh: 4-byte little-endian length prefix + data
        data = (
            discriminator +
            nullifier +
            struct.pack("<Q", amount) +
            struct.pack("<I", len(proof)) +
            proof
        )

        return {
            "programId": self.program_id,
            "keys": [
                {"pubkey": str(pool_pda), "isSigner": False, "isWritable": True},
                {"pubkey": str(nullifier_marker_pda), "isSigner": False, "isWritable": True},
                {"pubkey": str(vault_pda), "isSigner": False, "isWritable": True},
                {"pubkey": recipient, "isSigner": False, "isWritable": True},
                {"pubkey": relayer, "isSigner": True, "isWritable": True},
                {"pubkey": SYSTEM_PROGRAM_ID, "isSigner": False, "isWritable": False},
            ],
            "data": base64.b64encode(data).decode("utf-8"),
        }

    def generate_transfer_proof(
        self,
        commitment: str,
        secret: str,
        amount: int,
        recipient: str,
    ) -> TransferProofResult:
        """
        Generate a proof for private transfer (shielded-to-shielded).

        This creates a NEW commitment for the recipient with a random secret.
        The sender's commitment is nullified, recipient gets a new commitment.
        SOL never moves - it stays in the pool.

        Args:
            commitment: Sender's hex-encoded commitment
            secret: Sender's hex-encoded secret
            amount: Amount in lamports being transferred
            recipient: Recipient's Solana address (for reference only)

        Returns:
            TransferProofResult with proof, nullifier, new_commitment, and recipient_secret
        """
        secret_bytes = validate_hex(secret, "secret")
        commitment_bytes = validate_hex(commitment, "commitment")

        # Generate nullifier from sender's commitment
        nullifier_bytes = _rust_core.generate_nullifier(
            commitment=commitment_bytes,
            secret=secret_bytes
        )
        nullifier_hex = bytes_to_hex(nullifier_bytes)

        # Generate NEW random secret for recipient
        recipient_secret_hex = generate_secret()
        recipient_secret_bytes = hex_to_bytes(recipient_secret_hex)

        # Generate NEW commitment for recipient
        new_commitment_bytes = _rust_core.generate_commitment(
            amount=amount,
            secret=recipient_secret_bytes
        )
        new_commitment_hex = bytes_to_hex(new_commitment_bytes)

        # Generate MVP transfer proof (96 bytes)
        # Similar to unshield proof but signs: nullifier || new_commitment
        amount_bytes = amount.to_bytes(32, byteorder='big')

        hash1 = _rust_core.poseidon_hash([nullifier_bytes, new_commitment_bytes])
        hash2 = _rust_core.poseidon_hash([amount_bytes, commitment_bytes])
        signature_part1 = _rust_core.poseidon_hash([hash1, hash2])
        signature_part2 = _rust_core.poseidon_hash([hash2, hash1])
        signature_bytes = signature_part1 + signature_part2  # 64 bytes

        pubkey_bytes = _rust_core.poseidon_hash([secret_bytes, new_commitment_bytes])  # 32 bytes

        proof_bytes = signature_bytes + pubkey_bytes  # 96 bytes total

        return TransferProofResult(
            proof=bytes_to_hex(proof_bytes),
            nullifier=nullifier_hex,
            new_commitment=new_commitment_hex,
            recipient_secret=recipient_secret_hex,
            public_inputs={
                "nullifier": nullifier_hex,
                "new_commitment": new_commitment_hex,
                "amount": amount,
                "recipient": recipient,
            },
        )

    def build_transfer_instruction(
        self,
        proof: bytes,
        nullifier: bytes,
        new_commitment: bytes,
        relayer: str,
        denomination: int = 0,
    ) -> dict:
        """
        Build the instruction data for a private transfer transaction.

        A transfer nullifies the sender's commitment and adds a new commitment
        for the recipient. No SOL moves - it stays in the shielded pool.

        Args:
            proof: The proof bytes (96 bytes for MVP)
            nullifier: The nullifier hash (32 bytes)
            new_commitment: The new commitment for recipient (32 bytes)
            relayer: Relayer/signer wallet address (base58)
            denomination: Pool denomination in lamports (0 = custom)

        Returns:
            Instruction data dict for Solana transaction

        Note:
            Account order must match Veil program's Transfer struct:
            [pool, nullifier_marker, relayer, system_program]
        """
        import hashlib
        import struct
        import base64

        program_pubkey = Pubkey.from_string(self.program_id)
        pool_pda, _ = find_pool_pda(program_pubkey, denomination)
        nullifier_marker_pda, _ = find_nullifier_marker_pda(program_pubkey, pool_pda, nullifier)

        # Anchor discriminator = first 8 bytes of sha256("global:transfer")
        discriminator = hashlib.sha256(b"global:transfer").digest()[:8]

        # Pack: discriminator (8) + nullifier (32) + new_commitment (32) + proof (Vec<u8>)
        data = (
            discriminator +
            nullifier +
            new_commitment +
            struct.pack("<I", len(proof)) +
            proof
        )

        return {
            "programId": self.program_id,
            "keys": [
                {"pubkey": str(pool_pda), "isSigner": False, "isWritable": True},
                {"pubkey": str(nullifier_marker_pda), "isSigner": False, "isWritable": True},
                {"pubkey": relayer, "isSigner": True, "isWritable": True},
                {"pubkey": SYSTEM_PROGRAM_ID, "isSigner": False, "isWritable": False},
            ],
            "data": base64.b64encode(data).decode("utf-8"),
        }
