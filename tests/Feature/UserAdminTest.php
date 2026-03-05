<?php

use App\Models\User;
use App\Enums\UserStatus;
use App\Models\UserStatusHistory;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Illuminate\Support\Facades\Notification;
use App\Notifications\UserStatusChangeNotification;

/**
 * Helper: Crea roles y permisos necesarios para las pruebas.
 */
function setupRolesAndPermissions(): void
{
    app()[PermissionRegistrar::class]->forgetCachedPermissions();

    $permissions = [
        'acceder-panel-admin',
        'gestionar-usuarios',
        'editar-contenido',
        'eliminar-contenido',
        'ver-reportes',
    ];

    foreach ($permissions as $permission) {
        Permission::firstOrCreate(['name' => $permission]);
    }

    $roleUser = Role::firstOrCreate(['name' => 'publicador']);
    $roleUser->syncPermissions(['editar-contenido']);

    $roleModerator = Role::firstOrCreate(['name' => 'moderador']);
    $roleModerator->syncPermissions(['editar-contenido', 'eliminar-contenido', 'ver-reportes']);

    //$roleVerified = Role::firstOrCreate(['name' => 'verified']);
    //$roleVerified->syncPermissions(['acceder-panel-admin']);

    $roleAdmin = Role::firstOrCreate(['name' => 'admin']);
    $roleAdmin->syncPermissions(Permission::all());
}

/**
 * Helper: Crea un usuario admin autenticado.
 */
function createAdmin(): User
{
    $admin = User::factory()->create(['status' => UserStatus::APPROVED->value]);
    $admin->assignRole('admin');
    return $admin;
}

/**
 * Helper: Crea un usuario normal registrado.
 */
function createRegisteredUser(array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'status' => UserStatus::REGISTERED->value,
    ], $overrides));
}

// ════════════════════════════════════════════════════════════════
// LISTADO DE USUARIOS
// ════════════════════════════════════════════════════════════════

