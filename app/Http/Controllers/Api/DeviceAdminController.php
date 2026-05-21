<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeviceRequest;
use App\Models\Device;
use Illuminate\Http\JsonResponse;

/**
 * Gestion de dispositivos (admin).
 */
class DeviceAdminController extends Controller
{
    /**
     * GET /api/admin/devices
     */
    public function index(): JsonResponse
    {
        $devices = Device::query()
            ->select(['id', 'uid', 'is_active', 'last_seen_at', 'last_sync_at', 'created_at'])
            ->orderByDesc('id')
            ->paginate(10);

        return response()->json([
            'status' => 'success',
            'data' => $devices,
            'message' => 'Listado de dispositivos obtenido correctamente.',
        ]);
    }

    /**
     * POST /api/admin/devices
     */
    public function store(StoreDeviceRequest $request): JsonResponse
    {
        $device = Device::create([
            'is_active' => $request->input('is_active', true),
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $device->only('id', 'uid', 'is_active', 'last_seen_at'),
            'message' => 'Dispositivo creado correctamente.',
        ], 201);
    }

    /**
     * DELETE /api/admin/devices/{device}
     */
    public function destroy(Device $device): JsonResponse
    {
        $device->delete();

        return response()->json([
            'status' => 'success',
            'data' => null,
            'message' => 'Dispositivo eliminado correctamente.',
        ]);
    }
}
