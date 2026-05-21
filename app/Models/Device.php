<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Laravel\Sanctum\HasApiTokens;

class Device extends Authenticatable
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'uid',
        'is_active',
        'last_seen_at',
        'last_sync_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_seen_at' => 'datetime',
        'last_sync_at' => 'datetime',
    ];

    public function channels(): BelongsToMany
    {
        return $this->belongsToMany(Channel::class, 'device_channels');
    }

    protected static function booted(): void
    {
        static::creating(function (Device $device) {
            if (empty($device->uid)) {
                $device->uid = self::generateUid();
            }
        });
    }

    public static function generateUid(): string
    {
        do {
            $uid = 'DC' . random_int(100000, 999999);
        } while (self::where('uid', $uid)->exists());

        return $uid;
    }
}
