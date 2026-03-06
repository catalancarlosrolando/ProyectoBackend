<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación enviada cuando se revocan canales de un publicador.
 */
class ChannelRevokedNotification extends Notification
{
    use Queueable;

    /**
     * @param  array<string>  $channelNames  Nombres de los canales revocados
     * @param  string|null    $adminName     Nombre del admin que realizó la revocación
     */
    public function __construct(
        public readonly array $channelNames,
        public readonly ?string $adminName = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name', 'Difexa');
        $count = count($this->channelNames);
        $list = implode(', ', $this->channelNames);

        return (new MailMessage)
            ->subject("Acceso a canales revocado - {$appName}")
            ->greeting("Hola, {$notifiable->name}")
            ->line("Se ha revocado tu acceso a **{$count}** canal(es): **{$list}**.")
            ->when($this->adminName, fn ($m) => $m->line("Revocado por: {$this->adminName}"))
            ->line('Si crees que esto es un error, contacta con el administrador del sistema.')
            ->action('Ir al sistema', url('/'));
    }

    public function toArray(object $notifiable): array
    {
        $count = count($this->channelNames);
        $list = implode(', ', $this->channelNames);

        return [
            'type' => 'channel_revoked',
            'icon' => 'remove_circle',
            'title' => "Canales revocados ({$count})",
            'message' => "Se ha revocado tu acceso a: {$list}.",
            'channel_names' => $this->channelNames,
            'admin_name' => $this->adminName,
        ];
    }
}
