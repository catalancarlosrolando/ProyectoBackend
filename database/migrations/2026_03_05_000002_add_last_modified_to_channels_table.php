<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channels', function (Blueprint $table) {
            $table->foreignId('last_modified_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('last_modified_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('channels', function (Blueprint $table) {
            $table->dropForeign(['last_modified_by']);
            $table->dropColumn(['last_modified_by', 'last_modified_at']);
        });
    }
};