describe('Listado de usuarios (GET /api/admin/users)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
    });

    it('requiere autenticación', function () {
        $response = $this->getJson('/api/admin/users');
        $response->assertStatus(401);
    });

    it('requiere permiso gestionar-usuarios', function () {
        $user = User::factory()->create();
        $user->assignRole('publicador');

        $response = $this->actingAs($user)->getJson('/api/admin/users');
        $response->assertStatus(403);
    });

    it('lista usuarios paginados', function () {
        $admin = createAdmin();
        User::factory()->count(5)->create(['status' => UserStatus::REGISTERED->value]);

        $response = $this->actingAs($admin)->getJson('/api/admin/users');

        $response->assertStatus(200)
            ->assertJson(['status' => 'success'])
            ->assertJsonStructure([
                'data' => [
                    'users' => [['id', 'name', 'email', 'status', 'roles']],
                    'pagination' => ['current_page', 'last_page', 'per_page', 'total'],
                ],
            ]);

        // 5 creados + 1 admin = 6
        expect($response->json('data.pagination.total'))->toBe(6);
    });

    it('filtra por estado', function () {
        $admin = createAdmin();
        User::factory()->count(3)->create(['status' => UserStatus::REGISTERED->value]);
        User::factory()->count(2)->create(['status' => UserStatus::APPROVED->value]);

        $response = $this->actingAs($admin)->getJson('/api/admin/users?status=registered');

        $response->assertStatus(200);
        $users = $response->json('data.users');
        foreach ($users as $user) {
            expect($user['status'])->toBe('registered');
        }
    });

    it('filtra por rol', function () {
        $admin = createAdmin();
        $moderator = User::factory()->create();
        $moderator->assignRole('moderador');
        User::factory()->count(2)->create();

        $response = $this->actingAs($admin)->getJson('/api/admin/users?role=moderador');

        $response->assertStatus(200);
        expect($response->json('data.pagination.total'))->toBe(1);
    });

    it('filtra por email parcial', function () {
        $admin = createAdmin();
        User::factory()->create(['email' => 'juan.perez@example.com']);
        User::factory()->create(['email' => 'maria.garcia@example.com']);

        $response = $this->actingAs($admin)->getJson('/api/admin/users?email=juan.perez');

        $response->assertStatus(200);
        expect($response->json('data.pagination.total'))->toBe(1);
    });

    it('filtra por nombre parcial', function () {
        $admin = createAdmin();
        User::factory()->create(['name' => 'Juan Carlos Pérez']);
        User::factory()->create(['name' => 'María García López']);

        $response = $this->actingAs($admin)->getJson('/api/admin/users?name=Juan Carlos');

        $response->assertStatus(200);
        $users = $response->json('data.users');
        expect(count($users))->toBeGreaterThanOrEqual(1);
    });

    it('filtra por DNI', function () {
        $admin = createAdmin();
        User::factory()->create(['dni' => '12345678A']);
        User::factory()->create(['dni' => '87654321B']);

        $response = $this->actingAs($admin)->getJson('/api/admin/users?dni=12345678A');

        $response->assertStatus(200);
        expect($response->json('data.pagination.total'))->toBe(1);
    });

    it('filtra por rango de fecha de registro', function () {
        $admin = createAdmin();
        User::factory()->create(['created_at' => now()->subDays(10)]);
        User::factory()->create(['created_at' => now()->subDays(5)]);
        User::factory()->create(['created_at' => now()->subDays(1)]);

        $from = now()->subDays(6)->format('Y-m-d');
        $to = now()->subDays(4)->format('Y-m-d');

        $response = $this->actingAs($admin)->getJson("/api/admin/users?registered_from={$from}&registered_to={$to}");

        $response->assertStatus(200);
        expect($response->json('data.pagination.total'))->toBe(1);
    });

    it('ordena por campo y dirección', function () {
        $admin = createAdmin();
        User::factory()->create(['name' => 'Aaaaa', 'email' => 'aaaa@test.com']);
        User::factory()->create(['name' => 'Zzzzz', 'email' => 'zzzz@test.com']);

        $response = $this->actingAs($admin)->getJson('/api/admin/users?sort_by=name&sort_order=asc');

        $response->assertStatus(200);
        $users = $response->json('data.users');
        expect($users[0]['name'])->toBe('Aaaaa');
    });

    it('permite cambiar per_page', function () {
        $admin = createAdmin();
        User::factory()->count(25)->create();

        $response = $this->actingAs($admin)->getJson('/api/admin/users?per_page=50');

        $response->assertStatus(200);
        expect($response->json('data.pagination.per_page'))->toBe(50);
    });

    it('rechaza per_page inválido', function () {
        $admin = createAdmin();

        $response = $this->actingAs($admin)->getJson('/api/admin/users?per_page=99');

        $response->assertStatus(422);
    });
});

// ════════════════════════════════════════════════════════════════
// DETALLE DE USUARIO
// ════════════════════════════════════════════════════════════════

describe('Detalle de usuario (GET /api/admin/users/{user})', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
    });

    it('muestra el detalle de un usuario', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::REGISTERED->value, 'dni' => '11111111A']);
        $user->assignRole('publicador');

        $response = $this->actingAs($admin)->getJson("/api/admin/users/{$user->id}");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'status' => 'registered',
                        'dni' => '11111111A',
                        'roles' => ['user'],
                    ],
                ],
            ]);
    });

    it('devuelve 404 si el usuario no existe', function () {
        $admin = createAdmin();

        $response = $this->actingAs($admin)->getJson('/api/admin/users/99999');

        $response->assertStatus(404);
    });
});

// ════════════════════════════════════════════════════════════════
// APROBAR USUARIO
// ════════════════════════════════════════════════════════════════

describe('Aprobar usuario (POST /api/admin/users/{user}/approve)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
        Notification::fake();
    });

    it('aprueba un usuario registrado', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => ['user' => ['status' => 'approved']],
            ]);

        expect($user->fresh()->status)->toBe(UserStatus::APPROVED);
    });

    it('registra historial al aprobar', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve");

        $history = UserStatusHistory::where('user_id', $user->id)->first();
        expect($history)->not->toBeNull();
        expect($history->action)->toBe(UserStatusHistory::ACTION_STATUS_CHANGE);
        expect($history->old_value)->toBe('registered');
        expect($history->new_value)->toBe('approved');
        expect($history->changed_by)->toBe($admin->id);
    });

    it('envía notificación al aprobar', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve");

        Notification::assertSentTo($user, UserStatusChangeNotification::class);
    });

    it('no permite aprobar un usuario ya aprobado', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve");

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    });
});

