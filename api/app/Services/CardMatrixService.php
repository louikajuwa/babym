<?php

namespace App\Services;

use App\Models\Character;
use App\Models\CharacterCard;
use App\Models\Quiz;
use Illuminate\Support\Facades\DB;

/**
 * Owns the member x outfit x pose card matrix.
 *
 * A quiz designates two questions as its visual dimensions (outfit_question_id,
 * pose_question_id); their options ARE the outfits and poses. Every member must
 * therefore have exactly one card per (outfit option, pose option) pair, so a
 * finished quiz can resolve to precisely one card:
 *
 *     cards per member = |outfit options| x |pose options|     (4 x 4 = 16)
 *     cards per quiz   = |members| x |outfits| x |poses|       (6 x 4 x 4 = 96)
 *
 * Totals are always derived from the data, never hardcoded — adding a member or
 * a dimension option grows the matrix automatically.
 *
 * sync() is idempotent: it is the single repair point called after any mutation
 * that changes a dimension, and re-running it never duplicates or churns rows.
 */
class CardMatrixService
{
    /**
     * Reconcile a quiz's cards with its current members and dimension options.
     * Creates missing slots, prunes slots whose dimension no longer exists, and
     * leaves every already-correct row (and its uploaded photo) untouched.
     */
    public static function sync(Quiz $quiz): void
    {
        $quiz->loadMissing(['characters', 'outfitQuestion.options', 'poseQuestion.options']);

        // A quiz that hasn't designated its dimension questions yet still needs a
        // usable card per member, so the degenerate axis is a single null slot.
        $outfitIds = self::axis($quiz->outfitQuestion);
        $poseIds = self::axis($quiz->poseQuestion);

        DB::transaction(function () use ($quiz, $outfitIds, $poseIds) {
            foreach ($quiz->characters as $character) {
                self::syncCharacter($character, $outfitIds, $poseIds);
            }
        });
    }

    /** Build the full matrix for one member. Used when a member is added mid-flight. */
    public static function syncCharacter(Character $character, array $outfitIds, array $poseIds): void
    {
        $order = 0;
        $keep = [];

        foreach ($outfitIds as $outfitId) {
            foreach ($poseIds as $poseId) {
                // firstOrCreate against the composite unique key: re-running can
                // never double-insert, and an existing slot keeps its photo.
                $card = CharacterCard::firstOrCreate(
                    [
                        'character_id' => $character->id,
                        'outfit_option_id' => $outfitId,
                        'pose_option_id' => $poseId,
                    ],
                    ['order' => $order]
                );
                if ($card->order !== $order) {
                    $card->update(['order' => $order]);
                }
                $keep[] = $card->id;
                $order++;
            }
        }

        // Prune slots whose outfit or pose option has since been deleted. Cascade
        // deletes handle the FK case; this catches rows orphaned by a dimension
        // question being swapped rather than deleted.
        $character->cards()->whereNotIn('id', $keep)->delete();
    }

    /** Convenience for callers holding a character rather than a quiz. */
    public static function syncForCharacter(Character $character): void
    {
        $quiz = $character->quiz()->with(['outfitQuestion.options', 'poseQuestion.options'])->first();
        if (!$quiz) {
            return;
        }
        self::syncCharacter($character, self::axis($quiz->outfitQuestion), self::axis($quiz->poseQuestion));
    }

    /**
     * One dimension's option ids, or [null] when the dimension is unconfigured.
     * The null entry is what keeps an un-designated quiz working instead of
     * collapsing to zero cards.
     *
     * @return array<int, int|null>
     */
    private static function axis($question): array
    {
        if (!$question) {
            return [null];
        }
        $ids = $question->options->sortBy('order')->pluck('id')->all();

        return $ids ?: [null];
    }

    /** Expected card count for a quiz — the formula, for tests and admin display. */
    public static function expectedCount(Quiz $quiz): int
    {
        $quiz->loadMissing(['characters', 'outfitQuestion.options', 'poseQuestion.options']);

        return $quiz->characters->count()
            * count(self::axis($quiz->outfitQuestion))
            * count(self::axis($quiz->poseQuestion));
    }
}
