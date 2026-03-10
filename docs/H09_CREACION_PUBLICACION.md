# Módulo de Gestión de Publicaciones

## Historia de Usuario — H09: Creación de publicación (Sol)

> Como publicador quiero poder crear una nueva publicación para que pueda compartir información relevante en los canales autorizados.

---

## Criterios de aceptación

| # | Criterio | Estado |
|---|----------|--------|
| 1 | Ingresar título, contenido y adjuntar archivos multimedia (imágenes, videos) | ✅ |
| 2 | Solo los usuarios Publicadores pueden crear nuevas publicaciones | ✅ |
| 3 | Seleccionar uno o varios canales (solo entre los autorizados al publicador) | ✅ |
| 4 | Seleccionar los medios de publicación específicos para cada canal seleccionado | ✅ |
| 5 | Programar la fecha y hora de publicación | ✅ |
| 6 | Guardar la publicación en estado "borrador" hasta que sea aprobada por el moderador | ✅ |

---

## Endpoints

Todos los endpoints requieren autenticación (`auth:sanctum`) y permiso `editar-contenido` (rol `publicador`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/posts` | Listar publicaciones del usuario autenticado (paginado) |
| `POST` | `/api/posts` | Crear una nueva publicación en estado borrador |
| `GET` | `/api/posts/{post}` | Ver detalle de una publicación propia |
| `GET` | `/api/posts//channels/{user}` | Ver canales asociados a un publicador (reutilizacion del controlador "UserChannelController") |
| `GET` | `/api/posts/{channel}/medias` | Ver medios asociados a un canal (reutilizaciond del controlador "ChannelMediaController") |

---

## Archivos involucrados

### Backend — Creados

| Archivo | Descripción |
|---------|-------------|
| `app/Http/Controllers/Api/PostController.php` | Controller con métodos `index`, `store` y `show` |
| `app/Http/Requests/StorePostRequest.php` | Validación de datos de entrada con mensajes en español |
| `tests/Feature/PostTest.php` | 13 tests automatizados con Pest |

### Backend — Modificados

| Archivo | Cambio |
|---------|--------|
| `routes/api.php` | Grupo de rutas `/api/posts` con middleware `permission:editar-contenido` |

### Frontend — Creados

| Archivo | Descripción |
|---------|-------------|
| `public/frontend/js/posts.js` | Módulo JS completo para gestión de publicaciones |

### Frontend — Modificados

| Archivo | Cambio |
|---------|--------|
| `public/frontend/index.html` | Sección Publicaciones, modal de creación, modal de detalle, enlace de navegación con clase `publisher-only` |
| `public/frontend/js/core.js` | Método `authUpload(ep, formData)` en el cliente API para envío de `FormData` con autenticación |
| `public/frontend/js/auth.js` | Visibilidad de elementos `.publisher-only` según permiso `editar-contenido` |
| `public/frontend/js/ui.js` | Navegación a sección `posts` → `loadPosts()` |
| `public/frontend/js/app.js` | Event listeners para botones de publicaciones y `setupPostFileUpload()` |
| `public/frontend/css/styles.css` | Estilos para checkboxes de canales/medios, detalle de publicación, paginación y columnas de tabla |

### Pre-existentes (sin cambios)

| Archivo | Rol en el módulo |
|---------|------------------|
| `app/Models/Post.php` | Modelo con relaciones a User, Channel, Media y Attachment |
| `app/Models/Attachment.php` | Modelo de archivos adjuntos |
| `app/Enums/PostStatus.php` | Estados: `draft`, `approved_by_moderator`, `scheduled`, `archived` |
| `app/Enums/PostType.php` | Tipos: `text`, `video`, `audio`, `image`, `multimedia` |

---

## Detalle del endpoint `POST /api/posts`

### Request

**Content-Type:** `multipart/form-data` (cuando se adjuntan archivos) o `application/json`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | Sí | Título de la publicación (máx. 255 caracteres) |
| `content` | string | Sí | Contenido de la publicación (máx. 10.000 caracteres) |
| `type` | string | Sí | Tipo: `text`, `video`, `audio`, `image`, `multimedia` |
| `channel_ids` | array[int] | Sí | IDs de canales autorizados al publicador |
| `media_ids` | array[int] | No | IDs de medios asociados a los canales seleccionados |
| `scheduled_at` | datetime | No | Fecha/hora de publicación programada (debe ser futura) |
| `attachments` | array[file] | No | Archivos adjuntos (máx. 10, máx. 10 MB c/u) |

**Tipos de archivo permitidos:** `jpg`, `jpeg`, `png`, `gif`, `webp`, `mp4`, `mov`, `avi`, `webm`, `mp3`, `wav`, `pdf`

### Ejemplo de request (JSON sin archivos)

```json
{
  "name": "Convocatoria abierta 2026",
  "content": "Se abre la convocatoria para proyectos de investigación...",
  "type": "text",
  "channel_ids": [1, 3],
  "media_ids": [2, 5],
  "scheduled_at": "2026-03-15T10:00:00Z"
}
```

### Response exitosa (201)

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "user_id": 4,
    "name": "Convocatoria abierta 2026",
    "content": "Se abre la convocatoria para proyectos de investigación...",
    "type": "text",
    "status": "draft",
    "scheduled_at": "2026-03-15T10:00:00.000000Z",
    "channels": [
      { "id": 1, "name": "Departamento TI", "type": "department" },
      { "id": 3, "name": "Instituto Investigación", "type": "institute" }
    ],
    "medias": [
      { "id": 2, "name": "Pantalla Hall", "type": "physical_screen" }
    ],
    "attachments": []
  },
  "message": "Publicación creada correctamente en estado borrador."
}
```

### Respuestas de error

| Código | Situación |
|--------|-----------|
| `401` | No autenticado |
| `403` | Sin permiso `editar-contenido` o canal no autorizado al publicador |
| `422` | Validación fallida o medios que no pertenecen a los canales seleccionados |

---

## Validaciones de negocio

1. **Canales autorizados:** Se verifica que cada `channel_id` enviado esté asignado al publicador en la tabla `user_channels`. Si alguno no lo está, se rechaza con 403.

2. **Medios válidos por canal:** Se verifica que cada `media_id` esté asociado a los canales seleccionados en la tabla `channel_medias`. Si alguno no lo está, se rechaza con 422.

3. **Estado borrador automático:** Toda publicación se crea con `status = draft` independientemente de lo que envíe el cliente. El cambio de estado queda reservado al moderador.

4. **Transacción atómica:** La creación del post, la asociación de canales/medios y el almacenamiento de archivos se ejecutan dentro de una transacción de base de datos.

---

## Modelo de datos

```
┌──────────┐     1:N      ┌──────────────┐
│  users   │─────────────→│    posts      │
└──────────┘              └──────────────┘
                               │
                    ┌──────────┼──────────┐
                    │ N:M      │ 1:N      │ N:M
                    ▼          ▼          ▼
             ┌──────────┐ ┌────────────┐ ┌────────┐
             │ channels │ │attachments │ │ medias │
             └──────────┘ └────────────┘ └────────┘
                    │                        │
                    └────────── N:M ─────────┘
                         channel_medias
