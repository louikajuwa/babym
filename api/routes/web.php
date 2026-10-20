<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CharacterCardController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\OptionController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\RealtimeController;
use App\Http\Controllers\Api\SubmissionController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\TrackingController;
use Illuminate\Support\Facades\Route;

// Everything lives under /api on the SAME origin as the static frontend (nginx
// proxies /api/* here) and rides the default 'web' middleware group (session
// cookies) rather than routes/api.php's stateless 'api' group — this is a
// same-origin admin tool, not a cross-origin SPA, so plain session auth is the
// right fit and needs no Sanctum. CSRF is exempted for api/* in bootstrap/app.php
// since the static HTML frontend has no Blade-rendered token to send.

Route::prefix('api')->group(function () {
    // ---------- public: quiz-taking flow ----------
    Route::get('/quiz/{slug}', [QuizController::class, 'showBySlug']);
    Route::post('/quiz/{slug}/events', [TrackingController::class, 'store']);
    Route::post('/quiz/{slug}/submissions', [SubmissionController::class, 'store']);

    // ---------- auth ----------
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // ---------- admin (session auth required) ----------
    Route::middleware('auth')->group(function () {
        Route::get('/realtime/token', [RealtimeController::class, 'token']);

        Route::get('/quizzes', [QuizController::class, 'index']);
        Route::post('/quizzes', [QuizController::class, 'store'])->middleware('feature:quizzes');
        Route::get('/quizzes/{quiz}', [QuizController::class, 'show']);
        Route::put('/quizzes/{quiz}', [QuizController::class, 'update']);
        Route::delete('/quizzes/{quiz}', [QuizController::class, 'destroy'])->middleware('feature:quizzes');
        Route::get('/quizzes/{quiz}/analytics', [QuizController::class, 'analytics'])->middleware('feature:analytics');
        Route::get('/quizzes/{quiz}/submissions', [SubmissionController::class, 'index'])->middleware('feature:submissions');

        Route::post('/quizzes/{quiz}/consent-items', [QuizController::class, 'storeConsentItem'])->middleware('feature:design');
        Route::put('/consent-items/{consentItem}', [QuizController::class, 'updateConsentItem'])->middleware('feature:design');
        Route::post('/consent-items/{consentItem}/move', [QuizController::class, 'moveConsentItem'])->middleware('feature:design');
        Route::delete('/consent-items/{consentItem}', [QuizController::class, 'destroyConsentItem'])->middleware('feature:design');

        Route::post('/quizzes/{quiz}/questions', [QuestionController::class, 'store'])->middleware('feature:builder');
        Route::put('/quizzes/{quiz}/questions/reorder', [QuestionController::class, 'reorder'])->middleware('feature:builder');
        Route::put('/questions/{question}', [QuestionController::class, 'update'])->middleware('feature:builder');
        Route::delete('/questions/{question}', [QuestionController::class, 'destroy'])->middleware('feature:builder');
        Route::post('/options/{option}/image', [OptionController::class, 'uploadImage'])->middleware('feature:builder');

        Route::post('/quizzes/{quiz}/characters', [CharacterController::class, 'store'])->middleware('feature:results');
        Route::put('/characters/{character}', [CharacterController::class, 'update'])->middleware('feature:results');
        Route::delete('/characters/{character}', [CharacterController::class, 'destroy'])->middleware('feature:results');
        Route::put('/cards/{card}', [CharacterCardController::class, 'update'])->middleware('feature:results');
        Route::post('/cards/{card}/photo', [CharacterCardController::class, 'uploadPhoto'])->middleware('feature:results');
        Route::delete('/cards/{card}', [CharacterCardController::class, 'destroy'])->middleware('feature:results');

        Route::get('/submissions', [SubmissionController::class, 'index'])->middleware('feature:submissions');
        Route::get('/submissions/export', [SubmissionController::class, 'export'])->middleware('feature:submissions');
        Route::get('/submissions/{submission}', [SubmissionController::class, 'show'])->middleware('feature:submissions');
        Route::delete('/submissions/{submission}', [SubmissionController::class, 'destroy'])->middleware('feature:submissions');

        Route::get('/team', [TeamController::class, 'index'])->middleware('feature:team');
        Route::post('/team', [TeamController::class, 'store'])->middleware('feature:team');
        Route::put('/team/{user}', [TeamController::class, 'update'])->middleware('feature:team');
        Route::delete('/team/{user}', [TeamController::class, 'destroy'])->middleware('feature:team');
    });
});
