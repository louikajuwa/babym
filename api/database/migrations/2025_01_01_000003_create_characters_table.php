<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('name');
            $table->string('initial', 4);
            $table->string('color_name');
            $table->string('color');
            $table->string('grad');
            $table->text('blurb')->nullable();
            $table->text('why')->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();

            $table->unique(['quiz_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