```

**Tablas pivote:** `post_channels`, `post_medias`, `channel_medias`, `user_channels`

---

## Tests

13 tests automatizados con Pest que cubren todos los criterios de aceptación:

```
✓ requiere autenticación
✓ requiere permiso editar-contenido
✓ crea una publicación en estado borrador con datos válidos
✓ permite programar fecha y hora de publicación
✓ permite adjuntar archivos multimedia
✓ rechaza canales no autorizados al publicador
✓ permite seleccionar múltiples canales autorizados
✓ valida campos obligatorios
✓ rechaza medios que no pertenecen a los canales seleccionados
✓ requiere autenticación (listado)
✓ lista solo las publicaciones del usuario autenticado
✓ muestra el detalle de una publicación propia
✓ no permite ver publicaciones de otro usuario
```

Ejecutar tests:

```bash
php artisan test tests/Feature/PostTest.php
```

---

## Frontend — Pestaña Publicaciones

### Descripción general

Se integró una pestaña **Publicaciones** en el SPA existente, visible únicamente para usuarios con el permiso `editar-contenido` (rol `publicador`). La pestaña permite listar, crear y consultar publicaciones consumiendo los endpoints REST del backend.

### Funcionalidades implementadas

| Funcionalidad | Descripción |
|---------------|-------------|
| **Listado paginado** | Tabla desktop con columnas (ID, Título, Tipo, Estado, Canales, Fecha) + tarjetas móvil responsivas |
| **Estadísticas** | Grid de stats con contadores de Total, Borradores, Aprobadas y Programadas |
| **Crear publicación** | Modal con formulario completo: título, contenido, tipo, fecha programada, selección de canales autorizados, medios disponibles y carga de archivos |
| **Detalle de publicación** | Modal que muestra toda la información: contenido, badges de estado/tipo, canales, medios y archivos adjuntos |
| **Carga de archivos** | Zona de drag & drop con preview, validación de tamaño (máx. 10 MB) y cantidad (máx. 10), envío como `FormData` |
| **Canales dinámicos** | Se cargan automáticamente los canales asignados al publicador al abrir el formulario |
| **Medios por canal** | Al seleccionar canales, se cargan los medios disponibles de esos canales para selección opcional |
| **Paginación** | Componente de paginación con navegación por páginas y puntos suspensivos para rangos grandes |

### Estructura del módulo `posts.js`

```
posts.js
├── Constantes
│   ├── POST_STATUS_LABELS / POST_STATUS_COLORS
│   └── POST_TYPE_LABELS / POST_TYPE_ICONS
├── Helpers de renderizado
│   ├── renderPostStatusBadge(status)
│   ├── renderPostTypeBadge(type)
│   └── renderPostChannelTags(channels)
├── Carga y listado
│   ├── loadPosts(page)
│   ├── renderPostsTable(posts)
│   └── renderPostsPagination(data)
├── Detalle
│   └── viewPostDetail(postId)
├── Formulario de creación
│   ├── openPostFormModal()
│   ├── onPostChannelToggle(channelId)
│   └── submitPostForm()
│   └── renderChannelsWithMediaSlots(channels, container)
└── Manejo de archivos
    ├── setupPostFileUpload()
    ├── addPostFiles(fileList)
    ├── renderPostFilePreview()
    └── removePostFile(index)
```

### Flujo de visibilidad

```
Usuario se autentica
  → auth.js: updateAuthUI()
    → Verifica permissions.includes('editar-contenido')
      → Muestra/oculta elementos con clase .publisher-only
        → Enlace "Publicaciones" en navegación
```

### Flujo de creación de publicación

```
1. Click en "Nueva Publicación"
2. openPostFormModal() → carga canales autorizados del publicador
3. Usuario selecciona un canal → onPostChannelToggle(channelId) → carga medios de ese canal debajo
4. Usuario completa formulario y opcionalmente adjunta archivos
5. submitPostForm() → construye FormData → api.authUpload('/posts', formData)
6. Backend crea post en estado borrador → respuesta exitosa
7. Se cierra modal, se muestra toast y se recarga la lista
```
