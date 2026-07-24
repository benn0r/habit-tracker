# Habit Tracker

A Todoist-powered habit tracker. Habit Tracker discovers tasks tagged `habit`, imports a year of completion history, and compares what happened with the task's recurrence or a custom rhythm.

## Features

- Todoist OAuth with read-only `data:read` scope
- Automatic discovery of active `@habit` tasks
- 12-month completion and miss heatmap
- Schedule overrides: daily, every two days, and four times per week
- SQLite persistence and scheduled sync endpoint
- Production Docker image and Compose stack

## Local development

1. Create a Todoist app and set its OAuth redirect URL to `http://localhost:3000/api/auth/callback`.
2. Copy `.env.example` to `.env` and fill in the credentials.
3. Set `SQLITE_PATH` if you do not want the default `./data/habit.db`.
4. Run `npm install && npm run dev`.

## Coolify

Gitea Actions validates every change and publishes a Docker image for each
pushed branch to `git.example.com/example-user/habit-tracker`. The `main` branch is
published as `git.example.com/example-user/habit-tracker:main`; obsolete branch
images are removed automatically. Add a repository Actions secret named
`REGISTRY_TOKEN` containing a Gitea token with package read/write permission.

Deploy the `:main` image as a Docker Image application, expose port `3000`, and
configure the health check as `GET /api/health`. Mount a persistent volume at
`/data` and set every application value from `.env.example`, with `APP_URL` set
to the public HTTPS URL. In the Todoist App Management Console, add:

`https://YOUR_DOMAIN/api/auth/callback`

The app health endpoint is `/api/health`. For automatic imports, schedule a GET request to `/api/sync` with `Authorization: Bearer $CRON_SECRET` (for example, every six hours). Manual sync remains available in the dashboard.

Todoist's availability of historical completed tasks depends on the user's Todoist plan.
