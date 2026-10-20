<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;

/**
 * Bridges Laravel to the standalone socket-server/ Node relay: mints handshake
 * tokens it can verify, and publishes events onto the Redis channel it relays
 * to Socket.IO rooms. Token contract must match socket-server/index.js exactly:
 * base64url(json payload).hex(hmacSHA256(that base64url string, secret)).
 */
class Realtime
{
    public static function token(int $uid, array $rooms, int $ttlSeconds = 3600): string
    {
        $payload = json_encode(['uid' => $uid, 'rooms' => $rooms, 'exp' => time() + $ttlSeconds]);
        $body = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $body, (string) config('services.socket.secret'));

        return $body.'.'.$signature;
    }

    public static function publish(string $event, string $room, array $payload = []): void
    {
        if (!config('services.socket.secret')) {
            return;
        }
        // The 'realtime' connection carries no key prefix — see config/database.php.
        // Publishing on the default connection would prefix the channel name and the
        // Node relay, which subscribes to the raw name, would never see the event.
        // Live updates are best-effort: callers publish after their write has been
        // committed, so a Redis outage must be logged, not turned into a 500 that
        // invites the client to retry (and duplicate) an already-saved action.
        try {
            Redis::connection('realtime')->publish(config('services.socket.channel'), json_encode([
                'event' => $event,
                'room' => $room,
                'payload' => $payload,
            ]));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
