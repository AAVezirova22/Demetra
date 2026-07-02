# Demetra

Demetra is a school music events platform. It connects music schools, choirs, and student clubs with the students who attend their concerts, recitals, and rehearsals.

## What it does

- **Events & registration** — organizers publish events with dates, venue capacity, and pricing; students browse and register in a couple of clicks. Full events automatically switch to a waitlist.
- **Seat selection** — students pick their exact seat on the venue map, with standard and VIP tiers.
- **Stage designer** — organizers design venue layouts with rows, seats, and stage shapes.
- **Organizations** — music schools, conservatories, choirs, and clubs with member invitations via a single link.
- **Announcements & notifications** — organization posts reach every member; invitations, announcements, and event reminders arrive in-app and are mirrored to email when SMTP is configured.
- **Practice room** — a built-in browser instrument room with playable piano, violin, guitar, flute, and drums (Web Audio API), plus practice notes.
- **Account protection** — repeated wrong passwords trigger a warning and temporarily lock login.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, GSAP (parallax landing), Tailwind CSS |
| Backend | Node.js, Express, Socket.IO, Prisma ORM |
| Database | MySQL 8.4 |
| Queue / realtime | Redis 7 (outbox worker + socket broadcasts) |
| Gateway | nginx |
| Dev tooling | Docker Compose, Adminer |

## Project structure

```
backend/    Express API, Socket.IO server, outbox worker, SMTP email
frontend/   React app (features: auth, events, dashboard, instruments, profile)
prisma/     Prisma schema (users, organizations, events, registrations, notifications)
nginx/      Gateway config
scripts/    Development helper scripts
```
