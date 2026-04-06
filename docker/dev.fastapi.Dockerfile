FROM python:3.13-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python/requirements.txt python/requirements.txt
RUN python -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r python/requirements.txt

ENV PATH="/app/venv/bin:$PATH"

COPY python/ python/

EXPOSE 8000
CMD ["uvicorn", "python.index:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
