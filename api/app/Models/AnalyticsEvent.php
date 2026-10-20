<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['quiz_id', 'visitor_id', 'event_type', 'question_index'])]
class AnalyticsEvent extends Model
{
    const UPDATED_AT = null;

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }
}
