<?php

use App\Models\User;
use App\Models\Post;
use App\Models\Channel;
use App\Models\Media;
use App\Models\PostHistory;
use App\Enums\UserStatus;
use App\Enums\PostStatus;
use App\Enums\ChannelType;
use App\Enums\MediaType;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Helper: Crea roles y permisos necesarios.
 */
function setupHistoryRolesAndPermissions(): void
{
    app()[PermissionRegistrar::class]->forgetCachedPermissions();

    Permission::firstOrCreate(['name' => 'editar-contenido']);
    Permission::firstOrCreate(['name' => 'eliminar-contenido']);
    Permission::firstOrCreate(['name' => 'gestionar-usuarios']);
    Permission::firstOrCreate(['name' => 'acceder-panel-admin']);
    Permission::firstOrCreate(['name' => 'ver-reportes']);
    Permission::firstOrCreate(['name' => 'gestionar-canales']);
    Permission::firstOrCreate(['name' => 'ver-perfil']);

    $rolePublicador = Role::firstOrCreate(['name' => 'publicador']);
    $rolePublicador->syncPermissions(['editar-contenido']);

    $roleModerador = Role::firstOrCreate(['name' => 'moderador']);
    $roleModerador->syncPermissions(['editar-contenido', 'eliminar-contenido', 'ver-reportes']);

    $roleAdmin = Role::firstOrCreate(['name' => 'admin']);
    $roleAdmin->syncPermissions(Permission::all());
}

/**
 * Helper: Crea un publicador con canales autorizados.
 */
function createHistoryPublisher(array $channelIds = []): User
{
    $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);
    $user->assignRole('publicador');

    if (!empty($channelIds)) {
        $user->channels()->attach($channelIds, [
            'is_approved' => true,
            'approved_at' => now(),
        ]);
    }

    return $user;
}

/**
 * Helper: Crea un publicador con un post en borrador y canal asociado.
 */
function createPublisherWithPost(string $status = 'draft'): array
{
    $channel = Channel::create([
        'name'        => 'Canal History ' . uniqid(),
        'description' => 'Test',
        'type'        => ChannelType::DEPARTMENT->value,
    ]);

    $media = Media::create([
        'name'      => 'Media History ' . uniqid(),
        'type'      => MediaType::PHYSICAL_SCREEN->value,
        'is_active' => true,
    ]);

    $channel->medias()->attach($media->id);

    $publisher = createHistoryPublisher([$channel->id]);

    $post = Post::create([
        'user_id' => $publisher->id,
        'name'    => 'Post para historial',
        'content' => 'Contenido original',
        'type'    => 'text',
        'status'  => $status,
    ]);

    $post->channels()->attach($channel->id);
    $post->medias()->attach($media->id);

    return [$publisher, $post, $channel, $media];
}

// ════════════════════════════════════════════════════════════════
// H10: HISTORIAL DE CAMBIOS
// ════════════════════════════════════════════════════════════════

describe('Historial de cambios (GET /api/posts/{post}/history)', function () {

    beforeEach(function () {
        setupHistoryRolesAndPermissions();
    });

    it('muestra historial cronológico completo de una publicación propia', function () {
        [$publisher, $post] = createPublisherWithPost();

        // Crear entradas de historial
        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED, snapshot: ['name' => 'original']);
        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_EDITED, changes: ['name' => ['old' => 'original', 'new' => 'editado']]);

        $response = $this->actingAs($publisher)->getJson("/api/posts/{$post->id}/history");

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $data = $response->json('data.data');
        expect($data)->toHaveCount(2);
    });

    it('filtra historial por tipo de acción', function () {
        [$publisher, $post] = createPublisherWithPost();

        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED);
        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_EDITED);
        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_STATUS_CHANGED);

        $response = $this->actingAs($publisher)->getJson("/api/posts/{$post->id}/history?action=edited");

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['action'])->toBe('edited');
    });

    it('filtra historial por usuario', function () {
        [$publisher, $post] = createPublisherWithPost();

        $moderator = User::factory()->create(['status' => UserStatus::APPROVED->value]);
        $moderator->assignRole('moderador');

        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED);
        PostHistory::record($post->id, $moderator->id, PostHistory::ACTION_MODERATION_APPROVED);

        $response = $this->actingAs($publisher)->getJson("/api/posts/{$post->id}/history?user_id={$moderator->id}");

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['user_id'])->toBe($moderator->id);
    });

    it('filtra historial por rango de fechas', function () {
        [$publisher, $post] = createPublisherWithPost();

        PostHistory::create([
            'post_id'    => $post->id,
            'user_id'    => $publisher->id,
            'action'     => PostHistory::ACTION_CREATED,
            'created_at' => now()->subDays(10),
        ]);

        PostHistory::create([
            'post_id'    => $post->id,
            'user_id'    => $publisher->id,
            'action'     => PostHistory::ACTION_EDITED,
            'created_at' => now(),
        ]);

        $dateFrom = now()->subDays(2)->toDateString();
        $dateTo   = now()->addDay()->toDateString();

        $response = $this->actingAs($publisher)->getJson("/api/posts/{$post->id}/history?date_from={$dateFrom}&date_to={$dateTo}");

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
    });

    it('publicador no ve historial de publicaciones ajenas', function () {
        [$publisher1, $post] = createPublisherWithPost();
        $publisher2 = createHistoryPublisher();

        PostHistory::record($post->id, $publisher1->id, PostHistory::ACTION_CREATED);

        $response = $this->actingAs($publisher2)->getJson("/api/posts/{$post->id}/history");
        $response->assertStatus(403);
    });

    it('moderador ve historial de cualquier publicación', function () {
        [$publisher, $post] = createPublisherWithPost();

        $moderator = User::factory()->create(['status' => UserStatus::APPROVED->value]);
        $moderator->assignRole('moderador');

        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED);

        $response = $this->actingAs($moderator)->getJson("/api/posts/{$post->id}/history");
        $response->assertStatus(200);
    });
});

