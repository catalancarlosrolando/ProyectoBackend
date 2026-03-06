# Canales Temáticos de Difusión — Implementación Completa

## Descripción

Sistema de gestión de **canales temáticos de difusión** que permite a los administradores crear, editar y eliminar canales categorizados, asociar medios de publicación (pantallas, redes sociales, plataformas editoriales) y configurar contextos semánticos para guiar la generación de contenido por IA.

---

## Criterios de Aceptación

| Criterio | Estado |
|---|:---:|
| Nombre del canal único | ✅ |
| Descripción del canal | ✅ |
| Asociar múltiples medios de publicación al canal | ✅ |
| Endpoint GET para recuperar media types y medios | ✅ |
| Endpoint POST para agregar medios a `channel_medias` | ✅ |
| Texto contextual para guiar al modelo de IA | ✅ |
| Validación de nombre único | ✅ |
| Canal disponible inmediatamente tras su creación | ✅ |
| Registrar quién realizó la última modificación y cuándo | ✅ |

---

## Arquitectura de Archivos

```
app/
├── Enums/
│   ├── ChannelType.php          # Enum: departamento, instituto, secretaría, centro
│   └── MediaType.php            # Enum: physical_screen, social_media, editorial_platform
├── Models/
│   ├── Channel.php              # Modelo con relaciones: users, posts, medias, lastModifiedBy
│   └── Media.php                # Modelo con relaciones: posts, channels
├── Http/
│   ├── Controllers/Api/
│   │   ├── ChannelController.php      # CRUD de canales
│   │   └── ChannelMediaController.php # Gestión medios + asociación canal↔medios
│   └── Requests/
│       ├── StoreChannelRequest.php       # Validación crear canal (name unique)
│       ├── UpdateChannelRequest.php      # Validación actualizar canal
│       └── StoreChannelMediaRequest.php  # Validación asociar medios
database/
├── migrations/
│   ├── 2025_10_15_200149_create_channels_table.php
│   ├── 2025_10_15_200638_create_medias_table.php
│   ├── 2025_10_15_223708_create_channel_medias_table.php
│   ├── 2026_03_05_000001_add_unique_to_channels_name.php  # Constraint UNIQUE
│   └── 2026_03_05_000002_add_last_modified_to_channels_table.php  # Tracking modificaciones
routes/
└── api.php                      # Rutas registradas bajo auth:sanctum
public/
└── frontend/
    └── js/
        └── channels.js          # Frontend para gestión de canales
```

---

## Endpoints API

Todos los endpoints requieren autenticación (`auth:sanctum`).

### Canales

| Método | Ruta | Descripción | Body |
|--------|------|-------------|------|
| `GET` | `/api/admin/channels` | Listar todos los canales con sus medios | — |
| `POST` | `/api/admin/channels` | Crear un nuevo canal | `{ name, description, type, semantic_context }` |
| `GET` | `/api/admin/channels/{id}` | Detalle de un canal | — |
| `PUT` | `/api/admin/channels/{id}` | Actualizar un canal | `{ name?, description?, type?, semantic_context? }` |
| `DELETE` | `/api/admin/channels/{id}` | Eliminar un canal | — |
| `GET` | `/api/admin/channels/types` | Listar tipos de canal disponibles | — |

### Medios

| Método | Ruta | Descripción | Params/Body |
|--------|------|-------------|-------------|
| `GET` | `/api/admin/channels/media-types` | Listar tipos de medio (enum) | — |
| `GET` | `/api/admin/channels/medias` | Listar medios disponibles | `?type=social_media&name=instagram` |

### Asociación Canal ↔ Medios

| Método | Ruta | Descripción | Body |
|--------|------|-------------|------|
| `GET` | `/api/admin/channels/{id}/medias` | Medios asociados a un canal | — |
| `POST` | `/api/admin/channels/{id}/medias` | Asociar medios al canal | `{ "media_ids": [1, 2, 3] }` |
| `DELETE` | `/api/admin/channels/{id}/medias` | Desasociar medios del canal | `{ "media_ids": [1, 2] }` |

---

## Modelo de Datos

### Tabla `channels`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint (PK) | Identificador único |
| `name` | string (UNIQUE) | Nombre del canal |
| `description` | text (nullable) | Descripción del canal |
| `type` | enum | Tipo: departamento, instituto, secretaría, centro |
| `semantic_context` | text (nullable) | Contexto semántico para guiar a la IA |
| `last_modified_by` | FK → users (nullable) | Usuario que realizó la última modificación |
| `last_modified_at` | timestamp (nullable) | Fecha/hora de la última modificación |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Fecha de actualización |

### Tabla `medias`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | bigint (PK) | Identificador único |
| `name` | string | Nombre del medio |
| `type` | enum | physical_screen, social_media, editorial_platform |
| `configuration` | json (nullable) | Configuración específica |
| `semantic_context` | text (nullable) | Contexto semántico para IA |
| `url_webhook` | string (nullable) | URL webhook |
| `is_active` | boolean | Medio activo/inactivo |

