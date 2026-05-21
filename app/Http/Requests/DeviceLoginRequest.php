<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeviceLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uid' => 'required|string|max:50',
        ];
    }

    public function messages(): array
    {
        return [
            'uid.required' => 'El UID del dispositivo es obligatorio.',
            'uid.string' => 'El UID del dispositivo debe ser un texto valido.',
            'uid.max' => 'El UID del dispositivo no debe superar los 50 caracteres.',
        ];
    }
}
