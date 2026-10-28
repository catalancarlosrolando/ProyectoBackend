# ProyectoBackend

Este documento describe exclusivamente la parte de backend del proyecto desarrollada en PHP con Laravel. La interfaz frontend en JavaScript vanilla no está incluida en esta documentación.

## Descripción general

ProyectoBackend es una API REST para la gestión de contenido editorial, canales, medios, usuarios, dispositivos y moderación de publicaciones. Está pensado para soportar un flujo de publicación digital con autenticación, control de permisos por roles, administración de canales y entrega de contenido a dispositivos clientes.

La aplicación usa Laravel 12, PHP 8.2, Sanctum para autenticación por tokens, Spatie Permission para roles y permisos, y SQLite como base de datos por defecto para el entorno local.

## Stack tecnológico

- PHP 8.2
- Laravel 12
- Laravel Sanctum
- Spatie Laravel Permission
- SQLite (entorno local)
- Pest para pruebas
- SQL y Eloquent ORM
- API REST con respuestas JSON

## Objetivos del backend

- Gestionar usuarios y sesiones autenticadas.
- Controlar acceso por roles y permisos.
- Administrar canales temáticos y medios asociados.
- Permitir la creación y gestión de publicaciones con flujo de estado.
- Facilitar la revisión y aprobación de contenido por parte de moderadores.
- Entregar contenido a dispositivos autorizados.
- Mantener historial de cambios y notificaciones internas.
- Soportar carga de archivos y gestión de recursos multimedia.

## Funcionalidades principales

### 1. Autenticación y usuarios

El backend incluye un sistema de autenticación basado en tokens de Sanctum.

Incluye:

- Registro de usuarios
- Login con email y contraseña
- Logout
- Verificación de email
- Reenvío de correos de verificación
- Recuperación y restablecimiento de contraseña
- Consulta del usuario autenticado
- Roles y permisos por usuario

Además, cada usuario puede tener permisos asociados a tareas como:

- gestionar-usuarios
- gestionar-canales
- editar-contenido
- acceder-panel-admin

### 2. Roles y permisos

El proyecto implementa un sistema de autorización basado en roles y permisos con Spatie Permission.

Roles típicos del sistema:

- invitado
- publicador
- moderador
- admin

Esto permite proteger rutas y endpoints por permisos específicos, por ejemplo:

- usuarios administradores gestionan usuarios y canales
- publicadores gestionan publicaciones dentro de canales autorizados
- moderadores revisan y validan contenido
- administradores acceden a paneles y control global

### 3. Gestión de canales y medios

El backend administra contenidos organizados por canales temáticos y tipos de medios.

Funciones disponibles:

- listado de tipos de canales
- listado y creación de canales
- edición y eliminación de canales
- asociación de medios a canales
- consulta de medios disponibles por canal
- administración de medios y tipos de multimedia

La lógica valida que:

- el publicador esté autorizado para un canal
- los medios seleccionados pertenezcan al canal indicado

### 4. Gestión de publicaciones

La entidad principal del backend es Post, con un flujo completo de publicación y revisión.

Operaciones disponibles:

- listado con búsqueda y filtros
- creación de publicaciones en borrador
- detalle de publicación
- edición de publicaciones
- eliminación de publicaciones
- envío a revisión
- reversión a borrador
- archivado y desarchivado
- historial de cambios por versión
- comparación y restauración de versiones previas
- exportación del historial

Estados de publicación contemplados:

- draft
- submitted
- published
- archived
- rejected

El sistema además valida permisos y canales asociados antes de transformar el contenido a estados más avanzados.

### 5. Moderación de contenido

El backend incluye un módulo dedicado a la revisión editorial.

Funciones:

- listado de publicaciones pendientes de moderación
- detalle completo de la publicación para revisión
- aprobación de publicaciones
- rechazo con comentarios obligatorios
- detención de publicaciones ya publicadas
- registro de comentarios del moderador

Esto permite un control claro del ciclo editorial y la trazabilidad del proceso.

### 6. Asignación de canales a usuarios y dispositivos

El sistema permite relacionar usuarios con canales específicos y dispositivos con canales autorizados.

