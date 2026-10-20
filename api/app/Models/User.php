<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'role', 'status', 'permissions', 'all_quizzes'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** Mirrors data.js's FEATURES() — the admin sections a role/permission grant covers. */
    public const FEATURES = ['dashboard', 'quizzes', 'builder', 'results', 'submissions', 'analytics', 'design', 'team'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'permissions' => 'array',
            'all_quizzes' => 'boolean',
        ];
    }

    public function quizzes(): BelongsToMany
    {
        return $this->belongsToMany(Quiz::class);
    }

    /** Mirrors data.js's rolePreset(role). */
    public static function rolePreset(string $role): array
    {
        $all = array_fill_keys(self::FEATURES, true);
        $none = array_fill_keys(self::FEATURES, false);

        if (in_array($role, ['Owner', 'Admin'], true)) {
            return $all;
        }
        if ($role === 'Editor') {
            return array_merge($none, array_fill_keys(
                ['dashboard', 'quizzes', 'builder', 'results', 'submissions', 'analytics', 'design'],
                true
            ));
        }

        return array_merge($none, array_fill_keys(['dashboard', 'submissions', 'analytics'], true));
    }

    /** Mirrors data.js's effPerms(member): explicit per-feature overrides, else the role preset. */
    public function effectivePermissions(): array
    {
        return $this->permissions ?? self::rolePreset($this->role);
    }

    public function hasFeature(string $feature): bool
    {
        return (bool) ($this->effectivePermissions()[$feature] ?? false);
    }

    public function canAccessQuiz(int $quizId): bool
    {
        return $this->all_quizzes || $this->quizzes()->where('quizzes.id', $quizId)->exists();
    }
}
