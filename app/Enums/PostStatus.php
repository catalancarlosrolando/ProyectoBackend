<?php

namespace App\Enums;

enum PostStatus: string
{
    case DRAFT = 'draft';
    case PENDING_REVIEW = 'pending_review';
    case APPROVED_BY_MODERATOR = 'approved_by_moderator';
    case PUBLISHED = 'published';
    case SCHEDULED = 'scheduled';
    case ARCHIVED = 'archived';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Borrador',
            self::PENDING_REVIEW => 'Pendiente de revisión',
            self::APPROVED_BY_MODERATOR => 'Aprobado',
            self::PUBLISHED => 'Publicado',
            self::SCHEDULED => 'Programado',
            self::ARCHIVED => 'Archivado',
        };
    }
}
