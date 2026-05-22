FROM php:8.3-cli

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libpng-dev libonig-dev libxml2-dev libicu-dev \
        libcurl4-openssl-dev sqlite3 libsqlite3-dev pkg-config \
    && docker-php-ext-install \
        pdo pdo_mysql pdo_sqlite mbstring xml bcmath curl zip gd intl \
    && rm -rf /var/lib/apt/lists/*

COPY . .

ENV COMPOSER_ALLOW_SUPERUSER=1
RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" \
    && php composer-setup.php --install-dir=/usr/local/bin --filename=composer \
    && rm composer-setup.php \
    && composer install --no-dev --optimize-autoloader --no-interaction

RUN chmod -R 775 storage bootstrap/cache

EXPOSE 8080

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} -t public/"]
