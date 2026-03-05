<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request para asociar medios a un canal (channel_medias).
 */
class StoreChannelMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'media_ids'   => 'required|array|min:1',
            'media_ids.*' => 'required|integer|exists:medias,id',
        ];
    }

    public function messages(): array
    {
        return [
            'media_ids.required'    => 'Debe enviar al menos un medio.',
            'media_ids.array'       => 'El campo media_ids debe ser un arreglo.',
            'media_ids.min'         => 'Debe enviar al menos un medio.',
            'media_ids.*.required'  => 'Cada elemento de media_ids es obligatorio.',
            'media_ids.*.integer'   => 'Cada media_id debe ser un número entero.',
            'media_ids.*.exists'    => 'El medio indicado no existe.',
        ];
    }
}
