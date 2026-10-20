<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\Submission;
use App\Services\QuizScorer;
use App\Services\Realtime;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    /** Public: a fan finishes the quiz. Recomputes the authoritative result server-side. */
    public function store(Request $request, string $slug)
    {
        $quiz = Quiz::with(['characters.cards', 'questions.options', 'consentItems'])
            ->where('slug', $slug)->firstOrFail();

        $data = $request->validate([
            'answers' => ['array'],
            'first' => ['nullable', 'string'],
            'last' => ['nullable', 'string'],
            'email' => ['nullable', 'string'],
            'source' => ['nullable', 'string'],
            'consent' => ['array'],
            'timeSpentSeconds' => ['nullable', 'integer', 'min:0'],
            'visitorId' => ['nullable', 'string'],
        ]);

        $answersByQuestionId = [];
        foreach (($data['answers'] ?? []) as $questionId => $optionId) {
            $answersByQuestionId[(int) $questionId] = (int) $optionId;
        }

        $winner = QuizScorer::score($quiz, $answersByQuestionId);
        [$outfitOptionId, $poseOptionId] = QuizScorer::dimensionAnswers($quiz, $answersByQuestionId);
        $card = $winner ? QuizScorer::resolveCard($winner, $outfitOptionId, $poseOptionId) : null;

        $consentChecked = $data['consent'] ?? [];
        $consentTexts = $quiz->consentItems
            ->filter(fn ($item) => !empty($consentChecked[$item->id]))
            ->pluck('text')->values()->all();

        $name = trim(($data['first'] ?? 'Anonymous').' '.($data['last'] ?? 'Fan'));

        $submission = Submission::create([
            'quiz_id' => $quiz->id,
            'result_character_id' => $winner?->id,
            'card_id' => $card?->id,
            'outfit_option_id' => $outfitOptionId,
            'pose_option_id' => $poseOptionId,
            'name' => $name,
            'email' => $data['email'] ?? '(not captured)',
            'source' => $data['source'] ?? 'Direct link',
            'consent' => $consentTexts,
            'time_spent_seconds' => $data['timeSpentSeconds'] ?? 0,
            'session_id' => $data['visitorId'] ?? null,
            'ip_address' => $request->ip(),
        ]);

        Realtime::publish(
            'submission:new',
            "quiz:{$quiz->id}",
            $submission->fresh(['resultCharacter', 'outfitOption', 'poseOption'])->toApiArray()
        );

        return response()->json([
            'result' => $winner ? [
                'character' => $winner->toApiArray(),
                'card' => $card?->toApiArray(),
            ] : null,
        ], 201);
    }

    /** Admin: paginated submissions list, optionally scoped to one quiz. */
    public function index(Request $request)
    {
        $user = $request->user();
        // Eager-load both dimension options: toApiArray() now names them, and a
        // 50-row page would otherwise fire 100 extra queries.
        $query = Submission::query()->with(['resultCharacter', 'outfitOption', 'poseOption'])->latest();

        if ($quizId = $request->query('quiz_id')) {
            if (!$user->canAccessQuiz((int) $quizId)) {
                abort(403);
            }
            $query->where('quiz_id', $quizId);
        } elseif (!$user->all_quizzes) {
            $query->whereIn('quiz_id', $user->quizzes()->pluck('quizzes.id'));
        }

        $submissions = $query->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $submissions->getCollection()->map(fn (Submission $s) => $s->toApiArray())->all(),
            'total' => $submissions->total(),
            'page' => $submissions->currentPage(),
        ]);
    }

    public function show(Request $request, Submission $submission)
    {
        if (!$request->user()->canAccessQuiz($submission->quiz_id)) {
            abort(403);
        }

        return response()->json($submission->toApiArray());
    }

    public function destroy(Request $request, Submission $submission)
    {
        if (!$request->user()->canAccessQuiz($submission->quiz_id)) {
            abort(403);
        }
        $submission->delete();

        return response()->json(['ok' => true]);
    }

    /** Admin: CSV export, filtered the same way the export modal already resolves matches. */
    public function export(Request $request)
    {
        $user = $request->user();
        $query = Submission::query()->with(['resultCharacter', 'quiz'])->latest();

        if ($quizId = $request->query('quiz_id')) {
            if (!$user->canAccessQuiz((int) $quizId)) {
                abort(403);
            }
            $query->where('quiz_id', $quizId);
        } elseif (!$user->all_quizzes) {
            $query->whereIn('quiz_id', $user->quizzes()->pluck('quizzes.id'));
        }

        if ($from = $request->query('from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $rows = $query->get();
        $csv = "Name,Email,Quiz,Result,Card,Date,Source\n";
        foreach ($rows as $row) {
            $cells = [
                $row->name, $row->email, $row->quiz->name,
                $row->resultCharacter?->name ?? '', (string) $row->card_id,
                $row->created_at->format('M j, Y'), $row->source ?? '',
            ];
            $csv .= implode(',', array_map(fn ($c) => '"'.str_replace('"', '""', $c).'"', $cells))."\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="submissions.csv"',
        ]);
    }
}
