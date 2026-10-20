<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records the triple that produced the card, not just the resulting card_id.
 * Without this the fan's outfit and pose answers are unrecoverable after the
 * fact, so analytics can't break results down by dimension and a card that is
 * later re-pointed would silently rewrite history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->foreignId('outfit_option_id')->nullable()->after('card_id')
                ->constrained('options')->nullOnDelete();
            $table->foreignId('pose_option_id')->nullable()->after('outfit_option_id')
                ->constrained('options')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('outfit_option_id');
            $table->dropConstrainedForeignId('pose_option_id');
        });
    }
};
