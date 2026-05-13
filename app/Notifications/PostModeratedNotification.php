<?php

namespace App\Notifications;

use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PostModeratedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Post $post,
        private string $decision,
        private string $moderatorName,
        private ?string $comments = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'post_id'        => $this->post->id,
            'post_name'      => $this->post->name,
            'decision'       => $this->decision,
            'moderator_name' => $this->moderatorName,
            'comments'       => $this->comments,
            'message'        => $this->decision === 'approved'
                ? "Tu publicación \"{$this->post->name}\" ha sido aprobada por {$this->moderatorName}."
                : "Tu publicación \"{$this->post->name}\" ha sido rechazada por {$this->moderatorName}.",
        ];
    }
}
