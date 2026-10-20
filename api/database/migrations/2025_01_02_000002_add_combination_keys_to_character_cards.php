<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gives a card its two missing dimensions. Until now a card was only "a pose",
 * identified by a free-text caption, so the schema literally could not express
 * "this image is RUKA in outfit 2, pose 3" — the outfit the fan picked was
 * discarded at submit time.
 *
 * The composite unique key is the structural guarantee against duplicate or
 * ambiguous mappings: exactly one card per (member, outfit, pose) triple. This
 * table previously had no index of any kind.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('character_cards', function (Blueprint $table) {
            $table->foreignId('outfit_option_id')->nullable()->after('character_id')
                ->constrained('options')->cascadeOnDelete();
            $table->foreignId('pose_option_id')->nullable()->after('outfit_option_id')
                ->constrained('options')->cascadeOnDelete();
            $table->unique(['character_id', 'outfit_option_id', 'pose_option_id'], 'character_cards_triple_unique');
        });
    }

    public function down(): void
    {
        Schema::table('character_cards', function (Blueprint $table) {
            $table->dropUnique('character_cards_triple_unique');
            $table->dropConstrainedForeignId('outfit_option_id');
            $table->dropConstrainedForeignId('pose_option_id');
        });
    }
};
