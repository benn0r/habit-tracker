# Ritual

A Todoist-powered habit tracker. Ritual discovers tasks tagged `habit`, imports a year of completion history, and compares what happened with the task's recurrence or a custom rhythm.

## Features

- Todoist OAuth with read-only `data:read` scope
- Automatic discovery of active `@habit` tasks
- 12-month completion and miss heatmap
- Schedule overrides: daily, every two days, and four times per week
- PostgreSQL persistence and scheduled sync endpoint
- Production Docker image and Compose stack

## Local development

1. Create a Todoist app and set its OAuth redirect URL to `http://localhost:3000/api/auth/callback`.
2. Copy `.env.example` to `.env` and fill in the credentials.
3. Start PostgreSQL and set `DATABASE_URL`, or run the Compose stack.
4. Run `npm install && npm run dev`.

## Coolify

Deploy this repository as a Docker Compose resource. Set every value from `.env.example`, and set `APP_URL` to the public HTTPS URL. In the Todoist App Management Console, add:

`https://YOUR_DOMAIN/api/auth/callback`

The app health endpoint is `/api/health`. For automatic imports, schedule a GET request to `/api/sync` with `Authorization: Bearer $CRON_SECRET` (for example, every six hours). Manual sync remains available in the dashboard.

Todoist's availability of historical completed tasks depends on the user's Todoist plan.
