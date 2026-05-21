<?php

namespace App\Http\Controllers\Api;

use App\Enums\PostStatus;
use App\Models\Device;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class DevicePostController extends Controller
{
    /**
     * GET /api/device/posts
     *
    * Lista publicaciones published asociadas a canales del dispositivo.
     */
    public function index(Request $request): JsonResponse
    {
        $device = $request->user();

        if (!$device instanceof Device) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'Token de dispositivo invalido.',
            ], 403);
        }

        $channelIds = $device->channels()->pluck('channels.id')->toArray();

        if (empty($channelIds)) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'data' => [],
                    'total' => 0,
                ],
                'total' => 0,
                'message' => 'No hay canales asignados al dispositivo.',
            ]);
        }

        $query = Post::query()
            ->where('status', PostStatus::PUBLISHED->value)
            ->whereHas('channels', fn($c) => $c->whereIn('channels.id', $channelIds))
            ->orderByDesc('published_at');

        $perPage = (int) $request->input('per_page', 20);
        $posts = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $posts,
            'total' => $posts->total(),
            'message' => 'Listado de publicaciones publicadas.',
        ]);
    }

    /**
     * GET /api/device/posts/{post}
     *
    * Muestra el detalle de una publicacion publicada asociada a canales del dispositivo.
     */
    public function show(Request $request, Post $post): JsonResponse
    {
        $device = $request->user();

        if (!$device instanceof Device) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'Token de dispositivo invalido.',
            ], 403);
        }

        $channelIds = $device->channels()->pluck('channels.id')->toArray();
        $hasChannel = empty($channelIds)
            ? false
            : $post->channels()->whereIn('channels.id', $channelIds)->exists();

        if (!$hasChannel || $post->status !== PostStatus::PUBLISHED) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'No tiene acceso a esta publicacion.',
            ], 403);
        }

        $post->load('attachments');

        return response()->json([
            'status' => 'success',
            'data' => $post,
            'message' => 'Detalle de publicacion.',
        ]);
    }

    //get /api/device/posts/{postid} - muestra el achivo adjunto a la publicacion
    public function showById(Request $request, int $postid): JsonResponse
    {
        $device = $request->user();

        if (!$device instanceof Device) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'Token de dispositivo invalido.',
            ], 403);
        }

        $channelIds = $device->channels()->pluck('channels.id')->toArray();

        if (empty($channelIds)) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'No tiene canales asignados.',
            ], 403);
        }

        $post = Post::where('id', $postid)
            ->where('status', PostStatus::PUBLISHED->value)
            ->whereHas('channels', fn($c) => $c->whereIn('channels.id', $channelIds))
            ->first();

        if (!$post) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'Publicacion no encontrada o no tiene acceso.',
            ], 404);
        }

        $post->load('attachments');

        return response()->json([
            'status' => 'success',
            'data' => $post,
            'message' => 'Detalle de publicacion por ID.',
        ]);
    }
}
