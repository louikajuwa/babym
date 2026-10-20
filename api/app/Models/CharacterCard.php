<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Fillable(['character_id', 'outfit_option_id', 'pose_option_id', 'photo_path', 'caption', 'order'])]
class CharacterCard extends Model
{
    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function outfitOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'outfit_option_id');
    }

    public function poseOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'pose_option_id');
    }

    public function photoUrl(): ?string
    {
        return $this->photo_path ? Storage::url($this->photo_path) : null;
    }

    /**
     * The caption an admin typed, or a generated one naming the slot's two
     * dimensions ("All-black & edgy - Polaroid") so every card in the matrix is
     * identifiable on the result screen even before anyone writes copy for it.
     */
    public function displayCaption(): string
    {
        if ($this->caption) {
            return $this->caption;
        }
        $parts = array_filter([
            $this->outfitOption?->label,
            $this->poseOption?->label,
        ]);

        return $parts ? implode(' · ', $parts) : '';
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'photo' => $this->photoUrl() ?? '',
            'caption' => $this->displayCaption(),
            'outfitId' => $this->outfit_option_id ? (string) $this->outfit_option_id : null,
            'poseId' => $this->pose_option_id ? (string) $this->pose_option_id : null,
        ];
    }
}
