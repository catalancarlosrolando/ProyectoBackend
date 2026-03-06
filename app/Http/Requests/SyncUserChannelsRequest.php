<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación para asignar/sincronizar canales a un usuario publicador.
 *
 * Body esperado: { "channel_ids": [1, 2, 3] }
 */
class SyncUserChannelsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'channel_ids'   => ['required', 'array', 'min:1'],
            'channel_ids.*' => ['required', 'integer', 'exists:channels,id'],
        ];
    }

    public function messages(): array
    {
        return [
            // Errores de selección (Lo que el usuario olvidó hacer)
            'channel_ids.required'    => 'Es necesario seleccionar al menos un canal para realizar la asignación.',
            'channel_ids.min'         => 'Debes elegir al menos un canal de la lista para poder guardar los cambios.',

            // Errores de integridad (Lo que cambió en el sistema mientras el usuario operaba)
            'channel_ids.*.exists'    => 'Uno de los canales seleccionados ya no se encuentra disponible en el sistema. Por favor, actualiza la lista.',

            // Errores de sistema (Bugs del frontend o intentos de manipulación)
            'channel_ids.array'       => 'Se detectó un error en el formato de los datos enviados. Inténtalo de nuevo.',
            'channel_ids.*.integer'   => 'Error de comunicación: El identificador del canal no es válido.',
        ];
    }
}
