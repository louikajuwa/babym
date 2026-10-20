<?php

namespace Database\Seeders;

use App\Models\CharacterCard;
use App\Models\Quiz;
use App\Services\CardMatrixService;
use Illuminate\Database\Seeder;

/**
 * Ports assets/js/data.js's seedQuizzes() literal content into real rows, so the
 * migrated system launches with the same campaign already in place. Character
 * photos start empty (null) — same as the mock — until uploaded via the admin.
 */
class BabymQuizSeeder extends Seeder
{
    public function run(): void
    {
        $quiz = Quiz::create([
            'name' => 'Which BABYM Are You?',
            'slug' => 'vibe',
            'status' => 'Active',
            'gate_enabled' => true,
            'hashtag' => '#MatchYourBias',
            'share_copy' => 'I got my BABYM match! Which member are you?',
            'show_copy_link' => true,
            'show_download' => true,
            'esign_enabled' => false,
            'meta' => [
                'design' => ['bg' => '#F2E9FF', 'button' => '#7C5CFF', 'text' => '#2B2540', 'accent' => '#5B3FD6'],
            ],
        ]);

        $quiz->consentItems()->createMany([
            ['text' => 'I agree to the terms of service and privacy policy.', 'required' => true, 'order' => 0],
            ['text' => 'Send me BABYM news and comeback updates by email.', 'required' => false, 'order' => 1],
        ]);

        $poseLabels = ['Studio concept', 'Stage close-up', 'Polaroid', 'Candid'];

        $characters = [
            ['RUKA', 'RUKA', 'R', 'Dream Purple', '#8B6FE8', 'linear-gradient(155deg,#a98cff,#6f4fd8 75%,#8f6bff)',
                "You're the quiet visionary — setting trends before anyone notices and turning ordinary moments a little magic.",
                'Its iridescent shimmer mirrors your imaginative, one-of-a-kind glow.'],
            ['PHAR', 'PHARITA', 'P', 'Sunset Coral', '#FF6B8A', 'linear-gradient(155deg,#ff9bb0,#ff5c7c 78%,#ff7ea0)',
                'Warm, spontaneous and impossible to ignore — you bring the heat and everyone feels it.',
                'It radiates the same bold, feel-good energy you carry into every room.'],
            ['ASA', 'ASA', 'A', 'Aqua Pop', '#2FC4D6', 'linear-gradient(155deg,#7fe3ef,#22b4c6 78%,#3fd0e0)',
                'Cool, composed and effortlessly at ease — the calm center your whole friend group orbits.',
                'Its crisp, refreshing tone matches your clear-headed, easy confidence.'],
            ['RAMI', 'RAMI', 'R', 'Neon Lime', '#8FCB2E', 'linear-gradient(155deg,#c6e86a,#83c122 78%,#a3d63a)',
                "Pure kinetic energy — playful, loud in the best way, and always down for a little chaos.",
                "It's as electric and impossible-to-miss as your hype-everyone-up spirit."],
            ['RORA', 'RORA', 'R', 'Golden Hour', '#F5A623', 'linear-gradient(155deg,#ffcf6b,#f39c12 78%,#ffb43a)',
                'Soft-hearted and romantic, you make people feel warm just by showing up.',
                'Its honeyed glow reflects the cozy warmth you give off.'],
            ['CHIQ', 'CHIQUITA', 'C', 'Bubblegum Rose', '#FF77C4', 'linear-gradient(155deg,#ffa8dd,#ff5cae 78%,#ff86cf)',
                'Sweet but never shy — playful, charming and always the one who makes the moment fun.',
                'Its punchy candy-pink tone captures your flirty, feel-good sparkle.'],
        ];

        $characterModels = [];
        foreach ($characters as $i => [$key, $name, $initial, $colorName, $color, $grad, $blurb, $why]) {
            $character = $quiz->characters()->create([
                'key' => $key, 'name' => $name, 'initial' => $initial,
                'color_name' => $colorName, 'color' => $color, 'grad' => $grad,
                'blurb' => $blurb, 'why' => $why, 'order' => $i,
            ]);
            // Cards are NOT created here any more — a card is a (outfit, pose)
            // slot, so the matrix can only be built once both dimension questions
            // exist. CardMatrixService::sync() does it at the end of this seeder.
            $characterModels[$key] = $character;
        }

        $questions = [
            ['What\'s your ideal weekend?', 'Pick the one that feels most you.', 'list', [
                ['A', 'Chill at home & recharge', 'Cozy, quiet, comfy', ['ASA' => 2, 'RUKA' => 1]],
                ['B', 'Spontaneous road trip', 'Anywhere, right now', ['PHAR' => 2]],
                ['C', 'Out with all your friends', 'The more the better', ['RAMI' => 2, 'CHIQ' => 1]],
                ['D', 'Deep in a passion project', 'Making something new', ['RUKA' => 2]],
            ]],
            ['Pick a concert outfit:', 'Which fit is unmistakably you?', 'grid', [
                ['A', 'All-black & edgy', '', ['RUKA' => 2]],
                ['B', 'Soft pastels', '', ['RORA' => 2]],
                ['C', 'Y2K & sparkly', '', ['CHIQ' => 2]],
                ['D', 'Chic & minimal', '', ['ASA' => 2]],
            ]],
            ['What\'s your camera style?', 'How you love your photos to look.', 'list', [
                ['A', 'Dreamy film grain', 'Soft & nostalgic', ['RORA' => 2]],
                ['B', 'Bright & saturated', 'Bold and loud', ['PHAR' => 2]],
                ['C', 'Moody low-light', 'Cinematic shadows', ['RUKA' => 2]],
                ['D', 'Clean & crisp', 'Sharp and true', ['ASA' => 2]],
            ]],
            ['How do friends describe you?', 'Be honest now.', 'list', [
                ['A', 'The hype energy', 'Never a dull moment', ['RAMI' => 2]],
                ['B', 'The calm anchor', 'Always steady', ['ASA' => 2]],
                ['C', 'The trendsetter', 'Always one step ahead', ['RUKA' => 2]],
                ['D', 'The warm heart', 'Everyone feels safe', ['CHIQ' => 1, 'RORA' => 1]],
            ]],
            ['Dream travel destination?', 'Where would you go tomorrow?', 'list', [
                ['A', 'Neon city nights', 'Lights, crowds, energy', ['PHAR' => 2]],
                ['B', 'Quiet seaside', 'Waves and salt air', ['ASA' => 2]],
                ['C', 'Mountain sunrise', 'Cold air, big views', ['RORA' => 2]],
                ['D', 'Art & museums', 'Galleries and cafes', ['RUKA' => 2]],
            ]],
            ['Pick a vibe track:', "What's on repeat right now?", 'list', [
                ['A', 'Hyperpop banger', 'Loud and fast', ['RAMI' => 2]],
                ['B', 'Bubblegum pop', 'Sweet and catchy', ['CHIQ' => 2]],
                ['C', 'Moody synthwave', 'Dark and dreamy', ['RUKA' => 2]],
                ['D', 'Feel-good pop', 'Pure serotonin', ['PHAR' => 2]],
            ]],
            // The second visual dimension. Like the outfit question this is a grid
            // question worth zero points — it picks the pose axis of the card
            // matrix, it does not influence which member you match.
            ['Pick your photo mood:', 'How should your card be shot?', 'grid', [
                ['A', $poseLabels[0], '', []],
                ['B', $poseLabels[1], '', []],
                ['C', $poseLabels[2], '', []],
                ['D', $poseLabels[3], '', []],
            ]],
        ];

        $gridQuestions = [];
        foreach ($questions as $i => [$title, $sub, $layout, $options]) {
            $question = $quiz->questions()->create(['title' => $title, 'sub' => $sub, 'layout' => $layout, 'order' => $i]);
            foreach ($options as $j => [$badge, $label, $optSub, $scores]) {
                $question->options()->create([
                    'badge' => $badge, 'label' => $label, 'sub' => $optSub ?: null,
                    'scores' => $layout === 'grid' ? [] : $scores, 'order' => $j,
                ]);
            }
            if ($layout === 'grid') {
                $gridQuestions[] = $question;
            }
        }

        // Designate the two visual dimensions explicitly. The first grid question
        // is the outfit axis, the second is the pose axis.
        $quiz->update([
            'outfit_question_id' => $gridQuestions[0]->id ?? null,
            'pose_question_id' => $gridQuestions[1]->id ?? null,
        ]);

        // Build the member x outfit x pose matrix: 6 x 4 x 4 = 96 cards.
        CardMatrixService::sync($quiz->fresh());

        $cardCount = CharacterCard::whereIn(
            'character_id',
            $quiz->characters()->pluck('id')
        )->count();

        $this->command?->info(
            "Seeded quiz #{$quiz->id} ({$quiz->slug}) with ".count($characters).' characters, '
            .count($questions)." questions and {$cardCount} cards "
            .'('.count($characters).' members x 4 outfits x 4 poses).'
        );
    }
}
