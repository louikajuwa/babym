<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Pin the test database to in-memory SQLite, in code.
     *
     * phpunit.xml's <env DB_CONNECTION="sqlite"> is NOT sufficient here:
     * docker-compose injects api/.env through env_file, so DB_CONNECTION=mysql
     * is a genuine process environment variable inside the container and wins
     * over the XML. The practical consequence was severe — any `php artisan
     * test` run booted RefreshDatabase against the live MySQL dev database and
     * truncated it.
     *
     * Forcing it at application-boot closes that hole regardless of what the
     * surrounding environment says.
     */
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);

        // Keep tests off the real Redis/broadcast infrastructure too.
        $app['config']->set('cache.default', 'array');
        $app['config']->set('session.driver', 'array');
        $app['config']->set('queue.default', 'sync');
        $app['config']->set('broadcasting.default', 'null');
        // Realtime::publish() goes straight to Redis whenever a socket secret is
        // configured, and api/.env supplies one. Without this, every submission
        // test hit the real Redis (or 500'd when it wasn't running).
        $app['config']->set('services.socket.secret', null);

        return $app;
    }
}
