<?php

namespace App\Services;

use App\Models\Character;
use App\Models\CharacterCard;
use App\Models\Quiz;

/**
 * Authoritative port of assets/js/utils.js's scoreWinner(): sums each answered
 * option's per-character points (grid/outfit questions never score), highest
 * total wins. The client runs the same algorithm for a snappy live progress UI,
 * but this is the source of truth a submission is actually recorded against.
 *
 * Scoring picks the MEMBER. The other two dimensions of the result card — outfit
 * and pose — come straight from the fan's answers to the quiz's two designated
 * grid questions, and resolveCard() maps the resulting triple to exactly one
 * card. Nothing here is random: the same answers always produce the same card.
 */
class QuizScorer
{
    /** @param array<int, int> $answersByQuestionId question_id => option_id */
    public static function score(Quiz $quiz, array $answersByQuestionId): ?Character
    {
        $characters = $quiz->characters;
        if ($characters->isEmpty()) {
            return null;
        }

        $totals = array_fill_keys($characters->pluck('key')->all(), 0);

        foreach ($quiz->questions as $question) {
            if ($question->layout === 'grid') {
                continue;
            }
            $optionId = $answersByQuestionId[$question->id] ?? null;
            if ($optionId === null) {
                continue;
            }
            $option = $question->options->firstWhere('id', (int) $optionId);
            if (!$option) {
                continue;
            }
            foreach (($option->scores ?? []) as $key => $points) {
                if (array_key_exists($key, $totals)) {
                    $totals[$key] += (float) $points;
                }
            }
        }

        $best = $characters->first();
        $bestScore = -INF;
        foreach ($characters as $character) {
            $score = $totals[$character->key] ?? 0;
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $character;
            }
        }

        return $best;
    }

    /**
     * The fan's answers to the quiz's two designated dimension questions.
     * These are the values that used to be collected and then discarded.
     *
     * @param  array<int, int>  $answersByQuestionId
     * @return array{0: int|null, 1: int|null} [outfitOptionId, poseOptionId]
     */
    public static function dimensionAnswers(Quiz $quiz, array $answersByQuestionId): array
    {
        $pick = function (?int $questionId) use ($quiz, $answersByQuestionId): ?int {
            if (!$questionId) {
                return null;
            }
            $optionId = $answersByQuestionId[$questionId] ?? null;
            if ($optionId === null) {
                return null;
            }
            // Only trust an option that really belongs to that question — a
            // client could otherwise post any option id and pull an unrelated card.
            $question = $quiz->questions->firstWhere('id', $questionId);
            $option = $question?->options->firstWhere('id', (int) $optionId);

            return $option?->id;
        };

        return [$pick($quiz->outfit_question_id), $pick($quiz->pose_question_id)];
    }

    /**
     * Resolve the one card bound to this (member, outfit, pose) triple.
     *
     * Deterministic by design: identical answers always yield the identical
     * card. The fallback chain only engages when the matrix is incomplete (a
     * dimension unconfigured, or a slot not yet generated) so a half-set-up
     * quiz degrades to a sensible card instead of a 500.
     */
    public static function resolveCard(Character $character, ?int $outfitOptionId, ?int $poseOptionId): ?CharacterCard
    {
        $cards = $character->cards;
        if ($cards->isEmpty()) {
            return null;
        }

        // 1. Exact triple — the expected path.
        $exact = $cards->first(fn (CharacterCard $c) => $c->outfit_option_id === $outfitOptionId
            && $c->pose_option_id === $poseOptionId);
        if ($exact) {
            return $exact;
        }

        // 2. Right outfit, any pose (pose question unanswered or unconfigured).
        if ($outfitOptionId !== null) {
            $sameOutfit = $cards->first(fn (CharacterCard $c) => $c->outfit_option_id === $outfitOptionId);
            if ($sameOutfit) {
                return $sameOutfit;
            }
        }

        // 3. Right pose, any outfit (outfit question unanswered or unconfigured).
        if ($poseOptionId !== null) {
            $samePose = $cards->first(fn (CharacterCard $c) => $c->pose_option_id === $poseOptionId);
            if ($samePose) {
                return $samePose;
            }
        }

        // 4. Anything, deterministically — first by order, never random.
        return $cards->sortBy('order')->first();
    }
}
