<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Option;
use App\Models\Question;
use App\Models\Quiz;
use App\Services\CardMatrixService;
use Illuminate\Http\Request;

class QuestionController extends Controller
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
            'title' => ['required', 'string'],
            'sub' => ['nullable', 'string'],
            'layout' => ['required', 'string', 'in:list,grid'],
            'options' => ['array'],
        ]);

        $order = $quiz->questions()->max('order') + 1;
        $question = $quiz->questions()->create([
            'title' => $data['title'],
            'sub' => $data['sub'] ?? null,
            'layout' => $data['layout'],
            'order' => $order,
        ]);

        $this->syncOptions($question, $data['options'] ?? []);

        return response()->json($question->fresh(['options'])->toApiArray(), 201);
    }

    public function update(Request $request, Question $question)
    {
        $this->assertAccess($request, $question->quiz);
        $data = $request->validate([
            'title' => ['sometimes', 'string'],
            'sub' => ['sometimes', 'nullable', 'string'],
            'layout' => ['sometimes', 'string', 'in:list,grid'],
            'options' => ['sometimes', 'array'],
        ]);

        $question->fill([
            'title' => $data['title'] ?? $question->title,
            'sub' => $data['sub'] ?? $question->sub,
            'layout' => $data['layout'] ?? $question->layout,
        ])->save();

        if (array_key_exists('options', $data)) {
            $this->syncOptions($question, $data['options']);
            // Editing a dimension question's options adds or removes a whole row
            // or column of the card matrix, across every member.
            $this->resyncIfDimension($question);
        }

        return response()->json($question->fresh(['options'])->toApiArray());
    }

    public function destroy(Request $request, Question $question)
    {
        $this->assertAccess($request, $question->quiz);
        $quiz = $question->quiz;
        $wasDimension = in_array($question->id, [$quiz->outfit_question_id, $quiz->pose_question_id], true);
        $question->delete();

        // The FK nulls the designation; the matrix then collapses that axis.
        if ($wasDimension) {
            CardMatrixService::sync($quiz->fresh());
        }

        return response()->json(['ok' => true]);
    }

    /** Re-run the matrix when the edited question is one of the quiz's two axes. */
    private function resyncIfDimension(Question $question): void
    {
        $quiz = $question->quiz;
        if (in_array($question->id, [$quiz->outfit_question_id, $quiz->pose_question_id], true)) {
            CardMatrixService::sync($quiz->fresh());
        }
    }

    public function reorder(Request $request, Quiz $quiz)
    {
        $this->assertAccess($request, $quiz);
        $ids = $request->validate(['order' => ['required', 'array']])['order'];
        foreach (array_values($ids) as $i => $id) {
            Question::where('id', $id)->where('quiz_id', $quiz->id)->update(['order' => $i]);
        }

        return response()->json(['ok' => true]);
    }

    /** Replace-all-options-on-save: the client always sends the question's full current option list. */
    private function syncOptions(Question $question, array $options): void
    {
        $keepIds = [];
        foreach (array_values($options) as $i => $opt) {
            $id = $opt['id'] ?? null;
            $payload = [
                'badge' => $opt['badge'] ?? null,
                'label' => $opt['label'] ?? '',
                'sub' => $opt['sub'] ?? null,
                'scores' => $opt['scores'] ?? [],
                'order' => $i,
            ];
            if ($id && $question->options->firstWhere('id', (int) $id)) {
                Option::where('id', $id)->update($payload);
                $keepIds[] = (int) $id;
            } else {
                $keepIds[] = $question->options()->create($payload)->id;
            }
        }
        $question->options()->whereNotIn('id', $keepIds)->delete();
    }
}
