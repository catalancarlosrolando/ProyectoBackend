#!/bin/bash
# deploy.sh — arranque del contenedor

set -e

DB_PATH="/app/database/database.sqlite"
PORT="${PORT:-8080}"

# Si la variable RESET_DB=true, borramos la DB (solo para entornos efímeros)
if [ "${RESET_DB:-false}" = "true" ]; then
  echo ">> RESET_DB=true: eliminando base de datos antigua..."
  rm -f "$DB_PATH"
fi

# Creamos el archivo SQLite si no existe
if [ ! -f "$DB_PATH" ]; then
  echo ">> Creando base de datos SQLite vacía..."
  mkdir -p "$(dirname "$DB_PATH")"
  touch "$DB_PATH"
fi

# Migraciones
echo ">> Corriendo migraciones..."
php artisan migrate --force

# Seeders solo si la variable SEED=true o si la DB estaba vacía
if [ "${SEED:-false}" = "true" ]; then
  echo ">> Corriendo seeders..."
  php artisan db:seed --force
fi

# Enlace simbólico de storage (idempotente)
php artisan storage:link 2>/dev/null || true

echo ">> Iniciando servidor PHP en puerto $PORT..."
exec php -S 0.0.0.0:${PORT} -t public/