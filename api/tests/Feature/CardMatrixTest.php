<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\CharacterCard;
use App\Models\Quiz;
use App\Services\CardMatrixService;
use Database\Seeders\BabymQuizSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pins the member x outfit x pose card matrix: that it is complete, that every
 * triple is unique, and that it repairs itself when a dimension changes.
 */
class CardMatrixTest extends TestCase
{
    use RefreshDatabase;

    private Quiz $quiz;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BabymQuizSeeder::class);
        $this->quiz = Quiz::with(['characters', 'outfitQuestion.options', 'poseQuestion.options'])->firstOrFail();
    }

    private function outfits()
    {
        return $this->quiz->fresh('outfitQuestion.options')->outfitQuestion->options->sortBy('order')->values();
    }

    private function poses()
    {
        return $this->quiz->fresh('poseQuestion.options')->poseQuestion->options->sortBy('order')->values();
    }

    public function test_seeded_quiz_designates_both_dimension_questions(): void
    {
        $this->assertNotNull($this->quiz->outfit_question_id);
        $this->assertNotNull($this->quiz->pose_question_id);
        $this->assertNotSame($this->quiz->outfit_question_id, $this->quiz->pose_question_id);
        $this->assertSame('grid', $this->quiz->outfitQuestion->layout);
        $this->assertSame('grid', $this->quiz->poseQuestion->layout);
    }

    public function test_card_count_equals_members_times_outfits_times_poses(): void
    {
        $members = $this->quiz->characters->count();
        $outfits = $this->outfits()->count();
        $poses = $this->poses()->count();

        // The formula, not a hardcoded number: 6 x 4 x 4 = 96.
        $this->assertSame(6, $members);
        $this->assertSame(4, $outfits);
        $this->assertSame(4, $poses);
        $this->assertSame($members * $outfits * $poses, CharacterCard::count());
        $this->assertSame(CardMatrixService::expectedCount($this->quiz), CharacterCard::count());
    }

    public function test_every_triple_exists_exactly_once(): void
    {
        $duplicates = DB::table('character_cards')
            ->selectRaw('character_id, outfit_option_id, pose_option_id, count(*) as c')
            ->groupBy('character_id', 'outfit_option_id', 'pose_option_id')
            ->having('c', '>', 1)
            ->count();

        $this->assertSame(0, $duplicates, 'the matrix contains duplicate triples');

        $incomplete = CharacterCard::whereNull('outfit_option_id')->orWhereNull('pose_option_id')->count();
        $this->assertSame(0, $incomplete, 'some cards are missing a dimension');

        // Every member covers the full grid.
        foreach ($this->quiz->characters as $character) {
            $this->assertSame(16, $character->cards()->count(), "{$character->key} has an incomplete matrix");
        }
    }

    public function test_sync_is_idempotent(): void
    {
        $before = CharacterCard::count();
        $ids = CharacterCard::orderBy('id')->pluck('id')->all();

        CardMatrixService::sync($this->quiz->fresh());
        CardMatrixService::sync($this->quiz->fresh());

        $this->assertSame($before, CharacterCard::count(), 're-running sync changed the row count');
        $this->assertSame($ids, CharacterCard::orderBy('id')->pluck('id')->all(), 're-running sync churned rows');
    }

    public function test_adding_a_member_adds_a_full_matrix(): void
    {
        $before = CharacterCard::count();

        $character = $this->quiz->characters()->create([
            'key' => 'NEW', 'name' => 'NEW', 'initial' => 'N', 'color_name' => 'New',
            'color' => '#123456', 'grad' => 'g', 'blurb' => '', 'why' => '', 'order' => 99,
        ]);
        CardMatrixService::syncForCharacter($character);

        $this->assertSame($before + 16, CharacterCard::count());
        $this->assertSame(16, $character->cards()->count());
    }

    public function test_removing_an_outfit_prunes_a_column_across_every_member(): void
    {
        $members = $this->quiz->characters->count();
        $poses = $this->poses()->count();
        $before = CharacterCard::count();

        $this->outfits()->last()->delete();
        CardMatrixService::sync($this->quiz->fresh());

        $this->assertSame($before - ($members * $poses), CharacterCard::count());
        $this->assertSame(CardMatrixService::expectedCount($this->quiz->fresh()), CharacterCard::count());
    }

    public function test_uploaded_photo_survives_a_resync(): void
    {
        $card = CharacterCard::first();
        $card->update(['photo_path' => 'cards/keep-me.jpg']);

        CardMatrixService::sync($this->quiz->fresh());

        $this->assertSame('cards/keep-me.jpg', $card->fresh()->photo_path);
    }

    public function test_quiz_without_dimension_questions_still_gets_one_card_per_member(): void
    {
        $this->quiz->update(['outfit_question_id' => null, 'pose_question_id' => null]);
        CardMatrixService::sync($this->quiz->fresh());

        // Degenerate axes collapse to a single null slot rather than zero cards.
        $this->assertSame($this->quiz->characters->count(), CharacterCard::count());
        foreach (Character::all() as $character) {
            $this->assertSame(1, $character->cards()->count());
        }
    }
}
