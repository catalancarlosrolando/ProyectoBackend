<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migración para gestión de usuarios por administrador.
     *
     * Agrega campos de estado, DNI y último acceso a la tabla users.
     * Crea tabla de historial de cambios de estado de usuario.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('status', 30)->default('registered')->after('semantic_context');
            $table->string('dni', 20)->nullable()->after('status');
            $table->timestamp('last_access_at')->nullable()->after('dni');
            $table->text('rejection_reason')->nullable()->after('last_access_at');

            $table->index('status');
            $table->index('dni');
            $table->index('last_access_at');
        });

        Schema::create('user_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('changed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->string('action', 50); // status_change, role_assigned, role_revoked, enabled, disabled
            $table->string('old_value')->nullable();
            $table->string('new_value')->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_status_histories');

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['dni']);
            $table->dropIndex(['last_access_at']);
            $table->dropColumn(['status', 'dni', 'last_access_at', 'rejection_reason']);
        });
    }
};
