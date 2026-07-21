FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY frontend/ ./frontend/

# /data/secret holds the master encryption key and JWT secret, kept on
# their own volume in docker-compose.yml so a backup of the database
# volume never carries the keys that decrypt/sign what's in it.
RUN mkdir -p /data /data/secret
VOLUME ["/data", "/data/secret"]

ENV PYTHONPATH=/app/backend

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5050/health', timeout=5)"

WORKDIR /app/backend
CMD ["python", "app.py"]
