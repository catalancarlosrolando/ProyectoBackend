<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\UserAdminController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\ChannelMediaController;
use App\Http\Controllers\Api\UserChannelController;
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

    // ── Notificaciones del usuario autenticado ──
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::patch('/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [NotificationController::class, 'markAllRead']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
    });
});






// Endpoint de prueba para archivos (sin autenticación para testing)
Route::post('/test-files', [FileController::class, 'upload']);
Route::get('/test-files', [FileController::class, 'index']);
Route::get('/test-files/download/{filename}', [FileController::class, 'download']);
Route::delete('/test-files/{filename}', [FileController::class, 'delete']);
