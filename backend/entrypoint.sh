#!/usr/bin/env sh

set -eu

echo "Aplicando migraciones de base de datos..."
alembic upgrade head

echo "Inicializando usuario administrador..."
python -m app.auth.bootstrap

echo "Iniciando FastAPI..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000
