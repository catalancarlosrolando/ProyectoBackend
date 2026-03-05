<?php

namespace App\Http\Requests;

use App\Enums\ChannelType;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request para actualizar un canal temático de difusión.
 */
class UpdateChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $types = implode(',', ChannelType::values());
        $channelId = $this->route('channel')?->id ?? $this->route('channel');

        return [
            'name'             => "sometimes|required|string|max:255|unique:channels,name,{$channelId}",
            'description'      => 'nullable|string|max:1000',
            'type'             => "sometimes|required|string|in:{$types}",
            'semantic_context' => 'nullable|string|max:2000',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'        => 'El nombre del canal es obligatorio.',
            'name.unique'          => 'Ya existe un canal con ese nombre.',
            'name.max'             => 'El nombre no puede superar los 255 caracteres.',
            'description.max'      => 'La descripción no puede superar los 1000 caracteres.',
            'type.required'        => 'El tipo de canal es obligatorio.',
            'type.in'              => 'El tipo de canal no es válido.',
            'semantic_context.max' => 'El contexto semántico no puede superar los 2000 caracteres.',
        ];
    }
}