Módulos implementados:

- asignación de canales a publicadores
- revocación de acceso a canales
- consulta de canales del usuario
- asignación de canales a dispositivos
- recuperación de dispositivos con canales asociados

Este mecanismo es clave para limitar qué contenido puede publicar o consumir cada actor del sistema.

### 7. Gestión de dispositivos

El proyecto soporta dispositivos como clientes del sistema de contenido.

Incluye:

- alta de dispositivos por administración
- activación/desactivación de dispositivos
- listado de dispositivos
- eliminación y actualización
- publicación de contenido para dispositivos autorizados
- entrega de feed de publicaciones asociadas a canales del dispositivo

La API de dispositivos permite consultar publicaciones publicadas en los canales asignados al dispositivo, validando si este está activo y autorizado.

### 8. Archivos y recursos multimedia

El backend incluye endpoints para manejar archivos de prueba y recursos asociados al sistema.

Funciones:

- carga de archivos
- listado de archivos
- descarga de archivos
- eliminación de archivos

Esto permite manejar contenido adicional adjunto a publicaciones o recursos del sistema de forma centralizada.

### 9. Notificaciones

El backend incorpora un módulo de notificaciones para usuarios autenticados.

Funcionalidades:

- listado de notificaciones
- conteo de no leídas
- marcado individual como leído
- marcado de todas como leídas
- eliminación de notificaciones

Las notificaciones se usan para informar cambios de estado, asignaciones de canales, moderación y otros eventos relevantes del negocio.

### 10. Historial y auditoría

El sistema registra cambios relevantes sobre las publicaciones y otros registros de dominio.

Incluye:

- historial de versiones
- comparación de versiones
- restauración a una versión anterior
- trazabilidad de modificaciones por usuario y fecha

Esto fortalece la auditoría y permite corregir o recuperar contenido fácilmente.

## Endpoints principales del backend

La API se estructura bajo el prefijo /api y contiene rutas como:

- /api/ping
- /api/landing
- /api/register
- /api/login
- /api/logout
- /api/user
- /api/password/forgot
- /api/password/reset
- /api/email/verify/{id}/{hash}
- /api/email/resend
- /api/posts
- /api/posts/{post}
- /api/posts/{post}/submit
- /api/posts/{post}/history
- /api/moderation/posts
- /api/admin/users
- /api/admin/channels
- /api/admin/user-channels
- /api/admin/device-channels
- /api/admin/devices
- /api/notifications
- /api/device/posts
- /api/test-files

## Estructura de la aplicación Laravel

Principales carpetas del backend:

- app/Http/Controllers/Api: controladores REST del API
- app/Models: modelos Eloquent del dominio
- app/Http/Requests: validaciones de entrada por request
- app/Enums: enums del dominio
- app/Notifications: notificaciones del sistema
- app/Services: servicios de lógica de negocio
- routes/api.php: definición de endpoints
- database/migrations: definiciones de esquema
- database/seeders: carga inicial de datos
- tests/: pruebas automatizadas con Pest

## Seguridad y validación

El backend aplica medidas de seguridad y validación consistentes con Laravel:

- validación de entradas por request
- protección de rutas con middleware de autenticación
- control de acceso por permisos con Spatie
- protección por token Sanctum
- validación de permisos específicos para cada operación
- uso de transacciones para operaciones críticas
- manejo de errores JSON estandarizado

## Instalación y ejecución

Requisitos:

- PHP 8.2+
- Composer
- SQLite o base de datos compatible

Pasos básicos:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```

La API estará disponible en:

```bash
http://localhost:8000/api
```

## Pruebas

El proyecto incluye pruebas con Pest en la carpeta tests.

Para ejecutarlas:

```bash
php artisan test
```

## Resumen

La parte backend del proyecto implementa una API REST sólida para gestionar usuarios, roles, contenido editorial, dispositivos, canales, publicaciones, moderación, notificaciones y auditoría. Está diseñada para apoyar un flujo completo de administración digital y publicación de contenido con control de permisos y trazabilidad.

Esta documentación cubre el backend en PHP/Laravel; no incluye la interfaz frontend desarrollada en JavaScript vanilla.
