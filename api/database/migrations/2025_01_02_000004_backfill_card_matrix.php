<?php

use App\Models\Quiz;
use App\Services\CardMatrixService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migrates existing installs onto the card matrix WITHOUT losing uploaded
 * photos. On a database that has been in use, character_cards rows carry real
 * photo_path values, so this cannot be a drop-and-reseed.
 *
 * For each quiz:
 *   1. The existing grid question becomes the outfit axis. A pose question is
 *      created from the distinct card captions already in use.
 *   2. Each existing card is matched to its pose option by caption and pinned
 *      to the FIRST outfit option — so every uploaded image survives as that
 *      outfit's column.
 *   3. CardMatrixService fills in the remaining slots as empty upload targets.
 *
 * A fresh install has no rows here and this is a no-op; the seeder builds the
 * matrix directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (Quiz::with(['questions.options', 'characters.cards'])->get() as $quiz) {
            $grids = $quiz->questions->where('layout', 'grid')->values();
            $outfitQuestion = $grids->first();

            // Nothing to hang a matrix off — leave the quiz alone rather than
            // inventing dimensions for it.
            if (!$outfitQuestion) {
                continue;
            }

            $poseQuestion = $grids->get(1);
            if (!$poseQuestion) {
                $captions = $quiz->characters
                    ->flatMap(fn ($c) => $c->cards->pluck('caption'))
                    ->filter()->unique()->values();
                if ($captions->isEmpty()) {
                    $captions = collect(['Studio concept', 'Stage close-up', 'Polaroid', 'Candid']);
                }

                $poseQuestion = $quiz->questions()->create([
                    'title' => 'Pick your photo mood:',
                    'sub' => 'How should your card be shot?',
                    'layout' => 'grid',
                    'order' => (int) $quiz->questions()->max('order') + 1,
                ]);
                foreach ($captions->values() as $i => $label) {
                    $poseQuestion->options()->create([
                        'badge' => chr(65 + $i),
                        'label' => $label,
                        'scores' => [],
                        'order' => $i,
                    ]);
                }
                $poseQuestion->load('options');
            }

            $quiz->update([
                'outfit_question_id' => $outfitQuestion->id,
                'pose_question_id' => $poseQuestion->id,
            ]);

            // Pin each existing card to (first outfit, its caption's pose).
            $firstOutfitId = $outfitQuestion->options->sortBy('order')->first()?->id;
            $poseByLabel = $poseQuestion->options->keyBy('label');

            foreach ($quiz->characters as $character) {
                $used = [];
                foreach ($character->cards as $card) {
                    $poseId = $poseByLabel->get($card->caption)?->id;
                    // Two cards claiming the same slot would violate the new unique
                    // key — drop the caption match for the duplicate and let the
                    // matrix sync re-home it.
                    if ($poseId === null || in_array($poseId, $used, true)) {
                        continue;
                    }
                    $used[] = $poseId;
                    DB::table('character_cards')->where('id', $card->id)->update([
                        'outfit_option_id' => $firstOutfitId,
                        'pose_option_id' => $poseId,
                    ]);
                }
            }

            // Any card that could not be pinned (no caption match, or a duplicate)
            // still has null dimensions and would collide on the unique key.
            DB::table('character_cards')
                ->whereIn('character_id', $quiz->characters->pluck('id'))
                ->whereNull('pose_option_id')
                ->delete();

            CardMatrixService::sync($quiz->fresh());
        }
    }

    public function down(): void
    {
        // Irreversible by nature: the generated slots and the pose question can be
        // dropped, but which photo belonged to which flat card is not recoverable.
    }
};
