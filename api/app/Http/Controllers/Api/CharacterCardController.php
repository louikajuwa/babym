<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CharacterCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CharacterCardController extends Controller
{
    public function update(Request $request, CharacterCard $card)
    {
        $this->assertAccess($request, $card);
        $data = $request->validate(['caption' => ['sometimes', 'nullable', 'string']]);
        $card->update($data);

        return response()->json($card->toApiArray());
    }

    public function uploadPhoto(Request $request, CharacterCard $card)
    {
        $this->assertAccess($request, $card);
        $request->validate(['photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);

        if ($card->photo_path) {
            Storage::disk('public')->delete($card->photo_path);
        }
        $path = $request->file('photo')->store('cards', 'public');
        $card->update(['photo_path' => $path]);

        return response()->json(['photo_url' => Storage::url($path)]);
    }

    /**
     * Clears a slot's image rather than deleting the row. A card is a fixed
     * (outfit x pose) slot in the matrix — deleting it would leave a hole that
     * no fan answer could resolve to. Only CardMatrixService changes the shape.
     */
    public function destroy(Request $request, CharacterCard $card)
    {
        $this->assertAccess($request, $card);
        if ($card->photo_path) {
            Storage::disk('public')->delete($card->photo_path);
        }
        $card->update(['photo_path' => null]);

        return response()->json($card->fresh()->toApiArray());
    }

    private function assertAccess(Request $request, CharacterCard $card): void
    {
        if (!$request->user()->canAccessQuiz($card->character->quiz_id)) {
            abort(403);
        }
    }
}
