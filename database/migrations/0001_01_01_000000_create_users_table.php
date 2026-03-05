<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migración consolidada de la tabla users.
     *
     * Incluye todos los campos:
     * - Campos base: name, email, password
     * - Campos de perfil: first_name, last_name, mobile, semantic_context
     * - Campos de administración: status, dni, last_access_at, rejection_reason
     *
     * También crea: password_reset_tokens, sessions, user_status_histories
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();

            // Datos personales
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('name');
            $table->string('email')->unique();
            $table->string('mobile', 100)->nullable();
            $table->text('semantic_context')->nullable();

            // Autenticación
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();

            // Gestión administrativa
            $table->string('status', 30)->default('registered');
            $table->string('dni', 20)->nullable();
            $table->timestamp('last_access_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->timestamps();

            // Índices
            $table->index('status');
            $table->index('dni');
            $table->index('last_access_at');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
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
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
