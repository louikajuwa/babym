<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('Draft');
            $table->boolean('gate_enabled')->default(true);
            $table->string('hashtag')->nullable();
            $table->text('share_copy')->nullable();
            $table->boolean('show_copy_link')->default(true);
            $table->boolean('show_download')->default(true);
            $table->boolean('esign_enabled')->default(false);
            // Freeform branding/copy overrides (design palette, copy/fields/channels
            // overrides, logo/hero/bg images, headline/tagline/etc) — these started life
            // as ad-hoc Object.assign'd properties on the mock quiz object with no fixed
            // shape, so a JSON bag mirrors that instead of a wide, mostly-null column set.
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quizzes');
    }
};
