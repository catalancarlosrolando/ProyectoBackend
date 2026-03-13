<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeletePostRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (!$this->filled('reason') && $this->query('reason')) {
            $this->merge(['reason' => $this->query('reason')]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => 'required|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Debe indicar el motivo de la eliminación.',
            'reason.max'      => 'El motivo no puede superar los 500 caracteres.',
        ];
    }
}
