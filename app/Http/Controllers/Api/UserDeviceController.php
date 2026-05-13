<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserDeviceRequest;

/**
 * Controlador para gestionar la asignacion de dispositivos a usuarios.
 *
 * Funcionalidades:
 * - Listar usuarios con su estado de dispositivo
 * - Ver el dispositivo de un usuario
 * - Asignar dispositivo a un usuario (genera UID automatico)
 * - Revocar dispositivo de un usuario
 */
class UserDeviceController extends Controller
{
    /**
     * GET /api/admin/user-devices
     *
     * Listar usuarios con informacion de dispositivo.
     */
    public function index(): JsonResponse
    {
        $users = User::with('device:id,user_id,uid,is_active,last_seen_at')
            ->select(['id', 'name', 'first_name', 'last_name', 'email', 'status'])
            ->paginate(10);

        return response()->json([
            'status' => 'success',
            'data' => $users,
            'message' => 'Listado de usuarios con dispositivo obtenido correctamente.',
        ]);
    }

    /**
     * GET /api/admin/user-devices/{user}
     *
     * Ver el dispositivo asignado a un usuario.
     */
    public function show(User $user): JsonResponse
    {
        $device = $user->device;

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => $user->only('id', 'name', 'first_name', 'last_name', 'email'),
                'device' => $device,
            ],
            'message' => 'Dispositivo del usuario obtenido correctamente.',
        ]);
    }

    /**
     * POST /api/admin/user-devices/{user}
     *
     * Asignar dispositivo a un usuario (genera UID automaticamente).
     */
    public function store(StoreUserDeviceRequest $request, User $user): JsonResponse
    {
        $device = $user->device;
        $isActive = $request->input('is_active', true);

        if ($device) {
            if ($request->has('is_active')) {
                $device->update(['is_active' => $isActive]);
            }

            return response()->json([
                'status' => 'info',
                'data' => $device->only('id', 'uid', 'is_active', 'last_seen_at'),
                'message' => 'El usuario ya tiene un dispositivo asignado.',
            ]);
        }

        $device = $user->device()->create([
            'is_active' => $isActive,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => $device->only('id', 'uid', 'is_active', 'last_seen_at'),
            'message' => 'Dispositivo asignado correctamente.',
        ], 201);
    }

    /**
     * DELETE /api/admin/user-devices/{user}
     *
     * Revocar dispositivo de un usuario.
     */
    public function destroy(User $user): JsonResponse
    {
        $device = $user->device;

        if (!$device) {
            return response()->json([
                'status' => 'info',
                'data' => null,
                'message' => 'El usuario no tiene dispositivo asignado.',
            ]);
        }

        $device->delete();

        return response()->json([
            'status' => 'success',
            'data' => null,
            'message' => 'Dispositivo revocado correctamente.',
        ]);
    }
}
