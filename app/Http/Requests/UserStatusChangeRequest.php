<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request para cambiar el estado de un usuario (aprobar/rechazar/habilitar/deshabilitar).
 */
class UserStatusChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => 'nullable|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'reason.max' => 'El motivo no puede superar los 500 caracteres.',
        ];
    }
}
