# BABYM — "Which member are you?" quiz

Personality-quiz platform: visitors take a quiz and get matched to a character card, while admins build quizzes and watch live analytics.

**Stack:** Laravel API (PHP 8.3) · static web front end (HTML + Tailwind + jQuery) · MySQL · Redis · Socket.IO · Docker

## Repository layout

| Folder | What it is |
|--------|------------|
| `api/` | Laravel JSON API: quizzes, questions, options, characters, submissions, tracking, auth |
| `web/` | Static public quiz site and admin pages, served by nginx |
| `socket-server/` | Node.js Socket.IO server that bridges Redis pub/sub to the admin live dashboard |
| `docker/` | PHP and nginx images/config |

## Quick start

```bash
cp .env.example .env
cp api/.env.example api/.env       # then fill in your own values
docker compose up -d --build
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

| Service | URL |
|---------|-----|
| Site | http://localhost:8092 |
| phpMyAdmin | http://localhost:8093 |
| Mailpit | http://localhost:8026 |

## Tests

```bash
docker compose exec app php artisan test
```

Tests use an in-memory SQLite database, so your MySQL data is never touched.
