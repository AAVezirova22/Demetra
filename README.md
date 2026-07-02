<p align="center">
  <a href="https://strix.ai/">
    <img src="https://cdn.discordapp.com/attachments/1021731951708741644/1522337147598802964/cover.jpg?ex=6a481a73&is=6a46c8f3&hm=dac3f98d928a98371dab71945850823739d598653548f34cce2ae6717610b981&" alt="Demetra Banner" width="100%">
  </a>
</p>


<div align="center">

# Demetra

### School music events platform. It connects music schools, choirs, and student clubs with the students who attend their concerts, recitals, and rehearsals.
<a href="https://quadrant-feisty-ladies.ngrok-free.dev/"><img src="https://img.shields.io/badge/Website-demetra-f0f0f0?style=for-the-badge&logoColor=white" alt="Website"></a>
</div>


## ☁️ What it does

- **Events & registration** — organizers publish events with dates, venue capacity, and pricing; students browse and register in a couple of clicks. Full events automatically switch to a waitlist.
- **Seat selection** — students pick their exact seat on the venue map, with standard and VIP tiers.
- **Stage designer** — organizers design venue layouts with rows, seats, and stage shapes.
- **Organizations** — music schools, conservatories, choirs, and clubs with member invitations via a single link.
- **Announcements & notifications** — organization posts reach every member; invitations, announcements, and event reminders arrive in-app and are mirrored to email when SMTP is configured.
- **Practice room** — a built-in browser instrument room with playable piano, violin, guitar, flute, and drums (Web Audio API), plus practice notes.
- **Account protection** — repeated wrong passwords trigger a warning and temporarily lock login.
<div align="center">
  
## 🚀 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, GSAP (parallax landing), Tailwind CSS |
| Backend | Node.js, Express, Socket.IO, Prisma ORM |
| Database | MySQL 8.4 |
| Queue / realtime | Redis 7 (outbox worker + socket broadcasts) |
| Gateway | nginx |
| Dev tooling | Docker Compose, Adminer |

</div>

## 📁 Project structure

```
backend/    Express API, Socket.IO server, outbox worker, SMTP email
frontend/   React app (features: auth, events, dashboard, instruments, profile)
prisma/     Prisma schema (users, organizations, events, registrations, notifications)
nginx/      Gateway config
scripts/    Development helper scripts
```
