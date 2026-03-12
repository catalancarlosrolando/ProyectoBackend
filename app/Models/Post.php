<?php

namespace App\Models;

use App\Enums\PostType;
use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Post extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'content',
        'type',
        'status',
        'moderator_comments',
        'scheduled_at',
        'published_at',
        'deadline',
        'timeout',
        'archived_by',
        'archived_at',
        'deleted_by',
    ];

    protected $casts = [
        'type' => PostType::class,
        'status' => PostStatus::class,
        'scheduled_at' => 'datetime',
        'published_at' => 'datetime',
        'deadline' => 'datetime',
        'timeout' => 'datetime',
        'archived_at' => 'datetime',
    ];

    /**
     * Un post pertenece a un usuario (relación 1:N inversa)
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Un post puede estar en muchos canales (relación N:M)
     */
    public function channels(): BelongsToMany
    {
        return $this->belongsToMany(Channel::class, 'post_channels');
    }

    /**
     * Un post puede usar muchos medios (relación N:M)
     */
    public function medias(): BelongsToMany
    {
        return $this->belongsToMany(Media::class, 'post_medias');
    }

    /**
     * Un post tiene muchos archivos adjuntos (relación 1:N)
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class);
    }

    /**
     * Historial de cambios de la publicación (relación 1:N)
     */
    public function histories(): HasMany
    {
        return $this->hasMany(PostHistory::class)->orderByDesc('created_at');
    }

    /**
     * Usuario que archivó la publicación
     */
    public function archivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by');
    }

    /**
     * Usuario que eliminó la publicación
     */
    public function deletedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    // ── Helpers ──

    /**
     * Verifica si la publicación permite edición completa.
     */
    public function isFullyEditable(): bool
    {
        return $this->status === PostStatus::DRAFT;
    }

    /**
     * Verifica si la publicación puede ser eliminada.
     */
    public function isDeletable(): bool
    {
        return in_array($this->status, [
            PostStatus::DRAFT,
            PostStatus::PENDING_REVIEW,
            PostStatus::APPROVED_BY_MODERATOR,
            PostStatus::SCHEDULED,
        ]);
    }

    /**
     * Verifica si la publicación puede ser archivada.
     */
    public function isArchivable(): bool
    {
        return in_array($this->status, [
            PostStatus::SCHEDULED,
            PostStatus::PUBLISHED,
        ]);
    }
}
