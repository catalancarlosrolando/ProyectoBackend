#!/bin/bash
# deploy.sh

DB_PATH="/app/database/database.sqlite"

# Si existe, lo borramos para limpiar en cada deploy
if [ -f "$DB_PATH" ]; then
  echo "Eliminando base de datos antigua..."
  rm "$DB_PATH"
fi

# Creamos un archivo sqlite completamente nuevo y vacío
echo "Creando base de datos limpia..."
touch "$DB_PATH"

# Ejecutamos las migraciones y los seeders
echo "Corriendo migraciones y seeds..."
php artisan migrate --force --seed

status=$?
if [ $status -ne 0 ]; then
  echo "Error durante la migración o el seed. Código de salida: $status"
  exit $status
fi

echo "Migración y seed completados con éxito."

# IMPORTANTE: Ahora ejecutamos el servidor web para que el contenedor no se apague
echo "Iniciando servidor PHP..."
exec php -S 0.0.0.0:${PORT:-8080} -t public/
