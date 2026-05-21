<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validacion para asignar o revocar canales a un dispositivo.
 *
 * Body esperado: { "channel_ids": [1, 2, 3] }
 */
class SyncDeviceChannelsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'channel_ids' => ['required', 'array', 'min:1'],
            'channel_ids.*' => ['required', 'integer', 'exists:channels,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'channel_ids.required' => 'Es necesario seleccionar al menos un canal para realizar la asignacion.',
            'channel_ids.min' => 'Debes elegir al menos un canal de la lista para poder guardar los cambios.',
            'channel_ids.array' => 'Se detecto un error en el formato de los datos enviados. Intentalo de nuevo.',
            'channel_ids.*.integer' => 'Error de comunicacion: El identificador del canal no es valido.',
            'channel_ids.*.exists' => 'Uno de los canales seleccionados ya no se encuentra disponible. Actualiza la lista.',
        ];
    }
}
