<?php

namespace Tests\Feature;

use Database\Seeders\BabymQuizSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Smoke test for the API surface.
     *
     * This previously asserted GET / returned 200, which never held: routes/web.php
     * only registers /api/*, and nginx serves / from web/ as a static file, so the
     * Laravel app legitimately 404s there. Point it at a route that exists.
     */
    public function test_the_public_quiz_endpoint_returns_a_successful_response(): void
    {
        $this->seed(BabymQuizSeeder::class);

        $this->get('/api/quiz/vibe')
            ->assertOk()
            ->assertJsonStructure(['id', 'slug', 'characters', 'questions']);
    }
}
