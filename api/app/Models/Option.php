<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Fillable(['question_id', 'badge', 'label', 'sub', 'img', 'scores', 'order'])]
class Option extends Model
{
    protected function casts(): array
    {
        return ['scores' => 'array'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'badge' => $this->badge,
            'label' => $this->label,
            'sub' => $this->sub,
            'img' => $this->img ? Storage::url($this->img) : null,
            'scores' => $this->scores ?? [],
        ];
    }
}
