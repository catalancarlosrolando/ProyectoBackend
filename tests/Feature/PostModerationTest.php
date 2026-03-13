<?php

use App\Models\User;
use App\Models\Post;
use App\Models\Channel;
use App\Enums\UserStatus;
use App\Enums\PostStatus;
use App\Enums\ChannelType;
use App\Notifications\PostModeratedNotification;
use App\Notifications\PostStoppedNotification;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

function setupModerationRolesAndPermissions(): void
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

function createModerationPublisher(): User
{
    $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);
    $user->assignRole('publicador');
    return $user;
}

function createModerator(): User
{
    $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);
    $user->assignRole('moderador');
    return $user;
}

// ════════════════════════════════════════════════════════════════
// H13: MODERACIÓN
// ════════════════════════════════════════════════════════════════

describe('Moderación de publicaciones (H13)', function () {

    beforeEach(function () {
        setupModerationRolesAndPermissions();
    });

    it('publicador envía publicación a revisión (draft → pending_review)', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Para revisión',
            'content' => 'Contenido a moderar',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/submit");

        $response->assertStatus(200)
            ->assertJson([
                'status'  => 'success',
                'message' => 'Publicación enviada a moderación correctamente.',
            ]);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::PENDING_REVIEW);
    });

    it('moderador lista publicaciones pendientes de revisión', function () {
        $publisher = createModerationPublisher();
        $moderator = createModerator();

        Post::create(['user_id' => $publisher->id, 'name' => 'Pendiente 1', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::PENDING_REVIEW->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Pendiente 2', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::PENDING_REVIEW->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Draft', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $response = $this->actingAs($moderator)->getJson('/api/moderation/posts');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        $pendingNames = collect($data)->pluck('name')->toArray();
        expect($pendingNames)->toContain('Pendiente 1');
        expect($pendingNames)->toContain('Pendiente 2');
        expect($pendingNames)->not->toContain('Draft');
    });

    it('moderador aprueba publicación sin fecha programada → published', function () {
        Notification::fake();

        $publisher = createModerationPublisher();
        $moderator = createModerator();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Aprobar directa',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PENDING_REVIEW->value,
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/approve");

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::PUBLISHED);

        Notification::assertSentTo($publisher, PostModeratedNotification::class);
    });

    it('moderador aprueba publicación con fecha programada → scheduled', function () {
        Notification::fake();

        $publisher = createModerationPublisher();
        $moderator = createModerator();

        $post = Post::create([
            'user_id'      => $publisher->id,
            'name'         => 'Aprobar programada',
            'content'      => 'C',
            'type'         => 'text',
            'status'       => PostStatus::PENDING_REVIEW->value,
            'scheduled_at' => now()->addDays(3),
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/approve");

        $response->assertStatus(200);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::SCHEDULED);
    });

    it('moderador rechaza publicación con comentarios → draft', function () {
        Notification::fake();

        $publisher = createModerationPublisher();
        $moderator = createModerator();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Para rechazar',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PENDING_REVIEW->value,
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/reject", [
            'moderator_comments' => 'Falta mejorar el contenido, revisar ortografía.',
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::DRAFT);
        expect($post->moderator_comments)->toBe('Falta mejorar el contenido, revisar ortografía.');

        Notification::assertSentTo($publisher, PostModeratedNotification::class);
    });

    it('publicador NO puede acceder a endpoints de moderación', function () {
        $publisher = createModerationPublisher();

        $response = $this->actingAs($publisher)->getJson('/api/moderation/posts');

        $response->assertStatus(403);
    });

    it('rechazar requiere comentarios del moderador', function () {
        $publisher = createModerationPublisher();
        $moderator = createModerator();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Sin comentarios',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PENDING_REVIEW->value,
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/reject", []);

        $response->assertStatus(422);
    });
});

// ════════════════════════════════════════════════════════════════
// H14: DETENER PUBLICACIÓN EN DIFUSIÓN
// ════════════════════════════════════════════════════════════════

describe('Detener publicación en difusión (H14)', function () {

    beforeEach(function () {
        setupModerationRolesAndPermissions();
    });

    it('moderador detiene publicación publicada → draft', function () {
        Notification::fake();

        $publisher = createModerationPublisher();
        $moderator = createModerator();

        $post = Post::create([
            'user_id'      => $publisher->id,
            'name'         => 'Publicada',
            'content'      => 'C',
            'type'         => 'text',
            'status'       => PostStatus::PUBLISHED->value,
            'published_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/stop", [
            'confirm' => true,
            'reason'  => 'Contenido inapropiado detectado.',
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::DRAFT);

        Notification::assertSentTo($publisher, PostStoppedNotification::class);
    });

    it('propietario puede detener su propia publicación', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id'      => $publisher->id,
            'name'         => 'Mi publicación',
            'content'      => 'C',
            'type'         => 'text',
            'status'       => PostStatus::PUBLISHED->value,
            'published_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($publisher)->postJson("/api/moderation/posts/{$post->id}/stop", [
            'confirm' => true,
            'reason'  => 'Necesito corregir datos.',
        ]);

        $response->assertStatus(200);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::DRAFT);
    });

    it('detener requiere confirmación explícita', function () {
        $moderator = createModerator();
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id'      => $publisher->id,
            'name'         => 'Sin confirm',
            'content'      => 'C',
            'type'         => 'text',
            'status'       => PostStatus::PUBLISHED->value,
            'published_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/stop", [
            'reason' => 'Urgente',
        ]);

        $response->assertStatus(422);
    });

    it('detener requiere razón obligatoria', function () {
        $moderator = createModerator();
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Sin razón',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PUBLISHED->value,
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/stop", [
            'confirm' => true,
        ]);

        $response->assertStatus(422);
    });

    it('no se puede detener una publicación que no está publicada', function () {
        $moderator = createModerator();
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Borrador',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/moderation/posts/{$post->id}/stop", [
            'confirm' => true,
            'reason'  => 'Intento inválido',
        ]);

        $response->assertStatus(422);
    });
});

