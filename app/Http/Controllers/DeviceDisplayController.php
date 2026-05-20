<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\Response;

/**
 * Renderiza la vista de reproduccion para dispositivos.
 */
class DeviceDisplayController extends Controller
{
    /**
     * GET /device/{uid}
     */
    public function show(string $uid): Response
    {
        $device = Device::where('uid', $uid)->where('is_active', true)->first();

        if (!$device) {
            abort(403, 'Dispositivo no autorizado.');
        }

        return response(
            file_get_contents(public_path('frontend/device-player.html')),
            200,
            ['Content-Type' => 'text/html; charset=UTF-8']
        );
    }
}
