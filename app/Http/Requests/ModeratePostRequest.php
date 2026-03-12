<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ModeratePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'moderator_comments' => 'required|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'moderator_comments.required' => 'Debe incluir comentarios al rechazar la publicación.',
            'moderator_comments.max'      => 'Los comentarios no pueden superar los 1000 caracteres.',
        ];
    }
}
