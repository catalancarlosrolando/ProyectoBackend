<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (Role::count() > 2) {
            return;
        }

        // Resetear caché de roles y permisos
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Crear permisos
        $permissions = [
            'acceder-panel-admin',
            'gestionar-usuarios',
            'editar-contenido',
            'eliminar-contenido',
            'ver-reportes',
            'ver-perfil',
            'gestionar-canales',
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Crear roles y asignar permisos

        // Rol: publicador (usuario básico que puede ingresar y ver su perfil)
        $rolePublicador = Role::create(['name' => 'invitado']);
        $rolePublicador->givePermissionTo(['ver-perfil']);

        // Rol: publicador (usuario básico que puede publicar contenido)
        $rolePublicador = Role::create(['name' => 'publicador']);
        $rolePublicador->givePermissionTo(['editar-contenido']);

        // Rol: moderador (modera contenido y ve reportes)
        $roleModerador = Role::create(['name' => 'moderador']);
        $roleModerador->givePermissionTo(['editar-contenido', 'eliminar-contenido', 'ver-reportes']);

        // Rol: admin (acceso total)
        $roleAdmin = Role::create(['name' => 'admin']);
        $roleAdmin->givePermissionTo(Permission::all());
    }
}
