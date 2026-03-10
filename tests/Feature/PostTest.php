<?php

use App\Models\User;
use App\Models\Post;
use App\Models\Channel;
use App\Models\Media;
use App\Enums\UserStatus;
use App\Enums\PostStatus;
use App\Enums\ChannelType;
use App\Enums\MediaType;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Helper: Crea roles y permisos necesarios para las pruebas de publicaciones.
 */
function setupPostRolesAndPermissions(): void
{
    app()[PermissionRegistrar::class]->forgetCachedPermissions();

    Permission::firstOrCreate(['name' => 'editar-contenido']);
    Permission::firstOrCreate(['name' => 'gestionar-usuarios']);
    Permission::firstOrCreate(['name' => 'acceder-panel-admin']);

    $rolePublicador = Role::firstOrCreate(['name' => 'publicador']);
    $rolePublicador->syncPermissions(['editar-contenido']);

    $roleAdmin = Role::firstOrCreate(['name' => 'admin']);
    $roleAdmin->syncPermissions(Permission::all());
}

/**
 * Helper: Crea un publicador con canales autorizados.
 */
function createPublisher(array $channelIds = []): User
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
// CREACIÓN DE PUBLICACIÓN (H09)
// ════════════════════════════════════════════════════════════════

describe('Creación de publicación (POST /api/posts)', function () {

    beforeEach(function () {
        setupPostRolesAndPermissions();
        Storage::fake('public');
    });

    it('requiere autenticación', function () {
        $response = $this->postJson('/api/posts', []);
        $response->assertStatus(401);
    });

    it('requiere permiso editar-contenido', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/posts', []);
        $response->assertStatus(403);
    });

    it('crea una publicación en estado borrador con datos válidos', function () {
        $channel = Channel::create([
            'name' => 'Canal Test',
            'description' => 'Descripción',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $media = Media::create([
            'name' => 'Pantalla Hall',
            'type' => MediaType::PHYSICAL_SCREEN->value,
            'is_active' => true,
        ]);

        // Asociar medio al canal
        $channel->medias()->attach($media->id);

        $publisher = createPublisher([$channel->id]);

        $response = $this->actingAs($publisher)->postJson('/api/posts', [
            'name'        => 'Mi primera publicación',
            'content'     => 'Contenido de prueba para la publicación.',
            'type'        => 'text',
            'channel_ids' => [$channel->id],
            'media_ids'   => [$media->id],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'status'  => 'success',
                'message' => 'Publicación creada correctamente en estado borrador.',
            ])
            ->assertJsonPath('data.status', PostStatus::DRAFT->value)
            ->assertJsonPath('data.name', 'Mi primera publicación')
            ->assertJsonPath('data.user_id', $publisher->id);

        // Verificar relaciones en BD
        $post = Post::first();
        expect($post->channels)->toHaveCount(1);
        expect($post->medias)->toHaveCount(1);
    });

    it('permite programar fecha y hora de publicación', function () {
        $channel = Channel::create([
            'name' => 'Canal Programado',
            'description' => 'Test',
            'type' => ChannelType::INSTITUTE->value,
        ]);

        $publisher = createPublisher([$channel->id]);
        $scheduledDate = now()->addDays(3)->toISOString();

        $response = $this->actingAs($publisher)->postJson('/api/posts', [
            'name'         => 'Publicación programada',
            'content'      => 'Contenido programado.',
            'type'         => 'text',
            'channel_ids'  => [$channel->id],
            'scheduled_at' => $scheduledDate,
        ]);

        $response->assertStatus(201);
        expect(Post::first()->scheduled_at)->not->toBeNull();
    });

    it('permite adjuntar archivos multimedia', function () {
        $channel = Channel::create([
            'name' => 'Canal Archivos',
            'description' => 'Test',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $publisher = createPublisher([$channel->id]);

        $response = $this->actingAs($publisher)->postJson('/api/posts', [
            'name'        => 'Publicación con archivos',
            'content'     => 'Contenido con adjuntos.',
            'type'        => 'multimedia',
            'channel_ids' => [$channel->id],
            'attachments' => [
                UploadedFile::fake()->image('foto.jpg', 800, 600),
                UploadedFile::fake()->create('video.mp4', 5000, 'video/mp4'),
            ],
        ]);

        $response->assertStatus(201);

        $post = Post::first();
        expect($post->attachments)->toHaveCount(2);

        // Verificar que los archivos existen en storage
        foreach ($post->attachments as $attachment) {
            Storage::disk('public')->assertExists($attachment->path);
        }
    });

    it('rechaza canales no autorizados al publicador', function () {
        $channelAutorizado = Channel::create([
            'name' => 'Canal Autorizado',
            'description' => 'Autorizado',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $canalNoAutorizado = Channel::create([
            'name' => 'Canal No Autorizado',
            'description' => 'No autorizado',
            'type' => ChannelType::SECRETARY->value,
        ]);

        $publisher = createPublisher([$channelAutorizado->id]);

        $response = $this->actingAs($publisher)->postJson('/api/posts', [
            'name'        => 'Publicación inválida',
            'content'     => 'Intento en canal no autorizado.',
            'type'        => 'text',
            'channel_ids' => [$channelAutorizado->id, $canalNoAutorizado->id],
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'status'  => 'error',
                'message' => 'No tiene autorización para publicar en uno o más canales seleccionados.',
            ]);

        expect(Post::count())->toBe(0);
    });

    it('permite seleccionar múltiples canales autorizados', function () {
        $channel1 = Channel::create([
            'name' => 'Canal Multi 1',
            'description' => 'Test 1',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $channel2 = Channel::create([
            'name' => 'Canal Multi 2',
            'description' => 'Test 2',
            'type' => ChannelType::INSTITUTE->value,
        ]);

        $publisher = createPublisher([$channel1->id, $channel2->id]);

        $response = $this->actingAs($publisher)->postJson('/api/posts', [
            'name'        => 'Publicación multicanal',
            'content'     => 'Publicación en varios canales.',
            'type'        => 'text',
            'channel_ids' => [$channel1->id, $channel2->id],
        ]);

        $response->assertStatus(201);
        expect(Post::first()->channels)->toHaveCount(2);
    });

    it('valida campos obligatorios', function () {
        $publisher = createPublisher();

        $response = $this->actingAs($publisher)->postJson('/api/posts', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'content', 'type', 'channel_ids']);
    });

    it('rechaza medios que no pertenecen a los canales seleccionados', function () {
        $channel = Channel::create([
            'name' => 'Canal Media Test',
            'description' => 'Test',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $mediaNoAsociado = Media::create([
            'name' => 'Medio Suelto',
            'type' => MediaType::SOCIAL_MEDIA->value,
            'is_active' => true,
        ]);

        $publisher = createPublisher([$channel->id]);

        $response = $this->actingAs($publisher)->postJson('/api/posts', [
            'name'        => 'Publicación con medio inválido',
            'content'     => 'Contenido.',
            'type'        => 'text',
            'channel_ids' => [$channel->id],
            'media_ids'   => [$mediaNoAsociado->id],
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'status'  => 'error',
                'message' => 'Uno o más medios seleccionados no pertenecen a los canales indicados.',
            ]);
    });
});

// ════════════════════════════════════════════════════════════════
// LISTADO DE PUBLICACIONES
// ════════════════════════════════════════════════════════════════

describe('Listado de publicaciones (GET /api/posts)', function () {

    beforeEach(function () {
        setupPostRolesAndPermissions();
    });

    it('requiere autenticación', function () {
        $response = $this->getJson('/api/posts');
        $response->assertStatus(401);
    });

    it('lista solo las publicaciones del usuario autenticado', function () {
        $channel = Channel::create([
            'name' => 'Canal List',
            'description' => 'Test',
            'type' => ChannelType::DEPARTMENT->value,
        ]);

        $publisher1 = createPublisher([$channel->id]);
        $publisher2 = createPublisher([$channel->id]);

        // Crear posts para ambos publicadores
        Post::create([
            'user_id' => $publisher1->id,
            'name'    => 'Post de publisher1',
            'content' => 'Contenido',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        Post::create([
            'user_id' => $publisher2->id,
            'name'    => 'Post de publisher2',
            'content' => 'Contenido',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher1)->getJson('/api/posts');

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        // Solo debe ver sus propias publicaciones
        $data = $response->json('data.data');
        expect($data)->toHaveCount(1);
        expect($data[0]['name'])->toBe('Post de publisher1');
    });
});

// ════════════════════════════════════════════════════════════════
// DETALLE DE PUBLICACIÓN
// ════════════════════════════════════════════════════════════════

describe('Detalle de publicación (GET /api/posts/{post})', function () {

    beforeEach(function () {
        setupPostRolesAndPermissions();
    });

    it('muestra el detalle de una publicación propia', function () {
        $publisher = createPublisher();

        $post = Post::create([
            'user_id' => $publisher->id,
            'name'    => 'Post detalle',
            'content' => 'Contenido detalle',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher)->getJson("/api/posts/{$post->id}");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data'   => ['name' => 'Post detalle'],
            ]);
    });

    it('no permite ver publicaciones de otro usuario', function () {
        $publisher1 = createPublisher();
        $publisher2 = createPublisher();

        $post = Post::create([
            'user_id' => $publisher1->id,
            'name'    => 'Post ajeno',
            'content' => 'Contenido',
            'type'    => 'text',
            'status'  => PostStatus::DRAFT->value,
        ]);

        $response = $this->actingAs($publisher2)->getJson("/api/posts/{$post->id}");

        $response->assertStatus(403)
            ->assertJson([
                'status'  => 'error',
                'message' => 'No tiene permiso para ver esta publicación.',
            ]);
    });
});
