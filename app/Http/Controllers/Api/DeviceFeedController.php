<?php

namespace App\Http\Controllers\Api;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controlador para el consumo de contenido por dispositivo via polling.
 */
class DeviceFeedController extends Controller
{
    /**
     * GET /api/device/feed/{uid}
     *
     * Obtiene publicaciones publicadas para los canales asignados al dispositivo.
     */
    public function feed(Request $request, string $uid): JsonResponse
    {
        $device = Device::where('uid', $uid)->where('is_active', true)->first();

        if (!$device) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'Dispositivo no autorizado.',
            ], 403);
        }

        $channelIds = $device->channels()->pluck('channels.id')->toArray();

        if (empty($channelIds)) {
            $device->update(['last_sync_at' => now()]);

            return response()->json([
                'status' => 'success',
                'data' => [],
                'message' => 'No hay canales asignados al dispositivo.',
            ]);
        }

        $posts = Post::query()
            ->where('status', PostStatus::PUBLISHED->value)
            ->whereHas('channels', fn($query) => $query->whereIn('channels.id', $channelIds))
            ->with(['channels:id,name,type', 'attachments'])
            ->orderByDesc('published_at')
            ->get();

        $device->update(['last_sync_at' => now()]);

        return response()->json([
            'status' => 'success',
            'data' => $posts,
            'message' => 'Contenido sincronizado correctamente.',
        ]);
    }
}
