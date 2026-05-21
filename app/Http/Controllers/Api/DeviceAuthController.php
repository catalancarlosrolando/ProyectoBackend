<?php

namespace App\Http\Controllers\Api;

use App\Models\Device;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\DeviceLoginRequest;

class DeviceAuthController extends Controller
{
    /**
     * POST /api/device/login
     *
     * Autentica un dispositivo por UID y genera un token de sesion.
     */
    public function login(DeviceLoginRequest $request): JsonResponse
    {
        $device = Device::where('uid', $request->input('uid'))->first();

        if (!$device || !$device->is_active) {
            return response()->json([
                'status' => 'error',
                'data' => null,
                'message' => 'El UID no es valido o el dispositivo esta inactivo.',
            ], 404);
        }

        $device->update(['last_seen_at' => now()]);

        $token = $device->createToken('device_token',
        ['device'])->plainTextToken;

        return response()->json([
            'status' => 'success',
            'data' => [
                'device' => [
                    'id' => $device->id,
                    'uid' => $device->uid,
                    'is_active' => $device->is_active,
                    'last_seen_at' => $device->last_seen_at,
                ],
                'token' => $token,
                'token_type' => 'Bearer',
            ],
            'message' => 'Autenticacion de dispositivo exitosa.',
        ], 200);
    }
}
