<?php

namespace App\Enums;

/**
 * Estados posibles de un usuario en el sistema.
 *
 * Flujo:  registered → verified → approved → (disabled ↔ approved)
 *         registered → deleted (rechazado)
 */
enum UserStatus: string
{
    case REGISTERED = 'registered';
    case VERIFIED = 'verified';
    case APPROVED = 'approved';
    case DISABLED = 'disabled';
    case DELETED = 'deleted';

    /**
     * Retorna todos los valores como array de strings.
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Etiqueta en español para mostrar al usuario.
     */
    public function label(): string
    {
        return match ($this) {
            self::REGISTERED => 'Registrado',
            self::VERIFIED => 'Verificado',
            self::APPROVED => 'Aprobado',
            self::DISABLED => 'Deshabilitado',
            self::DELETED => 'Eliminado',
        };
    }
}
