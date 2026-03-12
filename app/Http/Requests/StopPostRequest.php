<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StopPostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'confirm' => 'required|boolean|accepted',
            'reason'  => 'required|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'confirm.required' => 'Debe confirmar la detención de la publicación.',
            'confirm.accepted' => 'Debe confirmar la detención de la publicación.',
            'reason.required'  => 'Debe indicar el motivo de la detención.',
            'reason.max'       => 'El motivo no puede superar los 500 caracteres.',
        ];
    }
}
