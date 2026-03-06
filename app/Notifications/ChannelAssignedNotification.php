<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación enviada cuando se asignan canales a un publicador.
 */
class ChannelAssignedNotification extends Notification
{
    use Queueable;

    /**
     * @param  array<string>  $channelNames  Nombres de los canales asignados
     * @param  string|null    $adminName     Nombre del admin que realizó la asignación
     */
    public function __construct(
        public readonly array $channelNames,
        public readonly ?string $adminName = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name', 'Difexa');
        $count = count($this->channelNames);
        $list = implode(', ', $this->channelNames);

        return (new MailMessage)
            ->subject("Nuevos canales asignados - {$appName}")
            ->greeting("¡Hola, {$notifiable->name}!")
            ->line("Se te han asignado **{$count}** canal(es): **{$list}**.")
            ->when($this->adminName, fn ($m) => $m->line("Asignado por: {$this->adminName}"))
            ->line('Ya puedes gestionar contenido en estos canales.')
            ->action('Ir al sistema', url('/'))
            ->line('¡Gracias por ser parte del equipo!');
    }
}