// ════════════════════════════════════════════════════════════════
// RECHAZAR USUARIO
// ════════════════════════════════════════════════════════════════

describe('Rechazar usuario (POST /api/admin/users/{user}/reject)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
        Notification::fake();
    });

    it('rechaza un usuario registrado con motivo', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/reject", [
            'reason' => 'Documentación incompleta',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => ['user' => ['status' => 'deleted']],
            ]);

        $user->refresh();
        expect($user->status)->toBe(UserStatus::DELETED);
        expect($user->rejection_reason)->toBe('Documentación incompleta');
    });

    it('registra historial al rechazar con motivo', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/reject", [
            'reason' => 'Datos inválidos',
        ]);

        $history = UserStatusHistory::where('user_id', $user->id)->first();
        expect($history)->not->toBeNull();
        expect($history->reason)->toBe('Datos inválidos');
        expect($history->new_value)->toBe('deleted');
    });

    it('envía notificación al rechazar', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/reject");

        Notification::assertSentTo($user, UserStatusChangeNotification::class);
    });

    it('no permite rechazar un usuario ya rechazado', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::DELETED->value]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/reject");

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    });
});

// ════════════════════════════════════════════════════════════════
// DESHABILITAR USUARIO
// ════════════════════════════════════════════════════════════════

describe('Deshabilitar usuario (POST /api/admin/users/{user}/disable)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
        Notification::fake();
    });

    it('deshabilita una cuenta aprobada', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/disable", [
            'reason' => 'Comportamiento inadecuado',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => ['user' => ['status' => 'disabled']],
            ]);

        expect($user->fresh()->status)->toBe(UserStatus::DISABLED);
    });

    it('invalida todas las sesiones/tokens del usuario deshabilitado', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);

        // Crear tokens para el usuario
        $user->createToken('test-token-1');
        $user->createToken('test-token-2');
        expect($user->tokens()->count())->toBe(2);

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/disable");

        expect($user->tokens()->count())->toBe(0);
    });

    it('no permite al admin deshabilitarse a sí mismo', function () {
        $admin = createAdmin();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$admin->id}/disable");

        $response->assertStatus(403)
            ->assertJson(['status' => 'error']);
    });

    it('no permite deshabilitar un usuario ya deshabilitado', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::DISABLED->value]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/disable");

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    });

    it('envía notificación al deshabilitar', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/disable");

        Notification::assertSentTo($user, UserStatusChangeNotification::class);
    });

    it('registra historial al deshabilitar', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::APPROVED->value]);

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/disable", [
            'reason' => 'Infracción grave',
        ]);

        $history = UserStatusHistory::where('user_id', $user->id)->first();
        expect($history)->not->toBeNull();
        expect($history->action)->toBe(UserStatusHistory::ACTION_DISABLED);
        expect($history->reason)->toBe('Infracción grave');
    });
});

// ════════════════════════════════════════════════════════════════
// HABILITAR USUARIO
// ════════════════════════════════════════════════════════════════

describe('Habilitar usuario (POST /api/admin/users/{user}/enable)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
        Notification::fake();
    });

    it('habilita un usuario deshabilitado', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::DISABLED->value]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/enable");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => ['user' => ['status' => 'approved']],
            ]);

        expect($user->fresh()->status)->toBe(UserStatus::APPROVED);
    });

    it('no permite habilitar un usuario que no está deshabilitado', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::REGISTERED->value]);

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/enable");

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    });

    it('registra historial al habilitar', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::DISABLED->value]);

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/enable");

        $history = UserStatusHistory::where('user_id', $user->id)->first();
        expect($history)->not->toBeNull();
        expect($history->action)->toBe(UserStatusHistory::ACTION_ENABLED);
    });

    it('envía notificación al habilitar', function () {
        $admin = createAdmin();
        $user = User::factory()->create(['status' => UserStatus::DISABLED->value]);

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/enable");

        Notification::assertSentTo($user, UserStatusChangeNotification::class);
    });
});

// ════════════════════════════════════════════════════════════════
// ASIGNAR ROL
// ════════════════════════════════════════════════════════════════

