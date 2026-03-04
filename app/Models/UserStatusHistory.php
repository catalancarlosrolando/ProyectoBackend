<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Modelo para registrar el historial de cambios de un usuario.
 *
 * Registra: cambios de estado, asignación/revocación de roles,
 * habilitación/deshabilitación de cuentas.
 */
class UserStatusHistory extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'changed_by',
        'action',
        'old_value',
        'new_value',
        'reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    // ── Constantes de acciones ──

    const ACTION_STATUS_CHANGE = 'status_change';
    const ACTION_ROLE_ASSIGNED = 'role_assigned';
    const ACTION_ROLE_REVOKED = 'role_revoked';
    const ACTION_ENABLED = 'enabled';
    const ACTION_DISABLED = 'disabled';

    // ── Relaciones ──

    /**
     * Usuario al que pertenece este registro de historial.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Administrador que realizó el cambio.
     */
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    // ── Helpers ──

    /**
     * Registra una entrada en el historial de un usuario.
     */
    public static function record(
        int $userId,
        int $changedById,
        string $action,
        ?string $oldValue = null,
        ?string $newValue = null,
        ?string $reason = null
    ): self {
        return self::create([
            'user_id' => $userId,
            'changed_by' => $changedById,
            'action' => $action,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }
}
