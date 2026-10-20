<?php

namespace Database\Seeders;

use App\Models\Quiz;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Ports assets/js/data.js's seedMembers() into real, DB-backed accounts (dev-only
 * password "password" for all — clearly not for a real deploy). The Owner's email
 * is deliberately swapped to admin@admin.com (seedMembers() used jae@babym.co)
 * so the existing demo login credentials keep working, now backed by real auth.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $quiz = Quiz::first();

        $owner = User::create([
            'name' => 'Jae Kim', 'email' => 'admin@admin.com', 'password' => Hash::make('password'),
            'role' => 'Owner', 'status' => 'Active', 'all_quizzes' => true,
        ]);

        User::create([
            'name' => 'Soo-ah Lim', 'email' => 'sooah@babym.co', 'password' => Hash::make('password'),
            'role' => 'Admin', 'status' => 'Active', 'all_quizzes' => true,
        ]);

        $scoped = [
            ['Marco Vitale', 'marco@studio.io', 'Editor', 'Active'],
            ['Hana Ito', 'hana@studio.io', 'Editor', 'Active'],
            ['Devon Cruz', 'devon@agency.com', 'Viewer', 'Invited'],
        ];
        foreach ($scoped as [$name, $email, $role, $status]) {
            $user = User::create([
                'name' => $name, 'email' => $email, 'password' => Hash::make('password'),
                'role' => $role, 'status' => $status, 'all_quizzes' => false,
            ]);
            if ($quiz) {
                $user->quizzes()->attach($quiz->id);
            }
        }

        $this->command?->info("Seeded 5 team members. Owner login: {$owner->email} / password");
    }
}
