# মেধাবিকাশ শিক্ষালয় — LMS

Bengali learning platform: courses, live classes (YouTube, streamed from the browser), notes and videos, exams, assignments, attendance, Q&A, certificates, coupons, monthly fees and an AI helper.

## Stack
- **Backend:** NestJS 12 (TypeScript), Prisma 7, PostgreSQL 17, ffmpeg, ws
- **Frontend:** Next.js 16 (App Router), React, Tailwind CSS 4
- **Deploy:** Docker Compose (postgres, backend :3101, frontend :3100) behind Caddy (HTTPS)
- **Extras:** `bridge/` runs `opencode` on the host for the AI chat

## Run
```bash
cp backend.env.example backend.env      # fill it in
echo "POSTGRES_PASSWORD=choose-one" > .env
docker compose up -d --build
docker compose run --rm --no-deps backend npx prisma migrate deploy
```
Caddy: send `/api/*` and `/uploads/*` to `127.0.0.1:3101`, everything else to `127.0.0.1:3100`.

## Notes
- Migrations live in `backend/prisma/migrations`; apply them from the rebuilt image.
- Live classes need a YouTube channel connected in Admin → Settings.
- Admin accounts can enable Google Authenticator (2-step login) in Admin → Settings.
