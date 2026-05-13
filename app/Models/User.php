<?php

namespace App\Models;

use App\Enums\UserStatus;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Notifications\Notifiable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Auth\CanResetPassword;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\CustomVerifyEmailNotification;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable implements MustVerifyEmail, CanResetPassword
{
    use HasFactory, Notifiable, HasRoles, HasApiTokens;

    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'email',
        'mobile',
        'semantic_context',
        'password',
        'status',
        'dni',
        'last_access_at',
        'rejection_reason',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_access_at' => 'datetime',
            'password' => 'hashed',
            'status' => UserStatus::class,
        ];
    }

    public function displayInfo(): string
    {
        return "User: {$this->name}, Email: {$this->email}";
    }

    // ── Relaciones ──

    /**
     * Relación 1:N con Posts.
     */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    /**
     * Relación 1:1 con Device.
     */
    public function device(): HasOne
    {
        return $this->hasOne(Device::class);
    }

    /**
     * Relación N:M con Channels.
     */
    public function channels(): BelongsToMany
    {
        return $this->belongsToMany(Channel::class, 'user_channels')
            ->withPivot('is_approved', 'approved_at', 'approved_by')
            ->withTimestamps();
    }

    /**
     * Historial de cambios de estado del usuario.
     */
    public function statusHistories(): HasMany
    {
        return $this->hasMany(UserStatusHistory::class)->orderByDesc('created_at');
    }

    /**
     * Filtros guardados del usuario.
     */
    public function savedFilters(): HasMany
    {
        return $this->hasMany(SavedFilter::class);
    }

    // ── Helpers de estado ──

    /**
     * Verifica si el usuario tiene un estado específico.
     */
    public function hasStatus(UserStatus $status): bool
    {
        return $this->status === $status;
    }

    /**
     * Verifica si el usuario está activo (aprobado y no deshabilitado).
     */
    public function isActive(): bool
    {
        return $this->status === UserStatus::APPROVED;
    }

    /**
     * Verifica si el usuario está deshabilitado.
     */
    public function isDisabled(): bool
    {
        return $this->status === UserStatus::DISABLED;
    }

    // ── Notificaciones ──

    /**
     * Send the password reset notification.
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    /**
     * Send the email verification notification.
     */
    public function sendEmailVerificationNotification()
    {
        $this->notify(new CustomVerifyEmailNotification());
    }
}
