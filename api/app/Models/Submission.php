<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'quiz_id', 'result_character_id', 'card_id', 'outfit_option_id', 'pose_option_id',
    'name', 'email', 'source', 'consent', 'time_spent_seconds', 'session_id', 'ip_address',
])]
class Submission extends Model
{
    protected function casts(): array
    {
        return ['consent' => 'array'];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function resultCharacter(): BelongsTo
    {
        return $this->belongsTo(Character::class, 'result_character_id');
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(CharacterCard::class, 'card_id');
    }

    public function outfitOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'outfit_option_id');
    }

    public function poseOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'pose_option_id');
    }

    public function toApiArray(): array
    {
        $char = $this->resultCharacter;

        return [
            'id' => $this->id,
            'quizId' => $this->quiz_id,
            'name' => $this->name,
            'email' => $this->email,
            'result' => $char?->name ?? '—',
            'resultKey' => $char?->key,
            'cardId' => $this->card_id ? (string) $this->card_id : null,
            // The triple that produced the card. Shipped over the socket too, so a
            // live-arriving row matches exactly what a page refresh would render.
            'outfitId' => $this->outfit_option_id ? (string) $this->outfit_option_id : null,
            'poseId' => $this->pose_option_id ? (string) $this->pose_option_id : null,
            'outfit' => $this->outfitOption?->label,
            'pose' => $this->poseOption?->label,
            'color' => $char?->color ?? '#8a6bff',
            'date' => $this->created_at->format('M j, Y'),
            'source' => $this->source,
            'consent' => $this->consent ?? [],
            'timeSpent' => $this->time_spent_seconds,
        ];
    }
}
