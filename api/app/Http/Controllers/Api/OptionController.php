<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Option;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OptionController extends Controller
{
    /** Uploads a grid/outfit answer's image (builder.js's uploadAnswerImg). */
    public function uploadImage(Request $request, Option $option)
    {
        if (!$request->user()->canAccessQuiz($option->question->quiz_id)) {
            abort(403);
        }
        $request->validate(['img' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);

        if ($option->img) {
            Storage::disk('public')->delete($option->img);
        }
        $path = $request->file('img')->store('answers', 'public');
        $option->update(['img' => $path]);

        return response()->json(['img_url' => Storage::url($path)]);
    }
}
