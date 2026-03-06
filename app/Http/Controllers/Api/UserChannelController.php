<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Channel;
use App\Http\Controllers\Controller;
use App\Http\Requests\SyncUserChannelsRequest;
use App\Notifications\ChannelAssignedNotification;
use App\Notifications\ChannelRevokedNotification;
use Illuminate\Http\JsonResponse;
use Symfony\Component\Console\Input\Input;

/**
 * Controlador para gestionar la asignación de canales a usuarios publicadores.
 *
 * Funcionalidades:
 * - Listar usuarios con rol publicador (con sus canales asignados)
 * - Ver los canales asignados a un publicador específico
 * - Asignar canales a un publicador (POST)
 * - Revocar canales de un publicador (DELETE)
 */
class UserChannelController extends Controller
{
    /**
     * GET /api/admin/user-channels/publishers
     *
     * Listar todos los usuarios con rol "publicador" junto con sus canales asignados.
     */
    public function publishers(): JsonResponse
    {
        $publishers = User::role('publicador')
            ->with('channels:id,name,type')
            ->select(['id', 'name', 'first_name', 'last_name', 'email', 'status'])
            ->paginate(7);

        return response()->json([
            'status'  => 'success',
            'data'    => $publishers,
            'message' => 'Listado de publicadores obtenido correctamente.',
        ]);
    }


    /**
     * GET /api/admin/user-channels/{user}
     *
     * Canales asignados a un publicador específico.
     */
    public function show(User $user): JsonResponse
    {
        $channels = $user->channels()->get(['channels.id', 'channels.name', 'channels.type']);

        return response()->json([
            'status'  => 'success',
            'data'    => [
                'user'     => $user->only('id', 'name', 'first_name', 'last_name', 'email'),
                'channels' => $channels,
            ],
            'message' => 'Canales del publicador obtenidos correctamente.',
        ]);
    }

    /**
     * POST /api/admin/user-channels/{user}
     *
     * Asignar canales a un publicador.
     * Usa syncWithoutDetaching para agregar sin perder los existentes.
     * Envía notificación al publicador con los canales nuevos asignados.
     */
    public function store(SyncUserChannelsRequest $request, User $user): JsonResponse
    {
        $channelIds = $request->validated()['channel_ids'];
        $admin = $request->user();

        // Obtener IDs actuales para calcular los nuevos
        $currentIds = $user->channels()->pluck('channels.id')->toArray();
        $newIds = array_values(array_diff($channelIds, $currentIds));

        if (empty($newIds)) {
            return response()->json([
                'status'  => 'info',
                'data'    => null,
                'message' => 'Todos los canales seleccionados ya estaban asignados.',
            ]);
        }

        // Preparar datos del pivot con aprobación automática
        $pivotData = [];
        foreach ($newIds as $id) {
            $pivotData[$id] = [
                'is_approved'  => true,
                'approved_at'  => now(),
                'approved_by'  => $admin->id,
            ];
        }

        $user->channels()->syncWithoutDetaching($pivotData);

        // Notificar al publicador
        $channelNames = Channel::whereIn('id', $newIds)->pluck('name')->toArray();
        $adminName = $admin->first_name
            ? "{$admin->first_name} {$admin->last_name}"
            : $admin->name;

        $user->notify(new ChannelAssignedNotification($channelNames, $adminName));

        return response()->json([
            'status'  => 'success',
            'data'    => [
                'assigned_channels' => $channelNames,
                'total_channels'    => $user->channels()->count(),
            ],
            'message' => 'Canales asignados correctamente. Se notificó al publicador.',
        ]);
    }

    /**
     * DELETE /api/admin/user-channels/{user}
     *
     * Revocar canales de un publicador.
     * Envía notificación al publicador con los canales revocados.
     */
    public function destroy(SyncUserChannelsRequest $request, User $user): JsonResponse
    {
        $channelIds = $request->validated()['channel_ids'];
        $admin = $request->user();

        // Verificar cuáles están realmente asignados
        $currentIds = $user->channels()->pluck('channels.id')->toArray();
        $toRevoke = array_values(array_intersect($channelIds, $currentIds));

        if (empty($toRevoke)) {
            return response()->json([
                'status'  => 'info',
                'data'    => null,
                'message' => 'Ninguno de los canales seleccionados estaba asignado.',
            ]);
        }

        $channelNames = Channel::whereIn('id', $toRevoke)->pluck('name')->toArray();

        $user->channels()->detach($toRevoke);

        // Notificar al publicador
        $adminName = $admin->first_name
            ? "{$admin->first_name} {$admin->last_name}"
            : $admin->name;

        $user->notify(new ChannelRevokedNotification($channelNames, $adminName));

        return response()->json([
            'status'  => 'success',
            'data'    => [
                'revoked_channels'  => $channelNames,
                'total_channels'    => $user->channels()->count(),
            ],
            'message' => 'Canales revocados correctamente. Se notificó al publicador.',
        ]);
    }
}