// ════════════════════════════════════════════════════════════════
// H10: EDICIÓN + H11: ELIMINACIÓN + H12: ARCHIVADO
// ════════════════════════════════════════════════════════════════

describe('Edición de publicaciones (H10)', function () {

    beforeEach(function () {
        setupModerationRolesAndPermissions();
    });

    it('publicador edita su publicación en borrador', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Título original',
            'content' => 'Contenido original',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->putJson("/api/posts/{$post->id}", [
            'name'    => 'Título modificado',
            'content' => 'Contenido actualizado',
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $post->refresh();
        expect($post->name)->toBe('Título modificado');
        expect($post->content)->toBe('Contenido actualizado');
    });

    it('no permite editar publicación que no está en borrador', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Publicada',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PUBLISHED->value,
        ]);

        $response = $this->actingAs($publisher)->putJson("/api/posts/{$post->id}", [
            'name' => 'Nuevo título',
        ]);

        $response->assertStatus(422);
    });

    it('revertir a borrador permite posterior edición', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id'      => $publisher->id,
            'name'         => 'Pendiente',
            'content'      => 'C',
            'type'         => 'text',
            'status'       => PostStatus::PENDING_REVIEW->value,
        ]);

        // Revertir a draft
        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/revert-to-draft");
        $response->assertStatus(200);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::DRAFT);

        // Ahora puede editar
        $response = $this->actingAs($publisher)->putJson("/api/posts/{$post->id}", [
            'name' => 'Editado después de revertir',
        ]);
        $response->assertStatus(200);
    });
});

describe('Eliminación de publicaciones (H11)', function () {

    beforeEach(function () {
        setupModerationRolesAndPermissions();
    });

    it('publicador elimina (soft delete) su publicación en borrador', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'A eliminar',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->deleteJson("/api/posts/{$post->id}", [
            'reason' => 'Ya no es necesaria esta publicación.',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status'  => 'success',
                'data'    => null,
                'message' => 'Publicación eliminada correctamente.',
            ]);

        expect((string) $response->headers->get('content-type'))->toContain('application/json');

        expect($response->headers->get('Connection'))->toBeNull();

        expect(Post::find($post->id))->toBeNull();
        expect(Post::withTrashed()->find($post->id))->not->toBeNull();
    });

    it('no permite eliminar publicación publicada', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Publicada',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PUBLISHED->value,
        ]);

        $response = $this->actingAs($publisher)->deleteJson("/api/posts/{$post->id}", [
            'reason' => 'Intento inválido',
        ]);

        $response->assertStatus(422);
    });

    it('eliminar requiere razón', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Sin razón',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->deleteJson("/api/posts/{$post->id}", []);

        $response->assertStatus(422);
    });

    it('permite eliminar enviando razón por query string (sin body)', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Query reason',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->deleteJson(
            "/api/posts/{$post->id}?reason=" . urlencode('Borrado desde query')
        );

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success');

        expect(Post::find($post->id))->toBeNull();
    });
});

describe('Archivado de publicaciones (H12)', function () {

    beforeEach(function () {
        setupModerationRolesAndPermissions();
    });

    it('archiva publicación publicada', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id'      => $publisher->id,
            'name'         => 'A archivar',
            'content'      => 'C',
            'type'         => 'text',
            'status'       => PostStatus::PUBLISHED->value,
            'published_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/archive", [
            'confirm' => true,
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::ARCHIVED);
        expect($post->archived_by)->toBe($publisher->id);
        expect($post->archived_at)->not->toBeNull();
    });

    it('no permite archivar publicación en borrador', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Borrador',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/archive", [
            'confirm' => true,
        ]);

        $response->assertStatus(422);
    });

    it('moderador desarchiva publicación → draft', function () {
        $publisher = createModerationPublisher();
        $moderator = createModerator();

        $post = Post::create([
            'user_id'     => $publisher->id,
            'name'        => 'Archivada',
            'content'     => 'C',
            'type'        => 'text',
            'status'      => PostStatus::ARCHIVED->value,
            'archived_by' => $moderator->id,
            'archived_at' => now(),
        ]);

        $response = $this->actingAs($moderator)->postJson("/api/posts/{$post->id}/unarchive");

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        $post->refresh();
        expect($post->status)->toBe(PostStatus::DRAFT);
        expect($post->archived_by)->toBeNull();
        expect($post->archived_at)->toBeNull();
    });

    it('archivar requiere confirmación', function () {
        $publisher = createModerationPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Sin confirm',
            'content' => 'C',
            'type'    => 'text',
            'status'  => PostStatus::PUBLISHED->value,
        ]);

        $response = $this->actingAs($publisher)->postJson("/api/posts/{$post->id}/archive", []);

        $response->assertStatus(422);
    });
});
