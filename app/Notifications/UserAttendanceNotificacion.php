<?php

namespace App\Notifications;

use App\Models\Attendance;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class UserAttendanceNotificacion extends Notification
{
    use Queueable;

    //example: new UserAttendanceNotificacion($attendance, 'approved');
    public function __construct(
        private Attendance $attendance,
        private string $status,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'attendace_id'        => $this->attendance->id,
            'fecha'       => $this->attendance->fecha->format('Y-m-d'),
            'estado'      => $this->attendance->estado,
            'message'        => $this->decision === 'ausente'
                ? "Tu asistencia del {$this->attendance->fecha->format('d/m/Y')} ha sido aprobada."
                : "Tu asistencia del {$this->attendance->fecha->format('d/m/Y')} ha sido rechazada.",
        ];
    }
}
