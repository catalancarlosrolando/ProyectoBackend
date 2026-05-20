<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncDeviceChannelsRequest;
use App\Models\Channel;
use App\Models\Device;
use Illuminate\Http\JsonResponse;

/**
 * Controlador para gestionar la asignacion de canales a dispositivos.
 */
class DeviceChannelController extends Controller
{
    /**
     * GET /api/admin/device-channels
     *
     * Listar dispositivos con sus canales asignados.
     */
    public function index(): JsonResponse
    {
        $devices = Device::with([
            'channels:id,name,type',
        ])->paginate(10);

        return response()->json([
            'status' => 'success',
            'data' => $devices,
            'message' => 'Listado de dispositivos obtenido correctamente.',
        ]);
    }

    /**
     * GET /api/admin/device-channels/{device}
     *
     * Canales asignados a un dispositivo.
     */
    public function show(Device $device): JsonResponse
    {
        $channels = $device->channels()->get(['channels.id', 'channels.name', 'channels.type']);

        return response()->json([
            'status' => 'success',
            'data' => [
                'device' => $device->only('id', 'uid', 'is_active'),
                'channels' => $channels,
            ],
            'message' => 'Canales del dispositivo obtenidos correctamente.',
        ]);
    }

    /**
     * POST /api/admin/device-channels/{device}
     *
     * Asignar canales a un dispositivo.
     */
    public function store(SyncDeviceChannelsRequest $request, Device $device): JsonResponse
    {
        $channelIds = $request->validated()['channel_ids'];

        $currentIds = $device->channels()->pluck('channels.id')->toArray();
        $newIds = array_values(array_diff($channelIds, $currentIds));

        if (empty($newIds)) {
            return response()->json([
                'status' => 'info',
                'data' => null,
                'message' => 'Todos los canales seleccionados ya estaban asignados.',
            ]);
        }

        $device->channels()->syncWithoutDetaching($newIds);

        $channelNames = Channel::whereIn('id', $newIds)->pluck('name')->toArray();

        return response()->json([
            'status' => 'success',
            'data' => [
                'assigned_channels' => $channelNames,
                'total_channels' => $device->channels()->count(),
            ],
            'message' => 'Canales asignados correctamente.',
        ]);
    }

    /**
     * DELETE /api/admin/device-channels/{device}
     *
     * Revocar canales de un dispositivo.
     */
    public function destroy(SyncDeviceChannelsRequest $request, Device $device): JsonResponse
    {
        $channelIds = $request->validated()['channel_ids'];

        $currentIds = $device->channels()->pluck('channels.id')->toArray();
        $toRevoke = array_values(array_intersect($channelIds, $currentIds));

        if (empty($toRevoke)) {
            return response()->json([
                'status' => 'info',
                'data' => null,
                'message' => 'Ninguno de los canales seleccionados estaba asignado.',
            ]);
        }

        $channelNames = Channel::whereIn('id', $toRevoke)->pluck('name')->toArray();
        $device->channels()->detach($toRevoke);

        return response()->json([
            'status' => 'success',
            'data' => [
                'revoked_channels' => $channelNames,
                'total_channels' => $device->channels()->count(),
            ],
            'message' => 'Canales revocados correctamente.',
        ]);
    }
}
