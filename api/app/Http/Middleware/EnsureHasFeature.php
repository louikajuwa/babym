<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureHasFeature
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();
        if (!$user || !$user->hasFeature($feature)) {
            abort(403, 'You do not have access to this feature.');
        }

        return $next($request);
    }
}
