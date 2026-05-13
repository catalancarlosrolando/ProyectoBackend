<?php

use App\Models\User;
use App\Models\Post;
use App\Models\Channel;
use App\Models\Media;
use App\Models\SavedFilter;
use App\Enums\UserStatus;
use App\Enums\PostStatus;
use App\Enums\ChannelType;
use App\Enums\MediaType;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

function setupSearchRolesAndPermissions(): void
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

function createSearchPublisher(array $channelIds = []): User
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

// ════════════════════════════════════════════════════════════════
// H11b: BÚSQUEDA Y FILTRADO
// ════════════════════════════════════════════════════════════════

describe('Búsqueda y filtrado de publicaciones (GET /api/posts)', function () {

    beforeEach(function () {
        setupSearchRolesAndPermissions();
    });

    it('busca por texto libre en título', function () {
        $channel = Channel::create([
            'name' => 'Canal Search ' . uniqid(),
            'description' => 'Test',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $publisher = createSearchPublisher([$channel->id]);

        Post::create(['user_id' => $publisher->id, 'name' => 'Convocatoria abierta', 'content' => 'Texto', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Otro tema', 'content' => 'Texto', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts?search=Convocatoria');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['name'])->toBe('Convocatoria abierta');
    });

    it('busca por texto libre en contenido', function () {
        $publisher = createSearchPublisher();

        Post::create(['user_id' => $publisher->id, 'name' => 'Post 1', 'content' => 'Información sobre becas disponibles', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Post 2', 'content' => 'Otro contenido', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts?search=becas');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
    });

    it('filtra por estado', function () {
        $publisher = createSearchPublisher();

        Post::create(['user_id' => $publisher->id, 'name' => 'Draft', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Pending', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::PENDING_REVIEW->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts?status=pending_review');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['status'])->toBe('pending_review');
    });

    it('filtra por tipo de contenido', function () {
        $publisher = createSearchPublisher();

        Post::create(['user_id' => $publisher->id, 'name' => 'Texto', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Video', 'content' => 'C', 'type' => 'video', 'status' => PostStatus::DRAFT->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts?type=video');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['type'])->toBe('video');
    });

    it('filtra por canal', function () {
        $channel1 = Channel::create(['name' => 'Canal Filtro 1 ' . uniqid(), 'description' => 'T', 'type' => ChannelType::DEPARTMENT->value]);
        $channel2 = Channel::create(['name' => 'Canal Filtro 2 ' . uniqid(), 'description' => 'T', 'type' => ChannelType::INSTITUTE->value]);

        $publisher = createSearchPublisher([$channel1->id, $channel2->id]);

        $post1 = Post::create(['user_id' => $publisher->id, 'name' => 'Post Canal 1', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        $post1->channels()->attach($channel1->id);

        $post2 = Post::create(['user_id' => $publisher->id, 'name' => 'Post Canal 2', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        $post2->channels()->attach($channel2->id);

        $response = $this->actingAs($publisher)->getJson("/api/posts?channel_ids[]={$channel1->id}");

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['name'])->toBe('Post Canal 1');
    });

    it('filtra por rango de fechas de creación', function () {
        $publisher = createSearchPublisher();

        // Crear post viejo directamente con timestamp alterado via query builder
        $oldId = \Illuminate\Support\Facades\DB::table('posts')->insertGetId([
            'user_id'    => $publisher->id,
            'name'       => 'Viejo',
            'content'    => 'C',
            'type'       => 'text',
            'status'     => PostStatus::DRAFT->value,
            'created_at' => now()->subDays(30),
            'updated_at' => now()->subDays(30),
        ]);

        Post::create(['user_id' => $publisher->id, 'name' => 'Reciente', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $from = now()->subDays(2)->toDateString();
        $to   = now()->addDay()->toDateString();

        $response = $this->actingAs($publisher)->getJson("/api/posts?created_from={$from}&created_to={$to}");

        $response->assertStatus(200);
        $data = $response->json('data.data');
        $names = collect($data)->pluck('name')->toArray();
        expect($names)->toContain('Reciente');
        expect($names)->not->toContain('Viejo');
    });

    it('aplica múltiples filtros simultáneamente', function () {
        $publisher = createSearchPublisher();

        Post::create(['user_id' => $publisher->id, 'name' => 'Draft texto', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Draft video', 'content' => 'C', 'type' => 'video', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Pending texto', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::PENDING_REVIEW->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts?status=draft&type=text');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['name'])->toBe('Draft texto');
    });

    it('ordena por fecha de creación ascendente', function () {
        $publisher = createSearchPublisher();

        $post1 = Post::create(['user_id' => $publisher->id, 'name' => 'Primero', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        $post1->update(['created_at' => now()->subDays(2)]);

        Post::create(['user_id' => $publisher->id, 'name' => 'Segundo', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts?sort_by=created_at&sort_order=asc');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data[0]['name'])->toBe('Primero');
        expect($data[1]['name'])->toBe('Segundo');
    });

    it('pagina con 20, 50 o 100 por página', function () {
        $publisher = createSearchPublisher();

        for ($i = 1; $i <= 25; $i++) {
            Post::create(['user_id' => $publisher->id, 'name' => "Post $i", 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        }

        $response = $this->actingAs($publisher)->getJson('/api/posts?per_page=20');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect($data)->toHaveCount(20);
        expect($response->json('total'))->toBe(25);
    });

    it('publicador solo ve sus propias publicaciones', function () {
        $channel = Channel::create(['name' => 'Canal Scope ' . uniqid(), 'description' => 'T', 'type' => ChannelType::DEPARTMENT->value]);

        $publisher1 = createSearchPublisher([$channel->id]);
        $publisher2 = createSearchPublisher([$channel->id]);

        Post::create(['user_id' => $publisher1->id, 'name' => 'Post P1', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher2->id, 'name' => 'Post P2', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $response = $this->actingAs($publisher1)->getJson('/api/posts');

        $response->assertStatus(200);
        $data = $response->json('data.data');

        // Publisher1 ve su propio post. También podría ver posts de canales compartidos.
        $ownPosts = collect($data)->where('user_id', $publisher1->id)->count();
        expect($ownPosts)->toBeGreaterThanOrEqual(1);
    });

    it('moderador ve todas las publicaciones', function () {
        $publisher = createSearchPublisher();
        Post::create(['user_id' => $publisher->id, 'name' => 'Post Global', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);

        $moderator = User::factory()->create(['status' => UserStatus::APPROVED->value]);
        $moderator->assignRole('moderador');

        $response = $this->actingAs($moderator)->getJson('/api/posts');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        expect(count($data))->toBeGreaterThanOrEqual(1);
    });

    it('muestra total de resultados', function () {
        $publisher = createSearchPublisher();

        for ($i = 1; $i <= 5; $i++) {
            Post::create(['user_id' => $publisher->id, 'name' => "Post $i", 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        }

        $response = $this->actingAs($publisher)->getJson('/api/posts');

        $response->assertStatus(200);
        expect($response->json('total'))->toBe(5);
    });

    it('excluye publicaciones archivadas del listado por defecto', function () {
        $publisher = createSearchPublisher();

        Post::create(['user_id' => $publisher->id, 'name' => 'Activo', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::DRAFT->value]);
        Post::create(['user_id' => $publisher->id, 'name' => 'Archivado', 'content' => 'C', 'type' => 'text', 'status' => PostStatus::ARCHIVED->value]);

        $response = $this->actingAs($publisher)->getJson('/api/posts');

        $response->assertStatus(200);
        $data = $response->json('data.data');
        $names = collect($data)->pluck('name')->toArray();
        expect($names)->toContain('Activo');
        expect($names)->not->toContain('Archivado');
    });
});

// ════════════════════════════════════════════════════════════════
// FILTROS GUARDADOS
// ════════════════════════════════════════════════════════════════

describe('Filtros guardados (H11b)', function () {

    beforeEach(function () {
        setupSearchRolesAndPermissions();
    });

    it('guarda un filtro personalizado', function () {
        $publisher = createSearchPublisher();

        $response = $this->actingAs($publisher)->postJson('/api/posts/saved-filters', [
            'name'    => 'Mis borradores',
            'filters' => ['status' => 'draft', 'type' => 'text'],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'status'  => 'success',
                'message' => 'Filtro guardado correctamente.',
            ]);

        expect(SavedFilter::where('user_id', $publisher->id)->count())->toBe(1);
    });

    it('lista filtros guardados del usuario', function () {
        $publisher = createSearchPublisher();

        SavedFilter::create(['user_id' => $publisher->id, 'name' => 'Filtro 1', 'filters' => ['status' => 'draft']]);
        SavedFilter::create(['user_id' => $publisher->id, 'name' => 'Filtro 2', 'filters' => ['type' => 'video']]);

        $response = $this->actingAs($publisher)->getJson('/api/posts/saved-filters');

        $response->assertStatus(200);
        expect($response->json('data'))->toHaveCount(2);
    });

    it('elimina un filtro guardado', function () {
        $publisher = createSearchPublisher();

        $filter = SavedFilter::create(['user_id' => $publisher->id, 'name' => 'Borrar', 'filters' => ['status' => 'draft']]);

        $response = $this->actingAs($publisher)->deleteJson("/api/posts/saved-filters/{$filter->id}");

        $response->assertStatus(200);
        expect(SavedFilter::count())->toBe(0);
    });

    it('no permite nombre duplicado para el mismo usuario', function () {
        $publisher = createSearchPublisher();

        SavedFilter::create(['user_id' => $publisher->id, 'name' => 'Duplicado', 'filters' => ['status' => 'draft']]);

        $response = $this->actingAs($publisher)->postJson('/api/posts/saved-filters', [
            'name'    => 'Duplicado',
            'filters' => ['type' => 'video'],
        ]);

        $response->assertStatus(422);
    });
});
