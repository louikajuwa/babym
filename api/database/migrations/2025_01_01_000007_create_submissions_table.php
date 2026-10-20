<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->foreignId('result_character_id')->nullable()->constrained('characters')->nullOnDelete();
            $table->foreignId('card_id')->nullable()->constrained('character_cards')->nullOnDelete();
            $table->string('name');
            $table->string('email');
            $table->string('source')->nullable();
            $table->json('consent')->nullable();
            $table->unsignedInteger('time_spent_seconds')->default(0);
            $table->string('session_id')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamps();

            $table->index(['quiz_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};
