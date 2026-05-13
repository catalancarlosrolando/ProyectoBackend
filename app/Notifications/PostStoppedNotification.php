<?php

namespace App\Notifications;

use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PostStoppedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private Post $post,
        private string $stoppedByName,
        private string $reason,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'post_id'         => $this->post->id,
            'post_name'       => $this->post->name,
            'stopped_by'      => $this->stoppedByName,
            'reason'          => $this->reason,
            'message'         => "La publicación \"{$this->post->name}\" ha sido detenida por {$this->stoppedByName}. Motivo: {$this->reason}",
        ];
    }
}
