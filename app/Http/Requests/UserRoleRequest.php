<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request para asignar o revocar roles a un usuario.
 */
class UserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role' => 'required|string|exists:roles,name',
        ];
    }

    public function messages(): array
    {
        return [
            'role.required' => 'El rol es obligatorio.',
            'role.exists'   => 'El rol especificado no existe en el sistema.',
        ];
    }
}
