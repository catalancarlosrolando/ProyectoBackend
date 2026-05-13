<?php

namespace App\Http\Requests;

use App\Enums\PostType;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Form Request para crear una nueva publicación.
 */
class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización se maneja via middleware
    }

    public function rules(): array
    {
        $types = implode(',', PostType::values());

        return [
            'name'              => 'required|string|max:255',
            'content'           => 'required|string|max:10000',
            'type'              => "required|string|in:{$types}",
            'scheduled_at'      => 'nullable|date|after:now',
            'channel_ids'       => 'required|array|min:1',
            'channel_ids.*'     => 'integer|exists:channels,id',
            'media_ids'         => 'nullable|array',
            'media_ids.*'       => 'integer|exists:medias,id',
            'attachments'       => 'nullable|array|max:10',
            'attachments.*'     => 'file|max:10240|mimes:jpg,jpeg,png,gif,webp,mp4,mov,avi,webm,mp3,wav,pdf',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'            => 'El título de la publicación es obligatorio.',
            'name.max'                 => 'El título no puede superar los 255 caracteres.',
            'content.required'         => 'El contenido de la publicación es obligatorio.',
            'content.max'              => 'El contenido no puede superar los 10000 caracteres.',
            'type.required'            => 'El tipo de publicación es obligatorio.',
            'type.in'                  => 'El tipo de publicación no es válido.',
            'scheduled_at.date'        => 'La fecha de programación debe ser una fecha válida.',
            'scheduled_at.after'       => 'La fecha de programación debe ser posterior a la fecha actual.',
            'channel_ids.required'     => 'Debe seleccionar al menos un canal.',
            'channel_ids.min'          => 'Debe seleccionar al menos un canal.',
            'channel_ids.*.exists'     => 'Uno de los canales seleccionados no existe.',
            'media_ids.*.exists'       => 'Uno de los medios seleccionados no existe.',
            'attachments.max'          => 'No se pueden adjuntar más de 10 archivos.',
            'attachments.*.max'        => 'Cada archivo no puede superar los 10 MB.',
            'attachments.*.mimes'      => 'Tipo de archivo no permitido. Se aceptan: imágenes, videos, audios y PDF.',
        ];
    }
}
