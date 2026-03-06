<?php

namespace App\Notifications;

use App\Enums\UserStatus;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación enviada cuando cambia el estado de aprobación de un usuario.
 *
 * Se envía al aprobar, rechazar, habilitar o deshabilitar una cuenta.
 */
class UserStatusChangeNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $newStatus,
        public readonly ?string $reason = null,
        public readonly ?string $adminName = null
    ) {}

    /**
     * Canales de entrega.
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Representación por email.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $statusEnum = UserStatus::tryFrom($this->newStatus);
        $statusLabel = $statusEnum?->label() ?? $this->newStatus;
        $appName = config('app.name', 'Difexa');

        $mail = (new MailMessage)
            ->subject("Estado de tu cuenta actualizado - {$appName}");

        return match ($this->newStatus) {
            UserStatus::APPROVED->value => $mail
                ->greeting("¡Hola, {$notifiable->name}!")
                ->line('Tu cuenta ha sido **aprobada** por un administrador.')
                ->line('Ya puedes acceder a todas las funcionalidades del sistema.')
                ->action('Ir al sistema', url('/'))
                ->line('¡Bienvenido!'),

            UserStatus::DISABLED->value => $mail
                ->greeting("Hola, {$notifiable->name}")
                ->line('Tu cuenta ha sido **deshabilitada** por un administrador.')
                ->when($this->reason, fn($m) => $m->line("**Motivo:** {$this->reason}"))
                ->line('Si crees que esto es un error, contacta con el administrador del sistema.'),

            UserStatus::DELETED->value => $mail
                ->greeting("Hola, {$notifiable->name}")
                ->line('Tu solicitud de registro ha sido **rechazada**.')
                ->when($this->reason, fn($m) => $m->line("**Motivo:** {$this->reason}"))
                ->line('Si tienes preguntas, contacta con el administrador del sistema.'),

            default => $mail
                ->greeting("Hola, {$notifiable->name}")
                ->line("El estado de tu cuenta ha cambiado a: **{$statusLabel}**.")
                ->when($this->reason, fn($m) => $m->line("**Motivo:** {$this->reason}")),
        };
    }

    /**
     * Representación como array (canal database).
     */
    public function toArray(object $notifiable): array
    {
        $statusEnum = UserStatus::tryFrom($this->newStatus);
        $statusLabel = $statusEnum?->label() ?? $this->newStatus;

        [$type, $icon, $title, $message] = match ($this->newStatus) {
            UserStatus::APPROVED->value => [
                'account_approved', 'check_circle',
                'Cuenta aprobada',
                'Tu cuenta ha sido aprobada. Ya puedes acceder al sistema.',
            ],
            UserStatus::DISABLED->value => [
                'account_disabled', 'block',
                'Cuenta deshabilitada',
                'Tu cuenta ha sido deshabilitada.' . ($this->reason ? " Motivo: {$this->reason}" : ''),
            ],
            UserStatus::DELETED->value => [
                'account_rejected', 'cancel',
                'Solicitud rechazada',
                'Tu solicitud de registro ha sido rechazada.' . ($this->reason ? " Motivo: {$this->reason}" : ''),
            ],
            default => [
                'status_change', 'info',
                "Estado actualizado: {$statusLabel}",
                "El estado de tu cuenta cambió a {$statusLabel}." . ($this->reason ? " Motivo: {$this->reason}" : ''),
            ],
        };

        return [
            'type' => $type,
            'icon' => $icon,
            'title' => $title,
            'message' => $message,
            'new_status' => $this->newStatus,
            'reason' => $this->reason,
            'admin_name' => $this->adminName,
        ];
    }
}
