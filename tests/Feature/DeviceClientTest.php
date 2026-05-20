<?php

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Enums\ChannelType;
use App\Models\Channel;
use App\Models\Device;
use App\Models\Post;
use Laravel\Sanctum\Sanctum;

describe('Dispositivo cliente', function () {
    it('permite autenticarse con UID valido', function () {
        $device = Device::factory()->create(['is_active' => true]);

        $response = $this->postJson('/api/device/login', [
            'uid' => $device->uid,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.device.id', $device->id)
            ->assertJsonPath('data.device.uid', $device->uid)
            ->assertJsonStructure(['data' => ['token']]);
    });

    it('rechaza UID inexistente o dispositivo inactivo', function () {
        $device = Device::factory()->create(['is_active' => false]);

        $response = $this->postJson('/api/device/login', [
            'uid' => $device->uid,
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('status', 'error');
    });

    it('retorna publicaciones publicadas de canales asignados con token', function () {
        $device = Device::factory()->create();
        $user = \App\Models\User::factory()->create();

        $channel = Channel::create([
            'name' => 'Canal Principal',
            'type' => ChannelType::DEPARTMENT->value,
            'description' => 'Canal asignado',
        ]);

        $otherChannel = Channel::create([
            'name' => 'Canal Secundario',
            'type' => ChannelType::INSTITUTE->value,
            'description' => 'Canal no asignado',
        ]);

        $device->channels()->attach($channel->id);

        $published = Post::create([
            'user_id' => $user->id,
            'name' => 'Publicado',
            'content' => 'Contenido',
            'type' => PostType::IMAGE->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);
        $published->channels()->attach($channel->id);

        $draft = Post::create([
            'user_id' => $user->id,
            'name' => 'Borrador',
            'content' => 'Contenido',
            'type' => PostType::TEXT->value,
            'status' => PostStatus::DRAFT->value,
        ]);
        $draft->channels()->attach($channel->id);

        $other = Post::create([
            'user_id' => $user->id,
            'name' => 'Publicado Ajeno',
            'content' => 'Contenido',
            'type' => PostType::VIDEO->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);
        $other->channels()->attach($otherChannel->id);

        Sanctum::actingAs($device);

        $response = $this->getJson('/api/device/posts');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.id', $published->id);
    });

    it('permite ver detalle solo de publicaciones publicadas propias', function () {
        $device = Device::factory()->create();
        $user = \App\Models\User::factory()->create();

        $channel = Channel::create([
            'name' => 'Canal Principal',
            'type' => ChannelType::DEPARTMENT->value,
            'description' => 'Canal asignado',
        ]);

        $device->channels()->attach($channel->id);

        $published = Post::create([
            'user_id' => $user->id,
            'name' => 'Publicado',
            'content' => 'Contenido',
            'type' => PostType::IMAGE->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);
        $published->channels()->attach($channel->id);

        $draft = Post::create([
            'user_id' => $user->id,
            'name' => 'Borrador',
            'content' => 'Contenido',
            'type' => PostType::TEXT->value,
            'status' => PostStatus::DRAFT->value,
        ]);
        $draft->channels()->attach($channel->id);

        Sanctum::actingAs($device);

        $this->getJson("/api/device/posts/{$published->id}")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $published->id);

        $this->getJson("/api/device/posts/{$draft->id}")
            ->assertStatus(403)
            ->assertJsonPath('status', 'error');
    });

    it('retorna publicaciones publicadas de canales asignados', function () {
        $device = Device::factory()->create(['is_active' => true]);
        $user = \App\Models\User::factory()->create();

        $channel = Channel::create([
            'name' => 'Canal Principal',
            'type' => ChannelType::DEPARTMENT->value,
            'description' => 'Canal asignado al dispositivo',
        ]);

        $otherChannel = Channel::create([
            'name' => 'Canal Secundario',
            'type' => ChannelType::INSTITUTE->value,
            'description' => 'Canal no asignado',
        ]);

        $device->channels()->attach($channel->id);

        $includedPost = Post::create([
            'user_id' => $user->id,
            'name' => 'Post asignado',
            'content' => 'Contenido',
            'type' => PostType::IMAGE->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);
        $includedPost->channels()->attach($channel->id);

        $excludedPost = Post::create([
            'user_id' => $user->id,
            'name' => 'Post fuera de canal',
            'content' => 'Contenido',
            'type' => PostType::VIDEO->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);
        $excludedPost->channels()->attach($otherChannel->id);

        $response = $this->getJson("/api/device/feed/{$device->uid}");

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $includedPost->id);
    });

    it('actualiza last_sync_at en polling', function () {
        $device = Device::factory()->create([
            'is_active' => true,
            'last_sync_at' => null,
        ]);

        $this->getJson("/api/device/feed/{$device->uid}")
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $device->refresh();

        expect($device->last_sync_at)->not()->toBeNull();
    });
});
