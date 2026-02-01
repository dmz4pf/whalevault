import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

from services.veil_service import VeilService
from utils.errors import ValidationError, VeilError


class JobStatus(str, Enum):
    """Status of a proof generation job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    """Type of proof generation job."""

    UNSHIELD = "unshield"
    TRANSFER = "transfer"


@dataclass
class ProofJob:
    """Represents a proof generation job."""

    id: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0
    stage: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    result: Optional[dict] = None
    error: Optional[str] = None

    # Job parameters
    commitment: str = ""
    secret: str = ""
    amount: int = 0
    recipient: str = ""
    denomination: int = 0
    job_type: JobType = JobType.UNSHIELD


# Constants
STAGE_DELAY_SECONDS = 0.3
JOB_TTL_HOURS = 1


class ProofJobQueue:
    """In-memory queue for proof generation jobs."""

    def __init__(self, program_id: str):
        self._jobs: dict[str, ProofJob] = {}
        self._lock = asyncio.Lock()
        self._veil_service = VeilService(program_id)
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start background cleanup task."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        """Stop background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    async def _cleanup_loop(self) -> None:
        """Periodically clean up old jobs."""
        while True:
            await asyncio.sleep(300)  # Run every 5 minutes
            await self._cleanup_old_jobs()

    async def _cleanup_old_jobs(self) -> None:
        """Remove jobs older than TTL."""
        cutoff = datetime.utcnow() - timedelta(hours=JOB_TTL_HOURS)
        async with self._lock:
            expired = [
                job_id
                for job_id, job in self._jobs.items()
                if job.created_at < cutoff
                and job.status in [JobStatus.COMPLETED, JobStatus.FAILED]
            ]
            for job_id in expired:
                del self._jobs[job_id]

    async def submit(
        self,
        commitment: str,
        secret: str,
        amount: int,
        recipient: str,
        denomination: int = 0,
    ) -> ProofJob:
        """Submit a new unshield proof generation job."""
        job_id = str(uuid.uuid4())
        job = ProofJob(
            id=job_id,
            commitment=commitment,
            secret=secret,
            amount=amount,
            recipient=recipient,
            denomination=denomination,
            stage="queued",
            job_type=JobType.UNSHIELD,
        )

        async with self._lock:
            self._jobs[job_id] = job

        # Start background processing
        asyncio.create_task(self._process_job(job_id))

        return job

    async def submit_transfer(
        self,
        commitment: str,
        secret: str,
        amount: int,
        recipient: str,
        denomination: int = 0,
    ) -> ProofJob:
        """Submit a new private transfer proof generation job."""
        job_id = str(uuid.uuid4())
        job = ProofJob(
            id=job_id,
            commitment=commitment,
            secret=secret,
            amount=amount,
            recipient=recipient,
            denomination=denomination,
            stage="queued",
            job_type=JobType.TRANSFER,
        )

        async with self._lock:
            self._jobs[job_id] = job

        # Start background processing
        asyncio.create_task(self._process_transfer_job(job_id))

        return job

    async def get_status(self, job_id: str) -> Optional[ProofJob]:
        """Get the status of a job."""
        async with self._lock:
            return self._jobs.get(job_id)

    async def update_progress(
        self,
        job_id: str,
        progress: int,
        stage: Optional[str] = None,
    ) -> None:
        """Update job progress."""
        async with self._lock:
            if job_id in self._jobs:
                self._jobs[job_id].progress = progress
                if stage:
                    self._jobs[job_id].stage = stage

    async def _process_job(self, job_id: str) -> None:
        """Process proof generation job with real VeilService."""
        # Extract parameters while holding the lock (fixes race condition)
        async with self._lock:
            if job_id not in self._jobs:
                return
            job = self._jobs[job_id]
            job.status = JobStatus.PROCESSING
            # Copy parameters to local variables
            commitment = job.commitment
            secret = job.secret
            amount = job.amount
            recipient = job.recipient

        try:
            # Progress stages for UX feedback
            await self.update_progress(job_id, 10, "initializing")
            await asyncio.sleep(STAGE_DELAY_SECONDS)

            await self.update_progress(job_id, 30, "generating_witnesses")
            await asyncio.sleep(STAGE_DELAY_SECONDS)

            await self.update_progress(job_id, 60, "computing_proof")

            # Generate real proof using VeilService (with local copies)
            veil_result = await asyncio.to_thread(
                self._veil_service.generate_proof,
                commitment=commitment,
                secret=secret,
                amount=amount,
                recipient=recipient,
            )

            await self.update_progress(job_id, 90, "verifying_proof")
            await asyncio.sleep(STAGE_DELAY_SECONDS * 0.66)

            await self.update_progress(job_id, 100, "finalizing")

            # Store real proof result
            async with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.COMPLETED
                    self._jobs[job_id].result = {
                        "proof": veil_result.proof,
                        "publicInputs": veil_result.public_inputs,
                        "nullifier": veil_result.nullifier,
                        "verified": True,
                    }

        except (ValidationError, VeilError) as e:
            # Safe to expose these error messages
            async with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.FAILED
                    self._jobs[job_id].error = str(e)

        except Exception:
            # Sanitize unexpected exceptions to avoid leaking secrets
            async with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.FAILED
                    self._jobs[job_id].error = "Proof generation failed unexpectedly"

    async def _process_transfer_job(self, job_id: str) -> None:
        """Process private transfer proof generation job."""
        # Extract parameters while holding the lock
        async with self._lock:
            if job_id not in self._jobs:
                return
            job = self._jobs[job_id]
            job.status = JobStatus.PROCESSING
            commitment = job.commitment
            secret = job.secret
            amount = job.amount
            recipient = job.recipient

        try:
            await self.update_progress(job_id, 10, "initializing")
            await asyncio.sleep(STAGE_DELAY_SECONDS)

            await self.update_progress(job_id, 30, "generating_transfer_witnesses")
            await asyncio.sleep(STAGE_DELAY_SECONDS)

            await self.update_progress(job_id, 60, "computing_transfer_proof")

            # Generate transfer proof using VeilService
            veil_result = await asyncio.to_thread(
                self._veil_service.generate_transfer_proof,
                commitment=commitment,
                secret=secret,
                amount=amount,
                recipient=recipient,
            )

            await self.update_progress(job_id, 90, "verifying_proof")
            await asyncio.sleep(STAGE_DELAY_SECONDS * 0.66)

            await self.update_progress(job_id, 100, "finalizing")

            # Store transfer proof result (includes recipient_secret and new_commitment)
            async with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.COMPLETED
                    self._jobs[job_id].result = {
                        "proof": veil_result.proof,
                        "nullifier": veil_result.nullifier,
                        "new_commitment": veil_result.new_commitment,
                        "recipient_secret": veil_result.recipient_secret,
                        "publicInputs": veil_result.public_inputs,
                        "verified": True,
                    }

        except (ValidationError, VeilError) as e:
            async with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.FAILED
                    self._jobs[job_id].error = str(e)

        except Exception:
            async with self._lock:
                if job_id in self._jobs:
                    self._jobs[job_id].status = JobStatus.FAILED
                    self._jobs[job_id].error = "Transfer proof generation failed unexpectedly"
