<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name', 'slug', 'status', 'gate_enabled', 'hashtag', 'share_copy',
    'show_copy_link', 'show_download', 'esign_enabled', 'meta',
    'outfit_question_id', 'pose_question_id',
])]
class Quiz extends Model
{
    protected function casts(): array
    {
        return [
            'gate_enabled' => 'boolean',
            'show_copy_link' => 'boolean',
            'show_download' => 'boolean',
            'esign_enabled' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function consentItems(): HasMany
    {
        return $this->hasMany(ConsentItem::class)->orderBy('order');
    }

    public function characters(): HasMany
    {
        return $this->hasMany(Character::class)->orderBy('order');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('order');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    /** The question whose options are this quiz's outfits (one axis of the card matrix). */
    public function outfitQuestion(): BelongsTo
    {
        return $this->belongsTo(Question::class, 'outfit_question_id');
    }

    /** The question whose options are this quiz's poses (the other axis). */
    public function poseQuestion(): BelongsTo
    {
        return $this->belongsTo(Question::class, 'pose_question_id');
    }

    public function analyticsEvents(): HasMany
    {
        return $this->hasMany(AnalyticsEvent::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    /** Aggregates real analytics_events into the funnel shape admin/analytics.js already renders. */
    public function analyticsSummary(): array
    {
        $counts = $this->analyticsEvents()
            ->selectRaw('event_type, count(*) as c')
            ->groupBy('event_type')
            ->pluck('c', 'event_type');

        $nQ = max(1, $this->questions()->count());
        $perQuestion = [];
        for ($i = 0; $i < $nQ; $i++) {
            $perQuestion[$i] = (int) $this->analyticsEvents()
                ->where('event_type', 'question_reached')
                ->where('question_index', $i)
                ->count();
        }
        if (empty($perQuestion)) {
            $perQuestion = [1];
        }

        return [
            'views' => (int) ($counts['view'] ?? 0),
            'starts' => (int) ($counts['start'] ?? 0),
            'gateReached' => (int) ($counts['gate_reached'] ?? 0),
            'perQuestionReached' => array_values($perQuestion),
        ];
    }

    /** Builds the exact nested JSON shape the frontend already expects from data.js's seedQuizzes(). */
    public function toApiArray(): array
    {
        $meta = $this->meta ?? [];

        return array_merge([
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'status' => $this->status,
            'finishers' => $this->submissions()->count(),
            'gateEnabled' => $this->gate_enabled,
            'hashtag' => $this->hashtag,
            'shareCopy' => $this->share_copy,
            'showCopyLink' => $this->show_copy_link,
            'showDownload' => $this->show_download,
            'outfitQuestionId' => $this->outfit_question_id,
            'poseQuestionId' => $this->pose_question_id,
            'design' => $meta['design'] ?? ['bg' => '#F2E9FF', 'button' => '#7C5CFF', 'text' => '#2B2540', 'accent' => '#5B3FD6'],
            'esign' => [
                'enabled' => $this->esign_enabled,
                'items' => $this->consentItems->map(fn (ConsentItem $ci) => [
                    'id' => (string) $ci->id,
                    'text' => $ci->text,
                    'required' => $ci->required,
                ])->all(),
            ],
            'characters' => $this->characters->map(fn (Character $c) => $c->toApiArray())->all(),
            'questions' => $this->questions->map(fn (Question $q) => $q->toApiArray())->all(),
            'analytics' => $this->analyticsSummary(),
        ], $meta);
    }
}
