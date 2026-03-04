# --- Build stage: install dependencies into a venv ---
FROM python:3.12-slim AS builder

WORKDIR /build

RUN pip install --no-cache-dir uv

COPY api/pyproject.toml .
RUN python -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    uv pip install -r pyproject.toml

# --- Runtime stage ---
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r opslog && useradd -r -g opslog -d /app opslog

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY api/app/ app/
COPY api/migrations/ migrations/
COPY api/scripts/ scripts/
COPY api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R opslog:opslog /app

USER opslog

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8600/api/v1/health || exit 1

EXPOSE 8600

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8600"]
