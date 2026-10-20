<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $table->string('visitor_id')->nullable();
            $table->string('event_type'); // view | start | question_reached | gate_reached | complete
            $table->unsignedInteger('question_index')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['quiz_id', 'event_type']);
            $table->index(['quiz_id', 'visitor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
