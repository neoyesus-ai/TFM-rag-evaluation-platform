#!/usr/bin/env bash

set -uo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000/health}"
CHROMA_URL="${CHROMA_URL:-http://localhost:8001/api/v2/heartbeat}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434/api/tags}"
MINIO_URL="${MINIO_URL:-http://localhost:9000/minio/health/live}"

failures=0

check_http() {
    local name="$1"
    local url="$2"

    printf "Comprobando %-12s %s ... " "$name" "$url"

    if curl \
        --fail \
        --silent \
        --show-error \
        --max-time 5 \
        "$url" >/dev/null; then
        echo "OK"
    else
        echo "ERROR"
        failures=$((failures + 1))
    fi
}

check_postgres() {
    printf "Comprobando %-12s ... " "PostgreSQL"

    if docker compose exec -T postgres \
        pg_isready \
        -U "${POSTGRES_USER:-postgres}" \
        -d "${POSTGRES_DB:-postgres}" >/dev/null 2>&1; then
        echo "OK"
    else
        echo "ERROR"
        failures=$((failures + 1))
    fi
}

check_postgres
check_http "Backend" "$BACKEND_URL"
check_http "ChromaDB" "$CHROMA_URL"
check_http "Ollama" "$OLLAMA_URL"
check_http "MinIO" "$MINIO_URL"

echo

if (( failures > 0 )); then
    echo "Healthcheck finalizado con ${failures} servicio(s) no disponible(s)."
    exit 1
fi

echo "Todos los servicios están disponibles."
