<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Services\Realtime;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    /** Public: fired by fan.js at each funnel step (view/start/question_reached/gate_reached/complete). */
    public function store(Request $request, string $slug)
    {
        $quiz = Quiz::where('slug', $slug)->firstOrFail();

        $data = $request->validate([
            'visitorId' => ['nullable', 'string'],
            'eventType' => ['required', 'string', 'in:view,start,question_reached,gate_reached,complete'],
            'questionIndex' => ['nullable', 'integer', 'min:0'],
        ]);

        $quiz->analyticsEvents()->create([
            'visitor_id' => $data['visitorId'] ?? null,
            'event_type' => $data['eventType'],
            'question_index' => $data['questionIndex'] ?? null,
        ]);

        Realtime::publish('analytics:changed', "quiz:{$quiz->id}");

        return response()->json(['ok' => true], 201);
    }
}