// ════════════════════════════════════════════════════════════════
// COMPARACIÓN DE VERSIONES
// ════════════════════════════════════════════════════════════════

describe('Comparación de versiones (GET /api/posts/{post}/history/compare)', function () {

    beforeEach(function () {
        setupHistoryRolesAndPermissions();
    });

    it('compara dos versiones y muestra diferencias', function () {
        [$publisher, $post] = createPublisherWithPost();

        $v1 = PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED, snapshot: [
            'name' => 'Título original',
            'content' => 'Contenido original',
        ]);

        $v2 = PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_EDITED, snapshot: [
            'name' => 'Título modificado',
            'content' => 'Contenido original',
        ]);

        $response = $this->actingAs($publisher)->getJson("/api/posts/{$post->id}/history/compare?version_a={$v1->id}&version_b={$v2->id}");

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $diff = $response->json('data.diff');
        expect($diff)->toHaveKey('name');
        expect($diff['name']['version_a'])->toBe('Título original');
        expect($diff['name']['version_b'])->toBe('Título modificado');
        expect($diff)->not->toHaveKey('content'); // sin cambios
    });
});

// ════════════════════════════════════════════════════════════════
// RESTAURACIÓN DE VERSIÓN
// ════════════════════════════════════════════════════════════════

describe('Restauración de versión (POST /api/posts/{post}/history/{history}/restore)', function () {

    beforeEach(function () {
        setupHistoryRolesAndPermissions();
    });

    it('restaura versión anterior en estado draft', function () {
        [$publisher, $post, $channel] = createPublisherWithPost();

        $v1 = PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED, snapshot: [
            'name'      => 'Título original',
            'content'   => 'Contenido original',
            'type'      => 'text',
            'status'    => 'draft',
            'channel_ids' => [$channel->id],
            'media_ids' => [],
        ]);

        // Modificar post
        $post->update(['name' => 'Título editado', 'content' => 'Contenido editado']);

        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/history/{$v1->id}/restore");

        $response->assertStatus(200)
            ->assertJson([
                'status'  => 'success',
                'message' => 'Versión restaurada correctamente. La publicación se encuentra en estado borrador.',
            ]);

        $post->refresh();
        expect($post->name)->toBe('Título original');
        expect($post->content)->toBe('Contenido original');
        expect($post->status)->toBe(PostStatus::DRAFT);

        // Verificar que se creó entrada de historial de restauración
        $lastHistory = PostHistory::where('post_id', $post->id)->orderByDesc('id')->first();
        expect($lastHistory->action)->toBe(PostHistory::ACTION_RESTORED_VERSION);
    });

    it('publicador no puede restaurar en estado no-draft', function () {
        [$publisher, $post] = createPublisherWithPost(PostStatus::PENDING_REVIEW->value);

        $v1 = PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED, snapshot: [
            'name' => 'Original',
            'content' => 'Content',
        ]);

        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/history/{$v1->id}/restore");

        $response->assertStatus(422)
            ->assertJson(['message' => 'Solo puede restaurar versiones de publicaciones en estado borrador.']);
    });

    it('admin puede restaurar en cualquier estado', function () {
        [$publisher, $post, $channel] = createPublisherWithPost(PostStatus::PUBLISHED->value);

        $admin = User::factory()->create(['status' => UserStatus::APPROVED->value]);
        $admin->assignRole('admin');

        $v1 = PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED, snapshot: [
            'name'      => 'Original',
            'content'   => 'Content',
            'type'      => 'text',
            'status'    => 'draft',
            'channel_ids' => [$channel->id],
            'media_ids' => [],
        ]);

        $response = $this->actingAs($admin)->postJson("/api/posts/{$post->id}/history/{$v1->id}/restore");

        $response->assertStatus(200);
        $post->refresh();
        expect($post->status)->toBe(PostStatus::DRAFT);
    });
});

// ════════════════════════════════════════════════════════════════
// EXPORTACIÓN DE HISTORIAL
// ════════════════════════════════════════════════════════════════

describe('Exportación de historial (GET /api/posts/{post}/history/export)', function () {

    beforeEach(function () {
        setupHistoryRolesAndPermissions();
    });

    it('exporta historial en formato CSV', function () {
        [$publisher, $post] = createPublisherWithPost();

        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_CREATED);
        PostHistory::record($post->id, $publisher->id, PostHistory::ACTION_EDITED, changes: ['name' => ['old' => 'a', 'new' => 'b']]);

        $response = $this->actingAs($publisher)->get("/api/posts/{$post->id}/history/export");

        $response->assertStatus(200);
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
    });
});
