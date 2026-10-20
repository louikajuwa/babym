<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    private function toApiArray(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'quizzes' => $user->all_quizzes ? 'all' : $user->quizzes()->pluck('quizzes.id')->all(),
            'perms' => $user->permissions,
        ];
    }

    public function index()
    {
        return response()->json(User::orderBy('id')->get()->map(fn (User $u) => $this->toApiArray($u))->all());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', 'unique:users,email'],
            'role' => ['required', 'string'],
            'status' => ['nullable', 'string'],
            'quizzesAll' => ['boolean'],
            'quizzes' => ['array'],
            'perms' => ['nullable', 'array'],
        ]);

        $allQuizzes = $data['quizzesAll'] || in_array($data['role'], ['Owner', 'Admin'], true);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make(Str::random(24)),
            'role' => $data['role'],
            'status' => $data['status'] ?? 'Invited',
            'permissions' => $data['perms'] ?? null,
            'all_quizzes' => $allQuizzes,
        ]);

        if (!$allQuizzes) {
            $user->quizzes()->sync($data['quizzes'] ?? []);
        }

        return response()->json($this->toApiArray($user), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'email' => ['sometimes', 'email', 'unique:users,email,'.$user->id],
            'role' => ['sometimes', 'string'],
            'status' => ['sometimes', 'string'],
            'quizzesAll' => ['sometimes', 'boolean'],
            'quizzes' => ['sometimes', 'array'],
            'perms' => ['sometimes', 'nullable', 'array'],
        ]);

        $role = $data['role'] ?? $user->role;
        $allQuizzes = ($data['quizzesAll'] ?? $user->all_quizzes) || in_array($role, ['Owner', 'Admin'], true);

        $user->fill([
            'name' => $data['name'] ?? $user->name,
            'email' => $data['email'] ?? $user->email,
            'role' => $role,
            'status' => $data['status'] ?? $user->status,
            'permissions' => array_key_exists('perms', $data) ? $data['perms'] : $user->permissions,
            'all_quizzes' => $allQuizzes,
        ])->save();

        if (array_key_exists('quizzes', $data) && !$allQuizzes) {
            $user->quizzes()->sync($data['quizzes']);
        }

        return response()->json($this->toApiArray($user));
    }

    public function destroy(User $user)
    {
        if ($user->role === 'Owner') {
            abort(422, 'The Owner account cannot be removed.');
        }
        $user->delete();

        return response()->json(['ok' => true]);
    }
}
