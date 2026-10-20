<?php

namespace Tests\Unit;

use App\Models\Quiz;
use App\Services\QuizScorer;
use Database\Seeders\BabymQuizSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins the answer -> card mapping. The whole point of the matrix is that a given
 * (member, outfit, pose) triple resolves to one specific card, every time —
 * this replaced a ->random() pick that ignored the fan's answers entirely.
 */
class QuizScorerTest extends TestCase
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

    private function outfit(int $i)
    {
        return $this->quiz->outfitQuestion->options->sortBy('order')->values()[$i];
    }

    private function pose(int $i)
    {
        return $this->quiz->poseQuestion->options->sortBy('order')->values()[$i];
    }

    public function test_resolves_the_card_bound_to_the_exact_triple(): void
    {
        $member = $this->quiz->characters->firstWhere('key', 'RUKA');
        $outfit = $this->outfit(1);   // "Outfit 2"
        $pose = $this->pose(2);       // "Pose 3"

        $card = QuizScorer::resolveCard($member, $outfit->id, $pose->id);

        $this->assertNotNull($card);
        $this->assertSame($member->id, $card->character_id);
        $this->assertSame($outfit->id, $card->outfit_option_id);
        $this->assertSame($pose->id, $card->pose_option_id);
    }

    public function test_resolution_is_deterministic(): void
    {
        $member = $this->quiz->characters->firstWhere('key', 'ASA');
        $outfit = $this->outfit(0);
        $pose = $this->pose(3);

        $first = QuizScorer::resolveCard($member, $outfit->id, $pose->id);
        for ($i = 0; $i < 10; $i++) {
            $again = QuizScorer::resolveCard($member->fresh('cards'), $outfit->id, $pose->id);
            $this->assertSame($first->id, $again->id, 'the same triple resolved to a different card');
        }
    }

    public function test_every_triple_maps_to_a_distinct_card(): void
    {
        $seen = [];
        foreach ($this->quiz->characters as $member) {
            foreach ($this->quiz->outfitQuestion->options as $outfit) {
                foreach ($this->quiz->poseQuestion->options as $pose) {
                    $card = QuizScorer::resolveCard($member, $outfit->id, $pose->id);
                    $this->assertNotNull($card);
                    $this->assertArrayNotHasKey($card->id, $seen, "card {$card->id} served two different triples");
                    $seen[$card->id] = true;
                }
            }
        }
        $this->assertCount(96, $seen);
    }

    public function test_dimension_answers_are_read_from_the_designated_questions(): void
    {
        $outfit = $this->outfit(2);
        $pose = $this->pose(1);

        [$outfitId, $poseId] = QuizScorer::dimensionAnswers($this->quiz, [
            $this->quiz->outfit_question_id => $outfit->id,
            $this->quiz->pose_question_id => $pose->id,
        ]);

        $this->assertSame($outfit->id, $outfitId);
        $this->assertSame($pose->id, $poseId);
    }

    public function test_an_option_from_the_wrong_question_is_rejected(): void
    {
        // A client posting an unrelated option id must not be able to pull an
        // arbitrary card out of the matrix.
        $foreign = $this->quiz->questions->firstWhere('layout', 'list')->options->first();

        [$outfitId, $poseId] = QuizScorer::dimensionAnswers($this->quiz, [
            $this->quiz->outfit_question_id => $foreign->id,
        ]);

        $this->assertNull($outfitId);
        $this->assertNull($poseId);
    }

    public function test_falls_back_within_the_outfit_when_the_pose_is_unanswered(): void
    {
        $member = $this->quiz->characters->first();
        $outfit = $this->outfit(1);

        $card = QuizScorer::resolveCard($member, $outfit->id, null);

        $this->assertNotNull($card);
        $this->assertSame($outfit->id, $card->outfit_option_id, 'fallback left the fan\'s chosen outfit');
    }

    public function test_falls_back_deterministically_when_nothing_is_answered(): void
    {
        $member = $this->quiz->characters->first();

        $a = QuizScorer::resolveCard($member, null, null);
        $b = QuizScorer::resolveCard($member->fresh('cards'), null, null);

        $this->assertNotNull($a);
        $this->assertSame($a->id, $b->id, 'the no-answer fallback is not deterministic');
    }

    public function test_scoring_still_ignores_both_grid_questions(): void
    {
        // Outfit and pose pick the artwork, never the member. Use options that
        // score RUKA *exclusively* — several seeded options split points (e.g.
        // ['ASA' => 2, 'RUKA' => 1]), which would legitimately elect someone else.
        $answers = [];
        foreach ($this->quiz->questions->where('layout', 'list') as $question) {
            $rukaOnly = $question->options->first(
                fn ($o) => array_keys($o->scores ?? []) === ['RUKA']
            );
            if ($rukaOnly) {
                $answers[$question->id] = $rukaOnly->id;
            }
        }
        $this->assertNotEmpty($answers, 'no RUKA-exclusive option to build the fixture from');

        // The outfit and pose options below carry scores of [] and must not move
        // the result, no matter which ones are chosen.
        $baseline = QuizScorer::score($this->quiz, $answers);
        $withGrids = QuizScorer::score($this->quiz, $answers + [
            $this->quiz->outfit_question_id => $this->outfit(0)->id,
            $this->quiz->pose_question_id => $this->pose(0)->id,
        ]);

        $this->assertSame('RUKA', $baseline->key);
        $this->assertSame($baseline->key, $withGrids->key, 'a grid answer changed the matched member');
    }
}