### Tabla Pivote `channel_medias`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `channel_id` | FK → channels | Canal |
| `media_id` | FK → medias | Medio |
| PK compuesta | (channel_id, media_id) | — |

---

## Validaciones

### Crear Canal (`StoreChannelRequest`)

| Campo | Reglas |
|-------|--------|
| `name` | required, string, max:255, **unique:channels** |
| `description` | nullable, string, max:1000 |
| `type` | required, in: departamento, instituto, secretaría, centro |
| `semantic_context` | nullable, string, max:2000 |

### Actualizar Canal (`UpdateChannelRequest`)

| Campo | Reglas |
|-------|--------|
| `name` | sometimes, required, string, max:255, unique (ignora el registro actual) |
| `description` | nullable, string, max:1000 |
| `type` | sometimes, required, in: tipos válidos |
| `semantic_context` | nullable, string, max:2000 |

### Asociar Medios (`StoreChannelMediaRequest`)

| Campo | Reglas |
|-------|--------|
| `media_ids` | required, array, min:1 |
| `media_ids.*` | required, integer, exists:medias,id |

---

## Ejemplos de Uso (cURL)

### Crear canal

```bash
curl -X POST /api/channels \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Canal Deportes",
    "description": "Canal dedicado a contenido deportivo",
    "type": "departamento",
    "semantic_context": "Genera contenido sobre eventos deportivos universitarios"
  }'
```

### Asociar medios al canal

```bash
curl -X POST /api/admin/channels/1/medias \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{ "media_ids": [1, 5, 9] }'
```

### Filtrar medios por tipo

```bash
curl "/api/medias?type=social_media&name=instagram" \
  -H "Authorization: Bearer {token}"
```

---

## Respuestas API

Todas las respuestas siguen el formato estándar:

```json
{
  "status": "success",
  "data": { ... },
  "message": "Descripción de la operación."
}
```

### Error de validación (422)

```json
{
  "message": "Ya existe un canal con ese nombre.",
  "errors": {
    "name": ["Ya existe un canal con ese nombre."]
  }
}
```

---

## Frontend — Implementación

El frontend sigue el patrón de diseño de **Gestión de Usuarios** (`admin-users.js`), utilizando Vanilla JS sin frameworks, navegación por secciones y componentes reutilizables del sistema de diseño existente.

### Archivos Creados / Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `public/frontend/js/channels.js` | **Creado** | Módulo completo de gestión de canales (467 líneas) |
| `public/frontend/index.html` | Modificado | Sección HTML, modales, enlace de navegación, script tag |
| `public/frontend/js/core.js` | Modificado | Estado global `state.channels` |
| `public/frontend/js/ui.js` | Modificado | Carga automática al navegar a la sección |
| `public/frontend/js/app.js` | Modificado | Event listeners para botones de canales |
| `public/frontend/css/styles.css` | Modificado | Estilos `ch-*` para componentes de canales |

### Arquitectura Frontend

```
public/frontend/
├── index.html              # Sección #sectionChannels + modales
├── js/
│   ├── channels.js         # Módulo principal (CRUD + medios)
│   ├── core.js             # state.channels {selectedChannelId, editingChannelId, mediaAssignChannelId}
│   ├── ui.js               # navigateTo → loadChannels()
│   └── app.js              # Event listeners (btnCreateChannel, btnRefreshChannels, etc.)
└── css/
    └── styles.css           # Clases ch-col--, ch-cell--, ch-media-*, ch-detail-*, ch-context-text
```

### Funciones Principales (`channels.js`)

| Función | Descripción |
|---------|-------------|
| `loadChannels()` | Carga y renderiza la lista de canales desde la API |
| `renderChannelsTable(channels)` | Genera tabla desktop + cards mobile con badges de tipo y medios |
| `viewChannelDetail(channelId)` | Muestra el panel de detalle con info, medios y acciones rápidas |
| `openCreateChannelModal()` | Abre modal de creación con selector de tipos dinámico |
| `openEditChannelModal(channelId)` | Abre modal de edición pre-poblado con datos del canal |
| `submitChannelForm()` | Envía POST/PUT según sea creación o edición |
| `confirmDeleteChannel(id, name)` | Confirmación y eliminación del canal |
| `openMediaAssignModal(channelId)` | Modal con checkboxes agrupados por tipo de medio |
| `submitMediaAssign()` | Sincroniza medios: asocia nuevos y desasocia removidos |

### Helpers Visuales

| Función | Descripción |
|---------|-------------|
| `renderChannelTypeBadge(type)` | Badge con icono Material y color por tipo de canal |
| `renderMediaTypeBadge(type, label)` | Badge con icono para tipo de medio |
| `renderChannelMediasList(medias)` | Lista de tags de medios asociados |
| `truncateText(text, max)` | Trunca texto largo con ellipsis |
| `renderLastModifiedInfo(channel)` | Muestra usuario y fecha de última modificación |

