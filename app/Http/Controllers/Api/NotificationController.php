<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Listar las últimas 50 notificaciones del usuario autenticado.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->take(50)
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'type' => $n->data['type'] ?? 'general',
                'icon' => $n->data['icon'] ?? 'info',
                'title' => $n->data['title'] ?? 'Notificación',
                'message' => $n->data['message'] ?? '',
                'read_at' => $n->read_at,
                'created_at' => $n->created_at,
            ]);

        return response()->json([
            'status' => 'success',
            'data' => $notifications,
        ]);
    }

    /**
     * Obtener el conteo de notificaciones no leídas.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = $request->user()->unreadNotifications()->count();

        return response()->json([
            'status' => 'success',
            'data' => ['count' => $count],
        ]);
    }

    /**
     * Marcar una notificación como leída.
     */
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->where('id', $id)
            ->first();

        if (!$notification) {
            return response()->json([
                'status' => 'error',
                'message' => 'Notificación no encontrada.',
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'status' => 'success',
            'message' => 'Notificación marcada como leída.',
        ]);
    }

    /**
     * Marcar todas las notificaciones como leídas.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();
        //$request->user()->unreadNotifications()->update(['read_at' => now()]); --- IGNORE ---

        return response()->json([
            'status' => 'success',
            'message' => 'Todas las notificaciones marcadas como leídas.',
        ]);
    }

    /**
     * Eliminar una notificación.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $deleted = $request->user()
            ->notifications()
            ->where('id', $id)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'status' => 'error',
                'message' => 'Notificación no encontrada.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Notificación eliminada.',
        ]);
    }
}
