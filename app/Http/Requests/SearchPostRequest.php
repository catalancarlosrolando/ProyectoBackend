<?php

namespace App\Http\Requests;

use App\Enums\PostStatus;
use App\Enums\PostType;
use Illuminate\Foundation\Http\FormRequest;

class SearchPostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $statuses = implode(',', PostStatus::values());
        $types    = implode(',', PostType::values());

        return [
            'search'          => 'nullable|string|max:255',
            'status'          => "nullable|string|in:{$statuses}",
            'type'            => "nullable|string|in:{$types}",
            'channel_ids'     => 'nullable|array',
            'channel_ids.*'   => 'integer|exists:channels,id',
            'media_ids'       => 'nullable|array',
            'media_ids.*'     => 'integer|exists:medias,id',
            'author_id'       => 'nullable|integer|exists:users,id',
            'author_name'     => 'nullable|string|max:255',
            'created_from'    => 'nullable|date',
            'created_to'      => 'nullable|date|after_or_equal:created_from',
            'scheduled_from'  => 'nullable|date',
            'scheduled_to'    => 'nullable|date|after_or_equal:scheduled_from',
            'published_from'  => 'nullable|date',
            'published_to'    => 'nullable|date|after_or_equal:published_from',
            'has_attachments' => 'nullable|boolean',
            'sort_by'         => 'nullable|string|in:created_at,updated_at,scheduled_at,name,status',
            'sort_order'      => 'nullable|string|in:asc,desc',
            'per_page'        => 'nullable|integer|in:20,50,100',
        ];
    }

    public function messages(): array
    {
        return [
            'status.in'            => 'El estado proporcionado no es válido.',
            'type.in'              => 'El tipo de contenido proporcionado no es válido.',
            'created_to.after_or_equal'   => 'La fecha final de creación debe ser igual o posterior a la inicial.',
            'scheduled_to.after_or_equal' => 'La fecha final de programación debe ser igual o posterior a la inicial.',
            'published_to.after_or_equal' => 'La fecha final de publicación debe ser igual o posterior a la inicial.',
            'sort_by.in'           => 'El campo de ordenamiento no es válido.',
            'sort_order.in'        => 'El orden debe ser "asc" o "desc".',
            'per_page.in'          => 'Los resultados por página deben ser 20, 50 o 100.',
        ];
    }
}
