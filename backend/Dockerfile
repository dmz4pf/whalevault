# WhaleVault Backend Dockerfile
# Multi-stage build for Python + Rust (Veil SDK)

# Stage 1: Build Rust extensions
# Using nightly for edition2024 support (required by time crate v0.3.46)
FROM rustlang/rust:nightly-bookworm-slim as rust-builder

# Install build dependencies + Python 3.12
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libncurses5-dev \
    libffi-dev \
    liblzma-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.12 from source
RUN wget https://www.python.org/ftp/python/3.12.0/Python-3.12.0.tgz \
    && tar -xzf Python-3.12.0.tgz \
    && cd Python-3.12.0 \
    && ./configure --enable-optimizations \
    && make -j$(nproc) \
    && make install \
    && cd .. && rm -rf Python-3.12.0 Python-3.12.0.tgz

# Install maturin for building Rust Python extensions
RUN pip3 install maturin

# Copy veil SDK source
WORKDIR /build
COPY veil /build/veil

# Build the Rust extension wheel
WORKDIR /build/veil
RUN maturin build --release --strip -o /build/wheels

# Stage 2: Python runtime
FROM python:3.12-slim-bookworm

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy wheels from builder
COPY --from=rust-builder /build/wheels /wheels

# Copy backend source
COPY backend /app

# Create requirements for production (without local veil reference)
RUN grep -v "^-e" requirements.txt > requirements-prod.txt && \
    pip install --no-cache-dir -r requirements-prod.txt && \
    pip install --no-cache-dir /wheels/*.whl && \
    rm -rf /wheels requirements-prod.txt

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Environment variables
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/api/health')" || exit 1

# Run the server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

EXPOSE 8000
