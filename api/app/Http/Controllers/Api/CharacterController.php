<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\Quiz;
use App\Services\CardMatrixService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CharacterController extends Controller
{
    private function assertAccess(Request $request, Quiz $quiz): void
    {
        if (!$request->user()->canAccessQuiz($quiz->id)) {
            abort(403);
        }
    }

    public function store(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);
        $data = $request->validate([
            'name' => ['required', 'string'],
            'colorName' => ['nullable', 'string'],
            'color' => ['nullable', 'string'],
            'blurb' => ['nullable', 'string'],
            'why' => ['nullable', 'string'],
            'cards' => ['array'],
        ]);

        $color = $data['color'] ?? '#8B6FE8';
        $order = $quiz->characters()->max('order') + 1;
        $character = $quiz->characters()->create([
            'key' => $this->uniqueKey($quiz, $data['name']),
            'name' => Str::upper($data['name']),
            'initial' => Str::upper(mb_substr($data['name'], 0, 1)),
            'color_name' => $data['colorName'] ?? 'New colorway',
            'color' => $color,
            'grad' => Character::gradFromColor($color),
            'blurb' => $data['blurb'] ?? '',
            'why' => $data['why'] ?? 'A colorway chosen to match this member.',
            'order' => $order,
        ]);

        // A member's cards are the (outfit x pose) matrix, not a free-form list —
        // generate the full grid rather than trusting whatever the client sent.
        CardMatrixService::syncForCharacter($character);

        return response()->json($character->fresh(['cards'])->toApiArray(), 201);
    }

    public function update(Request $request, Character $character)
    {
        $this->assertAccess($request, $character->quiz);
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'colorName' => ['sometimes', 'string'],
            'color' => ['sometimes', 'string'],
            'blurb' => ['sometimes', 'nullable', 'string'],
            'cards' => ['sometimes', 'array'],
        ]);

        $color = $data['color'] ?? $character->color;
        $character->fill([
            'name' => isset($data['name']) ? Str::upper($data['name']) : $character->name,
            'initial' => isset($data['name']) ? Str::upper(mb_substr($data['name'], 0, 1)) : $character->initial,
            'color_name' => $data['colorName'] ?? $character->color_name,
            'color' => $color,
            'grad' => $color === $character->color ? $character->grad : Character::gradFromColor($color),
            'blurb' => $data['blurb'] ?? $character->blurb,
        ])->save();

        // Cards are matrix slots now: the client may retitle a slot it already
        // has, but it can no longer add or remove them. Creating/deleting here
        // would punch holes in the (outfit x pose) grid — only CardMatrixService
        // may change the matrix's shape.
        if (array_key_exists('cards', $data)) {
            foreach ($data['cards'] as $card) {
                $id = $card['id'] ?? null;
                if ($id && $character->cards->firstWhere('id', (int) $id)) {
                    $character->cards()->where('id', $id)->update(['caption' => $card['caption'] ?? '']);
                }
            }
        }

        return response()->json($character->fresh(['cards'])->toApiArray());
    }

    public function destroy(Request $request, Character $character)
    {
        $this->assertAccess($request, $character->quiz);
        $key = $character->key;
        $quiz = $character->quiz;
        $character->delete();

        // Strip this character's key from every option's scores map (mirrors
        // admin-state.js's confirmAction "character" branch).
        foreach ($quiz->questions as $question) {
            foreach ($question->options as $option) {
                $scores = $option->scores ?? [];
                if (array_key_exists($key, $scores)) {
                    unset($scores[$key]);
                    $option->update(['scores' => $scores]);
                }
            }
        }

        return response()->json(['ok' => true]);
    }

    private function uniqueKey(Quiz $quiz, string $name): string
    {
        $base = Str::upper(preg_replace('/[^A-Za-z0-9]/', '', $name));
        $base = $base !== '' ? mb_substr($base, 0, 4) : 'CHAR';
        $taken = $quiz->characters()->pluck('key')->all();
        if (!in_array($base, $taken, true)) {
            return $base;
        }
        $n = 2;
        while (in_array($base.$n, $taken, true)) {
            $n++;
        }

        return $base.$n;
    }
}
