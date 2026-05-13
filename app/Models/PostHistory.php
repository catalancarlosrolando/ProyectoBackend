<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;

class PostHistory extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'post_id',
        'user_id',
        'action',
        'changes',
        'snapshot',
        'comment',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'changes'    => 'array',
            'snapshot'   => 'array',
            'created_at' => 'datetime',
        ];
    }

    // ── Constantes de acciones ──

    const ACTION_CREATED             = 'created';
    const ACTION_EDITED              = 'edited';
    const ACTION_STATUS_CHANGED      = 'status_changed';
    const ACTION_CHANNELS_UPDATED    = 'channels_updated';
    const ACTION_MEDIAS_UPDATED      = 'medias_updated';
    const ACTION_ATTACHMENT_ADDED    = 'attachment_added';
    const ACTION_ATTACHMENT_REMOVED  = 'attachment_removed';
    const ACTION_MODERATION_APPROVED = 'moderation_approved';
    const ACTION_MODERATION_REJECTED = 'moderation_rejected';
    const ACTION_SCHEDULED           = 'scheduled';
    const ACTION_RESCHEDULED         = 'rescheduled';
    const ACTION_ARCHIVED            = 'archived';
    const ACTION_UNARCHIVED          = 'unarchived';
    const ACTION_RESTORED_VERSION    = 'restored_version';
    const ACTION_DELETED             = 'deleted';
    const ACTION_STOPPED             = 'stopped';
    const ACTION_SUBMITTED           = 'submitted_for_review';

    // ── Relaciones ──

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ── Helpers ──

    /**
     * Registra una entrada en el historial de una publicación.
     */
    public static function record(
        int $postId,
        ?int $userId,
        string $action,
        ?array $changes = null,
        ?array $snapshot = null,
        ?string $comment = null,
        ?Request $request = null,
    ): self {
        return self::create([
            'post_id'    => $postId,
            'user_id'    => $userId,
            'action'     => $action,
            'changes'    => $changes,
            'snapshot'   => $snapshot,
            'comment'    => $comment,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Crea un snapshot completo de una publicación para restauración.
     */
    public static function takeSnapshot(Post $post): array
    {
        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return [
            'name'               => $post->name,
            'content'            => $post->content,
            'type'               => $post->type?->value ?? $post->type,
            'status'             => $post->status?->value ?? $post->status,
            'moderator_comments' => $post->moderator_comments,
            'scheduled_at'       => $post->scheduled_at?->toISOString(),
            'published_at'       => $post->published_at?->toISOString(),
            'channel_ids'        => $post->channels->pluck('id')->toArray(),
            'media_ids'          => $post->medias->pluck('id')->toArray(),
            'attachments'        => $post->attachments->map(fn ($a) => [
                'id'        => $a->id,
                'mime_type' => $a->mime_type,
                'path'      => $a->path,
            ])->toArray(),
        ];
    }
}
