<?php

namespace App\Http\Requests;

use App\Enums\UserStatus;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request para listar usuarios con filtros, paginación y ordenamiento.
 */
class UserListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización se maneja via middleware
    }

    public function rules(): array
    {
        $statuses = implode(',', UserStatus::values());

        return [
            // Paginación
            'per_page'       => 'nullable|integer|in:20,50,100',
            'page'           => 'nullable|integer|min:1',

            // Filtros
            'role'           => 'nullable|string|max:50',
            'status'         => "nullable|string|in:{$statuses}",
            'email'          => 'nullable|string|max:255',
            'name'           => 'nullable|string|max:200',
            'dni'            => 'nullable|string|max:20',
            'registered_from' => 'nullable|date',
            'registered_to'  => 'nullable|date|after_or_equal:registered_from',
            'last_access_from' => 'nullable|date',
            'last_access_to' => 'nullable|date|after_or_equal:last_access_from',

            // Ordenamiento
            'sort_by'        => 'nullable|string|in:name,email,created_at,last_access_at,status',
            'sort_order'     => 'nullable|string|in:asc,desc',
        ];
    }

    public function messages(): array
    {
        return [
            'per_page.in'            => 'La paginación debe ser de 20, 50 o 100 registros.',
            'status.in'              => 'El estado proporcionado no es válido.',
            'sort_by.in'             => 'Solo se puede ordenar por: name, email, created_at, last_access_at, status.',
            'sort_order.in'          => 'El orden debe ser asc o desc.',
            'registered_to.after_or_equal' => 'La fecha final de registro debe ser posterior a la fecha inicial.',
            'last_access_to.after_or_equal' => 'La fecha final de acceso debe ser posterior a la fecha inicial.',
        ];
    }
}
