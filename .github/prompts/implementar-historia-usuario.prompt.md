---
description: "Implementar una historia de usuario como endpoint API REST en Laravel, generando Controller, FormRequest, rutas y tests siguiendo las convenciones del proyecto Difexa."
agent: "agent"
argument-hint: "Pega la historia de usuario con sus criterios de aceptación"
---

# Implementar Historia de Usuario — API REST Laravel

Implementa la siguiente historia de usuario como un endpoint (o conjunto de endpoints) API REST en este proyecto Laravel.

## Historia de usuario

${input}

## Convenciones del proyecto

Sigue estrictamente las convenciones ya establecidas en el código fuente:

### Estructura de archivos

- **Controller**: `app/Http/Controllers/Api/<Nombre>Controller.php`
- **FormRequest**: `app/Http/Requests/Store<Nombre>Request.php`, `Update<Nombre>Request.php`
- **Model**: `app/Models/<Nombre>.php` (solo si no existe)
- **Enum**: `app/Enums/<Nombre>.php` (solo si se necesitan nuevos valores)
- **Rutas**: registrar en `routes/api.php` dentro del grupo `auth:sanctum`
- **Tests**: `tests/Feature/<Nombre>Test.php`

### Formato de respuesta JSON

Todas las respuestas deben usar este formato consistente:

```php
return response()->json([
    'status'  => 'success', // o 'error'
    'data'    => $datos,
    'message' => 'Mensaje descriptivo en español.',
], $httpStatusCode);
```

### Validación

- Usar **FormRequest** dedicados (no validar en el controlador).
- `authorize()` retorna `true` (la autorización se maneja vía middleware).
- Mensajes de error personalizados en **español** en el método `messages()`.

### Autorización

- Usar middleware `auth:sanctum` para autenticación.
- Usar middleware `permission:<nombre-permiso>` de **Spatie Laravel-Permission** para permisos.
- Verificar que el usuario tiene acceso solo a los recursos que le corresponden (ej: canales autorizados).

### Modelo y relaciones

- Usar casts de Eloquent para enums y fechas.
- Cargar relaciones con `->load()` o `->with()` según corresponda.
- Usar `$fillable` para mass-assignment.

### Enums

- Los enums existentes siguen este patrón con métodos `values()` y `label()`:

```php
enum NombreEnum: string
{
    case CASO = 'valor';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::CASO => 'Etiqueta en español',
        };
    }
}
```

### Rutas

- Agrupar bajo prefijo con middleware de permisos.
- Usar `apiResource` cuando sea CRUD completo.
- Documentar cada endpoint con comentarios.

## Instrucciones de implementación

1. **Analiza** la historia y sus criterios de aceptación.
2. **Identifica** qué modelos, relaciones, enums y tablas ya existen revisando `app/Models/`, `app/Enums/` y `database/migrations/`.
3. **Crea o modifica** solo los archivos necesarios:
   - Controller con los métodos requeridos.
   - FormRequest para validar las entradas.
   - Rutas en `routes/api.php`.
   - Migración solo si se necesitan cambios en la base de datos.
4. **No modifiques** archivos existentes que no sean estrictamente necesarios.
5. **Genera un test Feature** con Pest que cubra el flujo principal y los criterios de aceptación.
6. **Resume** al final qué archivos creaste/modificaste y qué endpoints están disponibles.

## Uso de skills recomendados

Para mantener consistencia, usa los siguientes skills del repositorio segun la tarea:

1. Analisis y plan de endpoint:
    - `.github/skills/routes/SKILL.md`
2. Validacion de entradas:
    - `.github/skills/form-requests/SKILL.md`
3. Logica de negocio en API:
    - `.github/skills/controllers/SKILL.md`
4. Dominio y persistencia:
    - `.github/skills/models/SKILL.md`
5. Estados y tipos cerrados:
    - `.github/skills/enums/SKILL.md`
6. Cambios de esquema/datos base:
    - `.github/skills/migrations-seeders/SKILL.md`
7. Cobertura automatizada:
    - `.github/skills/testing/SKILL.md`
8. Si la historia toca interfaz:
    - `.github/skills/frontend-pattern/SKILL.md`

## Orden sugerido por historia

1. Rutas y contrato de endpoint.
2. FormRequest y validaciones.
3. Controller y autorizacion.
4. Modelo/Enum (si aplica).
5. Migracion/Seeder (si aplica).
6. Tests feature.
7. Frontend (solo si el criterio lo exige).
