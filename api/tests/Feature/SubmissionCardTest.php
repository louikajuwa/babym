<?php

namespace Tests\Feature;

use App\Models\Quiz;
use App\Models\Submission;
use Database\Seeders\BabymQuizSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * End-to-end: a fan's answers must land on the right card, and the triple that
 * produced it must be recorded on the submission.
 */
class SubmissionCardTest extends TestCase
{
    use RefreshDatabase;

    private Quiz $quiz;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BabymQuizSeeder::class);
        $this->quiz = Quiz::with([
            'characters.cards', 'questions.options', 'outfitQuestion.options', 'poseQuestion.options',
        ])->firstOrFail();
    }

    /** Answers that score RUKA, plus an explicit outfit and pose choice. */
    private function answers(int $outfitIdx, int $poseIdx): array
    {
        $answers = [];
        foreach ($this->quiz->questions as $question) {
            if ($question->layout === 'grid') {
                continue;
            }
            $ruka = $question->options->first(fn ($o) => array_key_exists('RUKA', $o->scores ?? []));
            if ($ruka) {
                $answers[$question->id] = $ruka->id;
            }
        }
        $answers[$this->quiz->outfit_question_id] = $this->quiz->outfitQuestion->options->sortBy('order')->values()[$outfitIdx]->id;
        $answers[$this->quiz->pose_question_id] = $this->quiz->poseQuestion->options->sortBy('order')->values()[$poseIdx]->id;

        return $answers;
    }

    public function test_submission_records_the_triple_and_the_matching_card(): void
    {
        $answers = $this->answers(1, 2);

        $response = $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", [
            'answers' => $answers,
            'first' => 'Test',
            'last' => 'Fan',
            'email' => 'test@example.com',
            'consent' => [],
        ]);

        $response->assertCreated();

        $submission = Submission::latest('id')->firstOrFail();
        $this->assertSame($answers[$this->quiz->outfit_question_id], $submission->outfit_option_id);
        $this->assertSame($answers[$this->quiz->pose_question_id], $submission->pose_option_id);
        $this->assertSame('RUKA', $submission->resultCharacter->key);

        // The stored card is exactly the one bound to that triple.
        $card = $submission->card;
        $this->assertNotNull($card);
        $this->assertSame($submission->result_character_id, $card->character_id);
        $this->assertSame($submission->outfit_option_id, $card->outfit_option_id);
        $this->assertSame($submission->pose_option_id, $card->pose_option_id);
    }

    public function test_identical_answers_produce_the_identical_card(): void
    {
        $answers = $this->answers(3, 0);
        $payload = ['answers' => $answers, 'first' => 'A', 'last' => 'B', 'consent' => []];

        $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", $payload)->assertCreated();
        $first = Submission::latest('id')->firstOrFail()->card_id;

        $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", $payload)->assertCreated();
        $second = Submission::latest('id')->firstOrFail()->card_id;

        $this->assertSame($first, $second, 'the same answers produced different cards');
    }

    public function test_different_outfits_produce_different_cards(): void
    {
        $cards = [];
        foreach ([0, 1, 2, 3] as $outfitIdx) {
            $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", [
                'answers' => $this->answers($outfitIdx, 1), 'first' => 'A', 'last' => 'B', 'consent' => [],
            ])->assertCreated();
            $cards[] = Submission::latest('id')->firstOrFail()->card_id;
        }

        $this->assertCount(4, array_unique($cards), 'changing the outfit did not change the card');
    }

    public function test_different_poses_produce_different_cards(): void
    {
        $cards = [];
        foreach ([0, 1, 2, 3] as $poseIdx) {
            $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", [
                'answers' => $this->answers(2, $poseIdx), 'first' => 'A', 'last' => 'B', 'consent' => [],
            ])->assertCreated();
            $cards[] = Submission::latest('id')->firstOrFail()->card_id;
        }

        $this->assertCount(4, array_unique($cards), 'changing the pose did not change the card');
    }

    public function test_skipping_the_dimension_questions_still_succeeds(): void
    {
        $answers = $this->answers(0, 0);
        unset($answers[$this->quiz->outfit_question_id], $answers[$this->quiz->pose_question_id]);

        $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", [
            'answers' => $answers, 'first' => 'A', 'last' => 'B', 'consent' => [],
        ])->assertCreated();

        $submission = Submission::latest('id')->firstOrFail();
        $this->assertNull($submission->outfit_option_id);
        $this->assertNull($submission->pose_option_id);
        $this->assertNotNull($submission->card_id, 'a skipped dimension must still yield a card');
    }

    public function test_api_payload_exposes_the_dimension_labels(): void
    {
        $this->postJson("/api/quiz/{$this->quiz->slug}/submissions", [
            'answers' => $this->answers(1, 2), 'first' => 'A', 'last' => 'B', 'consent' => [],
        ])->assertCreated();

        // This payload is also what ships over the socket, so a live row and a
        // refreshed row must agree.
        $payload = Submission::latest('id')->firstOrFail()
            ->load(['resultCharacter', 'outfitOption', 'poseOption'])->toApiArray();

        $this->assertSame('Soft pastels', $payload['outfit']);
        $this->assertSame('Polaroid', $payload['pose']);
    }
}
