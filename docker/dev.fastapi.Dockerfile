# Python 3.13 matches pyproject's requires-python, the Modal image and CI.
FROM python:3.13-slim

# uv, pinned to the version that wrote uv.lock (same as the Modal image and CI).
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /bin/

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install from the lock before copying code so edits don't rebuild this layer.
# --no-dev: the container only serves the API; lint/test tools stay on the host.
ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

COPY python/ python/

EXPOSE 8000
CMD ["uvicorn", "python.index:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
