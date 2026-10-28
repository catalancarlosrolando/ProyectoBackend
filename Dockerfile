# PHP 8.3.36 parchea CVE-2026-109618 / CVE-2026-109619 (PHP2Shell)
# Usamos -cli (no -fpm) porque arrancás con `php artisan serve`
FROM php:8.3.36-cli

# Timezone y locale
ENV TZ=America/Argentina/San_Juan
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app

# Dependencias del sistema + extensiones PHP
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libpng-dev libonig-dev libxml2-dev libicu-dev \
        libcurl4-openssl-dev sqlite3 libsqlite3-dev pkg-config \
        tzdata \
    && docker-php-ext-install \
        pdo pdo_mysql pdo_sqlite mbstring xml bcmath curl zip gd intl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# Configuración de PHP (upload limits, memory, etc.)
RUN echo "upload_max_filesize = 10M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 64M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "date.timezone = America/Argentina/San_Juan" >> /usr/local/etc/php/conf.d/uploads.ini

# Composer global
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN curl -sS https://getcomposer.org/installer | php -- \
    --install-dir=/usr/local/bin --filename=composer

# Optimización de cache Docker: copiamos primero SOLO composer.*
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# Copiamos el resto del código (gracias al .dockerignore, sin vendor/.git/.env)
COPY . .

# Permisos Laravel
RUN mkdir -p database storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache database

# Script de arranque
RUN chmod +x deploy.sh

EXPOSE 8080

CMD ["./deploy.sh"]