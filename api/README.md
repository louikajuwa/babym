# BABYM API

Laravel JSON API for the BABYM quiz platform: quizzes, questions, options, characters, submissions, tracking and admin auth.

It runs inside the project's Docker stack. See the [root README](../README.md) for setup, services and tests.

```bash
# from the project root
docker compose exec app php artisan migrate --seed
docker compose exec app php artisan test
```
