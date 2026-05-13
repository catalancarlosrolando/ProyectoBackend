<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceAuthController;
use App\Http\Controllers\Api\DevicePostController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\UserAdminController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\ChannelMediaController;
use App\Http\Controllers\Api\UserChannelController;
use App\Http\Controllers\Api\UserDeviceController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\PostHistoryController;
use App\Http\Controllers\Api\PostModerationController;
use App\Http\Controllers\Api\SavedFilterController;
use App\Http\Controllers\Api\NotificationController;

Route::get('/ping', fn() => response()->json([
    'status' => 'success',
    'data' => ['ping' => 'ok'],
    'message' => 'API is running correctly'
]));

Route::get('/landing', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'Bienvenido a Difexa',
        'timestamp' => now()->toISOString(),
        'version' => '1.0.0'
    ]);
});

// Rutas sin autenticación

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/device/login', [DeviceAuthController::class, 'login']);

// Rutas para reset de contraseña
Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
Route::post('/password/reset', [AuthController::class, 'resetPassword']);

// Ruta para verificar email (no requiere autenticación)
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');


Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Reenviar email de verificación
    Route::post('/email/resend', [AuthController::class, 'resendVerificationEmail']);

    // Ejemplo de ruta con permiso específico
    Route::get('/admin/dashboard', function () {
        return response()->json([
            'status' => 'success',
            'message' => 'Bienvenido al panel de administración',
            'data' => [
                'stats' => [
                    'users' => 150,
                    'posts' => 320,
                    'comments' => 1240,
                ]
            ]
        ]);
    })->middleware('permission:acceder-panel-admin');

    // Ejemplo de ruta para usuarios autenticados
    Route::get('/user/profile', function () {
        return response()->json([
            'status' => 'success',
            'message' => 'Perfil de usuario',
            'data' => [
                'profile' => [
                    'bio' => 'Usuario activo del sistema',
                    'posts_count' => 15,
                    'followers' => 42,
                ]
            ]
        ]);
    });

    // ── Gestión de usuarios (Admin) ──
    Route::prefix('admin/users')->middleware('permission:gestionar-usuarios')->group(function () {
        Route::get('/', [UserAdminController::class, 'index']);
        Route::get('/{user}', [UserAdminController::class, 'show']);
        Route::post('/{user}/approve', [UserAdminController::class, 'approve']);
        Route::post('/{user}/reject', [UserAdminController::class, 'reject']);
        Route::post('/{user}/enable', [UserAdminController::class, 'enable']);
        Route::post('/{user}/disable', [UserAdminController::class, 'disable']);
        Route::post('/{user}/assign-role', [UserAdminController::class, 'assignRole']);
        Route::post('/{user}/revoke-role', [UserAdminController::class, 'revokeRole']);
        Route::get('/{user}/history', [UserAdminController::class, 'history']);
    });

    Route::prefix('admin/channels')->middleware('permission:gestionar-canales')->group(function () {

        // ── Canales temáticos de difusión ──
        Route::get('/types', [ChannelController::class, 'types']);

        // ── Medios de publicación ──
        Route::get('/media-types', [ChannelMediaController::class, 'mediaTypes']);
        Route::get('/medias', [ChannelMediaController::class, 'indexMedias']);

        // ── Asociación canal ↔ medios (channel_medias) ──
        Route::get('/{channel}/medias', [ChannelMediaController::class, 'index']);
        Route::post('/{channel}/medias', [ChannelMediaController::class, 'store']);
        Route::delete('/{channel}/medias', [ChannelMediaController::class, 'destroy']);

        Route::apiResource('/', ChannelController::class)->parameters(['' => 'channel']);

        // ── Si no quiero usar apiResource
        //Route::get('/', [ChannelMediaController::class, 'index']);
        //Route::post('/', [ChannelMediaController::class, 'store']);
    });

    // ── Asignación de canales a publicadores ──
    Route::prefix('admin/user-channels')->middleware('permission:gestionar-canales')->group(function () {
        Route::get('/publishers', [UserChannelController::class, 'publishers']);
        Route::get('/{user}', [UserChannelController::class, 'show']);
        Route::post('/{user}', [UserChannelController::class, 'store']);
        Route::delete('/{user}', [UserChannelController::class, 'destroy']);
    });

    // ── Asignación de dispositivo cliente ──
    Route::prefix('admin/user-devices')->middleware('permission:gestionar-usuarios')->group(function () {
        Route::get('/', [UserDeviceController::class, 'index']);
        Route::get('/{user}', [UserDeviceController::class, 'show']);
        Route::post('/{user}', [UserDeviceController::class, 'store']);
        Route::delete('/{user}', [UserDeviceController::class, 'destroy']);
    });

    // ── Gestión de publicaciones (Publicador) ──
    Route::prefix('posts')->middleware('permission:editar-contenido')->group(function () {
        // Filtros guardados (debe ir ANTES de {post} para evitar conflicto de ruta)
        Route::get('/saved-filters', [SavedFilterController::class, 'index']);
        Route::post('/saved-filters', [SavedFilterController::class, 'store']);
        Route::delete('/saved-filters/{filter}', [SavedFilterController::class, 'destroy']);

        // CRUD de publicaciones
        Route::get('/', [PostController::class, 'index']);        // H09 + H11b: listado con búsqueda y filtrado
        Route::post('/', [PostController::class, 'store']);       // H09: crear publicación
        Route::get('/{post}', [PostController::class, 'show']);   // H09: detalle
        Route::put('/{post}', [PostController::class, 'update']); // H10: editar publicación
        Route::delete('/{post}', [PostController::class, 'destroy']); // H11: eliminar publicación

        // Acciones de estado
        Route::post('/{post}/submit', [PostController::class, 'submitForReview']);   // H13: enviar a moderación
        Route::post('/{post}/revert-to-draft', [PostController::class, 'revertToDraft']); // H10: revertir a borrador
        Route::post('/{post}/archive', [PostController::class, 'archive']);          // H12: archivar
        Route::post('/{post}/unarchive', [PostController::class, 'unarchive']);      // H12: desarchivar

        // Historial de cambios
        Route::get('/{post}/history', [PostHistoryController::class, 'index']);          // H10: ver historial
        Route::get('/{post}/history/compare', [PostHistoryController::class, 'compare']); // H10: comparar versiones
        Route::get('/{post}/history/export', [PostHistoryController::class, 'export']);   // H10: exportar historial
        Route::post('/{post}/history/{history}/restore', [PostHistoryController::class, 'restore']); // H10: restaurar versión

        // Rutas auxiliares reutilizadas
        Route::get('/channels/{user}', [UserChannelController::class, 'show']);
        Route::get('/{channel}/medias', [ChannelMediaController::class, 'index']);
    });

    // ── Moderación de publicaciones (Moderador/Admin) ──
    Route::prefix('moderation/posts')->middleware('auth:sanctum')->group(function () {
        Route::get('/', [PostModerationController::class, 'pending']);           // H13: listar pendientes
        Route::get('/{post}', [PostModerationController::class, 'show']);        // H13: ver detalle para revisión
        Route::post('/{post}/approve', [PostModerationController::class, 'approve']); // H13: aprobar
        Route::post('/{post}/reject', [PostModerationController::class, 'reject']);   // H13: rechazar
        Route::post('/{post}/stop', [PostModerationController::class, 'stop']);       // H14: detener difusión
    });

    // ── Notificaciones del usuario autenticado ──
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::patch('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [NotificationController::class, 'markAllRead']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
    });

    // ── Dispositivo cliente ──
    Route::prefix('device')->group(function () {
        Route::get('/posts', [DevicePostController::class, 'index']);
        Route::get('/posts/{post}', [DevicePostController::class, 'show']);
        Route::get('/posts/{postid}', [DevicePostController::class, 'showById']);
    });
});






// Endpoint de prueba para archivos (sin autenticación para testing)
Route::post('/test-files', [FileController::class, 'upload']);
Route::get('/test-files', [FileController::class, 'index']);
Route::get('/test-files/download/{filename}', [FileController::class, 'download']);
Route::delete('/test-files/{filename}', [FileController::class, 'delete']);
