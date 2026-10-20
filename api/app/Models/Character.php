<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['quiz_id', 'key', 'name', 'initial', 'color_name', 'color', 'grad', 'blurb', 'why', 'order'])]
class Character extends Model
{
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function cards(): HasMany
    {
        return $this->hasMany(CharacterCard::class)->orderBy('order');
    }

    /** Port of utils.js's shade(hex, pct). */
    public static function shade(string $hex, int $pct): string
    {
        $h = ltrim($hex, '#');
        if (strlen($h) < 6) {
            return $hex;
        }
        [$r, $g, $b] = [hexdec(substr($h, 0, 2)), hexdec(substr($h, 2, 2)), hexdec(substr($h, 4, 2))];
        $f = fn (int $v) => max(0, min(255, (int) round($v + ($pct / 100) * 255)));

        return sprintf('#%02x%02x%02x', $f($r), $f($g), $f($b));
    }

    /** Port of utils.js's gradFromColor(hex). */
    public static function gradFromColor(string $hex): string
    {
        $light = self::shade($hex, 26);
        $dark = self::shade($hex, -22);

        return "linear-gradient(155deg,{$light},{$hex} 72%,{$dark})";
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'name' => $this->name,
            'initial' => $this->initial,
            'colorName' => $this->color_name,
            'color' => $this->color,
            'grad' => $this->grad,
            'blurb' => $this->blurb,
            'why' => $this->why,
            'cards' => $this->cards->map(fn (CharacterCard $c) => $c->toApiArray())->all(),
        ];
    }
}