### Componentes UI (HTML)

#### Sección Principal (`#sectionChannels`)

- **Header**: Título, subtítulo y botón "Nuevo Canal"
- **Tabla/Cards**: Lista de canales con columnas ID, Nombre, Tipo, Descripción, Medios, Acciones
- **Vista responsive**: Tabla en desktop (`au-desktop-table`), cards en mobile (`au-mobile-cards`)
- **Estados**: Loading spinner, estado vacío con CTA, tabla con datos
- **Panel de Detalle** (`#channelDetailCard`): Nombre, tipo, descripción, contexto IA, fechas, medios asociados y acciones rápidas (editar, asignar medios, eliminar)

#### Modal de Canal (`#channelFormModal`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Nombre | `input text` | Nombre único del canal |
| Tipo | `select` | Opciones cargadas dinámicamente desde `/api/channels/types` |
| Descripción | `textarea` | Descripción del canal (opcional) |
| Contexto IA | `textarea` | Texto semántico para guiar generación de contenido |

#### Modal de Medios (`#mediaAssignModal`)

- Carga todos los medios disponibles desde `/api/medias`
- Agrupa medios por tipo (Pantalla Física, Red Social, Plataforma Editorial)
- Checkboxes con los medios actualmente asociados pre-seleccionados
- Sincronización inteligente: compara selección actual vs. anterior para asociar/desasociar

### Paleta de Colores por Tipo

#### Tipos de Canal

| Tipo | Color Fondo | Color Texto | Icono |
|------|-------------|-------------|-------|
| Departamento | `#D4E9FF` | `#0D47A1` | `apartment` |
| Instituto | `#E8F5E9` | `#1B5E20` | `school` |
| Secretaría | `#FFF3E0` | `#E65100` | `admin_panel_settings` |
| Centro | `#F3E5F5` | `#6A1B9A` | `hub` |

#### Tipos de Medio

| Tipo | Color Fondo | Color Texto | Icono |
|------|-------------|-------------|-------|
| physical_screen | `#E1F5FE` | `#0277BD` | `tv` |
| social_media | `#FCE4EC` | `#C62828` | `share` |
| editorial_platform | `#F3E5F5` | `#6A1B9A` | `article` |

### Estado Global (`core.js`)

```javascript
state.channels = {
    selectedChannelId: null,     // Canal seleccionado en detalle
    editingChannelId: null,      // Canal en edición (null = creación)
    mediaAssignChannelId: null   // Canal para asignar medios
};
```

### Event Listeners (`app.js`)

```javascript
btnCreateChannel       → openCreateChannelModal()
btnRefreshChannels     → loadChannels()
btnCloseChannelDetail  → oculta panel de detalle
btnChannelFormSubmit   → submitChannelForm()
btnMediaAssignSubmit   → submitMediaAssign()
```

### Navegación (`ui.js`)

Al navegar a la sección `channels`, se invoca automáticamente `loadChannels()` para cargar los datos frescos desde la API.

### Clases CSS Específicas (`styles.css`)

| Clase | Uso |
|-------|-----|
| `ch-col--name/type/desc/medias` | Anchos de columnas de la tabla |
| `ch-cell--name/type/desc/medias` | Celdas con estilos específicos |
| `ch-media-tag` | Badge inline para cada medio asociado |
| `ch-context-text` | Texto del contexto semántico (itálica, monospace) |
| `ch-detail-medias-list` | Lista de medios en la vista de detalle |
| `ch-detail-media-item` | Item individual de medio con icono y estado |
| `ch-media-group` | Agrupación de medios por tipo en el modal |
| `ch-media-group-title` | Título de grupo con icono Material |
| `ch-media-checkbox` | Checkbox estilizado para selección de medios |

### Flujo de Uso

1. **Navegar** → Sidebar → "Canales" (solo admin)
2. **Listar** → Se carga tabla con canales existentes y sus medios asociados
3. **Crear** → Botón "Nuevo Canal" → Modal con formulario → Validación → Canal creado
4. **Ver detalle** → Click en fila → Panel inferior con toda la información
5. **Editar** → Acción "Editar" → Modal pre-poblado → Guardar cambios
6. **Asignar medios** → Acción "Asignar Medios" → Modal con checkboxes agrupados → Sincronizar
7. **Eliminar** → Acción "Eliminar" → Confirmación → Canal eliminado

### Notificaciones

Todas las operaciones muestran **toasts** de éxito o error mediante `showToast()`:

- ✅ `Canal creado correctamente`
- ✅ `Canal actualizado correctamente`
- ✅ `Medios actualizados correctamente`
- ✅ `Canal eliminado correctamente`
- ❌ `Error al crear canal` (con detalle de validación)
