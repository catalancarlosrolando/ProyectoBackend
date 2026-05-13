<?php

use App\Enums\PostStatus;
use App\Enums\PostType;
use App\Models\Device;
use App\Models\Post;
use App\Models\User;
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

    it('retorna solo publicaciones publicadas del usuario asociado', function () {
        $user = User::factory()->create();
        $device = Device::factory()->create(['user_id' => $user->id]);
        $otherUser = User::factory()->create();

        $published = Post::create([
            'user_id' => $user->id,
            'name' => 'Publicado',
            'content' => 'Contenido',
            'type' => PostType::IMAGE->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);

        Post::create([
            'user_id' => $user->id,
            'name' => 'Borrador',
            'content' => 'Contenido',
            'type' => PostType::TEXT->value,
            'status' => PostStatus::DRAFT->value,
        ]);

        Post::create([
            'user_id' => $otherUser->id,
            'name' => 'Publicado Ajeno',
            'content' => 'Contenido',
            'type' => PostType::VIDEO->value,
            'status' => PostStatus::PUBLISHED->value,
        ]);

        Sanctum::actingAs($device);

        $response = $this->getJson('/api/device/posts');

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.id', $published->id);
    });

    it('permite ver detalle solo de publicaciones publicadas propias', function () {
        $user = User::factory()->create();
        $device = Device::factory()->create(['user_id' => $user->id]);

        $published = Post::create([
            'user_id' => $user->id,
            'name' => 'Publicado',
            'content' => 'Contenido',
            'type' => PostType::IMAGE->value,
            'status' => PostStatus::PUBLISHED->value,
            'published_at' => now(),
        ]);

        $draft = Post::create([
            'user_id' => $user->id,
            'name' => 'Borrador',
            'content' => 'Contenido',
            'type' => PostType::TEXT->value,
            'status' => PostStatus::DRAFT->value,
        ]);

        Sanctum::actingAs($device);

        $this->getJson("/api/device/posts/{$published->id}")
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.id', $published->id);

        $this->getJson("/api/device/posts/{$draft->id}")
            ->assertStatus(403)
            ->assertJsonPath('status', 'error');
    });
});
