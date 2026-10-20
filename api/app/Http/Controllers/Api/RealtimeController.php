<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Realtime;
use Illuminate\Http\Request;

class RealtimeController extends Controller
{
    /** Mints a Socket.IO handshake token scoped to the rooms this admin can see. */
    public function token(Request $request)
    {
        $user = $request->user();
        $quizIds = $user->all_quizzes
            ? \App\Models\Quiz::query()->pluck('id')
            : $user->quizzes()->pluck('quizzes.id');

        $rooms = $quizIds->map(fn ($id) => "quiz:{$id}")->all();

        return response()->json(['token' => Realtime::token($user->id, $rooms)]);
    }
}
