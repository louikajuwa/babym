<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A quiz now explicitly designates which two questions drive the card matrix's
 * visual dimensions. Previously "the outfit question" was inferred as whichever
 * question had layout='grid' (capped at one, and only in JavaScript), which made
 * the binding ambiguous and unenforceable server-side.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->foreignId('outfit_question_id')->nullable()->after('esign_enabled')
                ->constrained('questions')->nullOnDelete();
            $table->foreignId('pose_question_id')->nullable()->after('outfit_question_id')
                ->constrained('questions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('outfit_question_id');
            $table->dropConstrainedForeignId('pose_question_id');
        });
    }
};
