<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConsentItem;
use App\Models\Quiz;
use App\Services\CardMatrixService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class QuizController extends Controller
{
    private function eagerLoad(Quiz $quiz): Quiz
    {
        // cards.outfitOption/poseOption feed CharacterCard::displayCaption() — without
        // them a 96-card quiz fires ~192 extra queries per load.
        return $quiz->load([
            'consentItems',
            'characters.cards.outfitOption',
            'characters.cards.poseOption',
            'questions.options',
        ]);
    }

    private function assertAccess(Request $request, Quiz $quiz): void
    {
        if (!$request->user()->canAccessQuiz($quiz->id)) {
            abort(403, 'You do not have access to this quiz.');
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $quizzes = $user->all_quizzes
            ? Quiz::query()->orderByDesc('id')->get()
            : $user->quizzes()->orderByDesc('quizzes.id')->get();

        return response()->json($quizzes->map(fn (Quiz $q) => $this->eagerLoad($q)->toApiArray()));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string'],
        ]);

        $slug = $this->uniqueSlug($data['slug'] ?? $data['name']);

        $quiz = Quiz::create([
            'name' => $data['name'],
            'slug' => $slug,
            'status' => $data['status'] ?? 'Draft',
            'meta' => [
                'design' => ['bg' => '#F2E9FF', 'button' => '#7C5CFF', 'text' => '#2B2540', 'accent' => '#5B3FD6'],
            ],
        ]);

        if ($request->user()->all_quizzes === false) {
            $quiz->users()->attach($request->user()->id);
        }

        return response()->json($this->eagerLoad($quiz)->toApiArray(), 201);
    }

    public function show(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);

        return response()->json($this->eagerLoad($quiz)->toApiArray());
    }

    public function showBySlug(string $slug)
    {
        $quiz = Quiz::where('slug', $slug)->firstOrFail();

        return response()->json($this->eagerLoad($quiz)->toApiArray());
    }

    public function update(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'string'],
            'gateEnabled' => ['sometimes', 'boolean'],
            'hashtag' => ['sometimes', 'nullable', 'string'],
            'shareCopy' => ['sometimes', 'nullable', 'string'],
            'showCopyLink' => ['sometimes', 'boolean'],
            'showDownload' => ['sometimes', 'boolean'],
            'esignEnabled' => ['sometimes', 'boolean'],
            'meta' => ['sometimes', 'array'],
            'outfitQuestionId' => ['sometimes', 'nullable', 'integer'],
            'poseQuestionId' => ['sometimes', 'nullable', 'integer'],
        ]);

        if (array_key_exists('slug', $data) && $data['slug']) {
            $data['slug'] = $this->uniqueSlug($data['slug'], $quiz->id);
        }

        $dimensionsChanged = $this->applyDimensionQuestions($quiz, $data);

        $quiz->fill([
            'name' => $data['name'] ?? $quiz->name,
            'slug' => $data['slug'] ?? $quiz->slug,
            'status' => $data['status'] ?? $quiz->status,
            'gate_enabled' => $data['gateEnabled'] ?? $quiz->gate_enabled,
            'hashtag' => $data['hashtag'] ?? $quiz->hashtag,
            'share_copy' => $data['shareCopy'] ?? $quiz->share_copy,
            'show_copy_link' => $data['showCopyLink'] ?? $quiz->show_copy_link,
            'show_download' => $data['showDownload'] ?? $quiz->show_download,
            'esign_enabled' => $data['esignEnabled'] ?? $quiz->esign_enabled,
            'meta' => array_key_exists('meta', $data) ? array_merge($quiz->meta ?? [], $data['meta']) : $quiz->meta,
        ])->save();

        // Re-point the card matrix only after the new designation is persisted.
        if ($dimensionsChanged) {
            CardMatrixService::sync($quiz->fresh());
        }

        return response()->json($this->eagerLoad($quiz->fresh())->toApiArray());
    }

    /**
     * Designate which questions drive the outfit and pose axes of the card matrix.
     *
     * Validated server-side for the first time: each must belong to THIS quiz, be
     * a grid question, and the two must be distinct. Previously the only rule was
     * a client-side cap of one grid question, which the API never enforced.
     */
    private function applyDimensionQuestions(Quiz $quiz, array $data): bool
    {
        $changed = false;

        foreach (['outfitQuestionId' => 'outfit_question_id', 'poseQuestionId' => 'pose_question_id'] as $in => $col) {
            if (!array_key_exists($in, $data)) {
                continue;
            }
            $id = $data[$in] ? (int) $data[$in] : null;

            if ($id !== null) {
                $question = $quiz->questions()->find($id);
                if (!$question) {
                    abort(422, "Question {$id} does not belong to this quiz.");
                }
                if ($question->layout !== 'grid') {
                    abort(422, 'A dimension question must use the grid layout.');
                }
            }

            if ($quiz->{$col} !== $id) {
                $quiz->{$col} = $id;
                $changed = true;
            }
        }

        if ($quiz->outfit_question_id !== null && $quiz->outfit_question_id === $quiz->pose_question_id) {
            abort(422, 'The outfit and pose questions must be different.');
        }

        return $changed;
    }

    public function destroy(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);
        $quiz->delete();

        return response()->json(['ok' => true]);
    }

    public function analytics(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);

        return response()->json($quiz->analyticsSummary());
    }

    // ---------- consent items ----------

    public function storeConsentItem(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);
        $data = $request->validate(['text' => ['required', 'string']]);

        $order = $quiz->consentItems()->max('order') + 1;
        $item = $quiz->consentItems()->create(['text' => $data['text'], 'order' => $order]);

        return response()->json(['id' => (string) $item->id, 'text' => $item->text, 'required' => $item->required], 201);
    }

    public function updateConsentItem(Request $request, ConsentItem $consentItem)
    {
        $this->assertAccess($request, $consentItem->quiz);
        $data = $request->validate([
            'text' => ['sometimes', 'string'],
            'required' => ['sometimes', 'boolean'],
        ]);
        $consentItem->update($data);

        return response()->json(['id' => (string) $consentItem->id, 'text' => $consentItem->text, 'required' => $consentItem->required]);
    }

    public function moveConsentItem(Request $request, ConsentItem $consentItem)
    {
        $this->assertAccess($request, $consentItem->quiz);
        $dir = (int) $request->input('dir', 0);
        $siblings = $consentItem->quiz->consentItems()->get();
        $idx = $siblings->search(fn ($i) => $i->id === $consentItem->id);
        $swapWith = $siblings->get($idx + $dir);
        if ($swapWith) {
            $a = $consentItem->order;
            $consentItem->update(['order' => $swapWith->order]);
            $swapWith->update(['order' => $a]);
        }

        return response()->json(['ok' => true]);
    }

    public function destroyConsentItem(Request $request, ConsentItem $consentItem)
    {
        $this->assertAccess($request, $consentItem->quiz);
        $consentItem->delete();

        return response()->json(['ok' => true]);
    }

    private function uniqueSlug(string $base, ?int $ignoreId = null): string
    {
        $slug = Str::slug($base) ?: 'quiz';
        $candidate = $slug;
        $n = 2;
        while (Quiz::where('slug', $candidate)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $candidate = $slug.'-'.$n++;
        }

        return $candidate;
    }
}
