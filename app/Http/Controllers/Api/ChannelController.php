<?php

namespace App\Http\Controllers\Api;

use App\Models\Channel;
use App\Enums\ChannelType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreChannelRequest;
use App\Http\Requests\UpdateChannelRequest;
use Illuminate\Http\JsonResponse;

/**
 * Controlador para la gestión de canales temáticos de difusión.
 *
 * Funcionalidades:
 * - Listar todos los canales
 * - Crear un canal con nombre único, descripción, tipo y contexto semántico para IA
 * - Ver detalle de un canal (incluye medios asociados)
 * - Actualizar un canal
 * - Eliminar un canal
 */
class ChannelController extends Controller
{
    /**
     * GET /api/channels
     *
     * Listado de todos los canales con sus medios asociados.
     */
    public function index(): JsonResponse
    {
        $channels = Channel::with(['medias', 'lastModifiedBy:id,name,first_name,last_name'])->get();

        return response()->json([
            'status'  => 'success',
            'data'    => $channels,
            'message' => 'Listado de canales obtenido correctamente.',
        ]);
    }

    /**
     * POST /api/channels
     *
     * Crear un nuevo canal temático de difusión.
     * La validación de nombre único se realiza en StoreChannelRequest.
     */
    public function store(StoreChannelRequest $request): JsonResponse
    {
        $channel = Channel::create(array_merge($request->validated(), [
            'last_modified_by' => $request->user()->id,
            'last_modified_at' => now(),
        ]));

        $channel->load(['medias', 'lastModifiedBy:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $channel,
            'message' => 'Canal creado correctamente.',
        ], 201);
    }

    /**
     * GET /api/channels/{channel}
     *
     * Detalle de un canal con sus medios y usuarios asociados.
     */
    public function show(Channel $channel): JsonResponse
    {
        $channel->load(['medias', 'lastModifiedBy:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $channel,
            'message' => 'Detalle del canal obtenido correctamente.',
        ]);
    }

    /**
     * PUT /api/channels/{channel}
     *
     * Actualizar la información de un canal.
     */
    public function update(UpdateChannelRequest $request, Channel $channel): JsonResponse
    {
        $channel->update(array_merge($request->validated(), [
            'last_modified_by' => $request->user()->id,
            'last_modified_at' => now(),
        ]));

        $channel->load(['medias', 'lastModifiedBy:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $channel,
            'message' => 'Canal actualizado correctamente.',
        ]);
    }

    /**
     * DELETE /api/channels/{channel}
     *
     * Eliminar un canal.
     */
    public function destroy(Channel $channel): JsonResponse
    {
        $channel->delete();

        return response()->json([
            'status'  => 'success',
            'data'    => null,
            'message' => 'Canal eliminado correctamente.',
        ]);
    }

    /**
     * GET /api/channels/types
     *
     * Devuelve los tipos de canal disponibles.
     */
    public function types(): JsonResponse
    {
        $types = collect(ChannelType::cases())->map(fn($type) => [
            'value' => $type->value,
            'label' => $type->label(),
        ]);

        return response()->json([
            'status'  => 'success',
            'data'    => $types,
            'message' => 'Tipos de canal obtenidos correctamente.',
        ]);
    }
}
