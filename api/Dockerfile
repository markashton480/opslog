FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY api/pyproject.toml .
RUN uv pip install --system -r pyproject.toml && \
    uv pip install --system pytest pytest-asyncio httpx

COPY api/ app/

EXPOSE 8600

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8600"]