describe('Asignar rol (POST /api/admin/users/{user}/assign-role)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
    });

    it('asigna un rol a un usuario', function () {
        $admin = createAdmin();
        $user = User::factory()->create();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/assign-role", [
            'role' => 'moderador',
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        expect($user->fresh()->hasRole('moderador'))->toBeTrue();
    });

    it('registra historial al asignar rol', function () {
        $admin = createAdmin();
        $user = User::factory()->create();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/assign-role", [
            'role' => 'moderador',
        ]);

        $history = UserStatusHistory::where('user_id', $user->id)->first();
        expect($history)->not->toBeNull();
        expect($history->action)->toBe(UserStatusHistory::ACTION_ROLE_ASSIGNED);
        expect($history->new_value)->toBe('moderador');
    });

    it('no permite asignar un rol que ya tiene', function () {
        $admin = createAdmin();
        $user = User::factory()->create();
        $user->assignRole('moderador');

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/assign-role", [
            'role' => 'moderador',
        ]);

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    });

    it('valida que el rol sea obligatorio', function () {
        $admin = createAdmin();
        $user = User::factory()->create();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/assign-role", []);

        $response->assertStatus(422);
    });

    it('valida que el rol exista en la base de datos', function () {
        $admin = createAdmin();
        $user = User::factory()->create();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/assign-role", [
            'role' => 'rol-inexistente',
        ]);

        $response->assertStatus(422);
    });
});

// ════════════════════════════════════════════════════════════════
// REVOCAR ROL
// ════════════════════════════════════════════════════════════════

describe('Revocar rol (POST /api/admin/users/{user}/revoke-role)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
    });

    it('revoca un rol de un usuario', function () {
        $admin = createAdmin();
        $user = User::factory()->create();
        $user->assignRole('moderador');

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/revoke-role", [
            'role' => 'moderador',
        ]);

        $response->assertStatus(200)
            ->assertJson(['status' => 'success']);

        expect($user->fresh()->hasRole('moderador'))->toBeFalse();
    });

    it('registra historial al revocar rol', function () {
        $admin = createAdmin();
        $user = User::factory()->create();
        $user->assignRole('moderador');

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/revoke-role", [
            'role' => 'moderador',
        ]);

        $history = UserStatusHistory::where('user_id', $user->id)->first();
        expect($history)->not->toBeNull();
        expect($history->action)->toBe(UserStatusHistory::ACTION_ROLE_REVOKED);
        expect($history->old_value)->toBe('moderador');
    });

    it('no permite revocar un rol que no tiene', function () {
        $admin = createAdmin();
        $user = User::factory()->create();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/revoke-role", [
            'role' => 'moderador',
        ]);

        $response->assertStatus(422)
            ->assertJson(['status' => 'error']);
    });

    it('no permite al admin revocar su propio rol admin', function () {
        $admin = createAdmin();

        $response = $this->actingAs($admin)->postJson("/api/admin/users/{$admin->id}/revoke-role", [
            'role' => 'admin',
        ]);

        $response->assertStatus(403)
            ->assertJson(['status' => 'error']);
    });
});

// ════════════════════════════════════════════════════════════════
// HISTORIAL DE CAMBIOS
// ════════════════════════════════════════════════════════════════

describe('Historial de cambios (GET /api/admin/users/{user}/history)', function () {

    beforeEach(function () {
        setupRolesAndPermissions();
        Notification::fake();
    });

    it('devuelve el historial de cambios de un usuario', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        // Generar historial: aprobar + asignar rol
        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve");
        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/assign-role", ['role' => 'user']);

        $response = $this->actingAs($admin)->getJson("/api/admin/users/{$user->id}/history");

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'user_id' => $user->id,
                ],
            ]);

        $history = $response->json('data.history');
        expect(count($history))->toBe(2);
    });

    it('el historial incluye información del admin que realizó el cambio', function () {
        $admin = createAdmin();
        $user = createRegisteredUser();

        $this->actingAs($admin)->postJson("/api/admin/users/{$user->id}/approve");

        $response = $this->actingAs($admin)->getJson("/api/admin/users/{$user->id}/history");

        $history = $response->json('data.history');
        expect($history[0]['changed_by']['id'])->toBe($admin->id);
        expect($history[0]['changed_by']['name'])->toBe($admin->name);
    });

    it('historial vacío para usuario sin cambios', function () {
        $admin = createAdmin();
        $user = User::factory()->create();

        $response = $this->actingAs($admin)->getJson("/api/admin/users/{$user->id}/history");

        $response->assertStatus(200);
        expect($response->json('data.history'))->toBeEmpty();
    });
});
