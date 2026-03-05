<?php

namespace App\Http\Controllers\Api;

use App\Models\Media;
use App\Models\Channel;
use App\Enums\MediaType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreChannelMediaRequest;
use Illuminate\Http\JsonResponse;

/**
 * Controlador para gestionar la relación entre canales y medios de publicación.
 *
 * Funcionalidades:
 * - Listar todos los medios disponibles (con filtro por tipo y nombre)
 * - Asociar medios a un canal (channel_medias)
 * - Ver los medios de un canal específico
 * - Desasociar medios de un canal
 */
class ChannelMediaController extends Controller
{
    /**
     * GET /api/media-types
     *
     * Devuelve los tipos de medio disponibles (enum) con su etiqueta.
     */
    public function mediaTypes(): JsonResponse
    {
        $types = collect(MediaType::cases())->map(fn($type) => [
            'value' => $type->value,
            'label' => $type->label(),
        ]);

        return response()->json([
            'status'  => 'success',
            'data'    => $types,
            'message' => 'Tipos de medio obtenidos correctamente.',
        ]);
    }

    /**
     * GET /api/medias
     *
     * Listado de todos los medios de publicación disponibles.
     * Soporta filtros opcionales: ?type=social_media&name=instagram
     */
    public function indexMedias(): JsonResponse
    {
        $query = Media::query();

        if (request()->filled('type')) {
            $query->where('type', request('type'));
        }

        if (request()->filled('name')) {
            $query->where('name', 'like', '%' . request('name') . '%');
        }

        $medias = $query->get();

        return response()->json([
            'status'  => 'success',
            'data'    => $medias,
            'message' => 'Listado de medios obtenido correctamente.',
        ]);
    }

    /**
     * GET /api/channels/{channel}/medias
     *
     * Devuelve los medios asociados a un canal específico.
     */
    public function index(Channel $channel): JsonResponse
    {
        $medias = $channel->medias;

        return response()->json([
            'status'  => 'success',
            'data'    => $medias,
            'message' => 'Medios del canal obtenidos correctamente.',
        ]);
    }

    /**
     * POST /api/channels/{channel}/medias
     *
     * Asociar uno o varios medios a un canal.
     * Utiliza syncWithoutDetaching para no duplicar relaciones existentes.
     */
    public function store(StoreChannelMediaRequest $request, Channel $channel): JsonResponse
    {
        $channel->medias()->syncWithoutDetaching($request->validated()['media_ids']);

        $channel->update([
            'last_modified_by' => $request->user()->id,
            'last_modified_at' => now(),
        ]);

        $channel->load(['medias', 'lastModifiedBy:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $channel,
            'message' => 'Medios asociados al canal correctamente.',
        ], 201);
    }

    /**
     * DELETE /api/channels/{channel}/medias
     *
     * Desasociar medios de un canal.
     * Espera: { "media_ids": [1, 2, 3] }
     */
    public function destroy(StoreChannelMediaRequest $request, Channel $channel): JsonResponse
    {
        $channel->medias()->detach($request->validated()['media_ids']);

        $channel->update([
            'last_modified_by' => $request->user()->id,
            'last_modified_at' => now(),
        ]);

        $channel->load(['medias', 'lastModifiedBy:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $channel,
            'message' => 'Medios desasociados del canal correctamente.',
        ]);
    }
}
