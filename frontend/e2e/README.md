# Demetra Playwright QA

This folder contains the automated browser QA suite for Demetra.

## What It Checks

- Authentication screens and password validation.
- Student dashboard access for organization members.
- Permission guard: students cannot see organization management controls.
- Organizer controls for events, stage layouts, settings, and news posts.
- Organization news image posting.
- Event browsing and registration.
- Profile editing and save feedback.

## How It Works

The tests run the real React/Vite frontend in Chromium and mobile Chromium. API calls are intercepted with Playwright route mocks in `e2e/fixtures/api.ts`.

This makes the QA suite deterministic and presentation-friendly:

- It does not require MySQL, Redis, nginx, or the backend container.
- It still tests the real UI, routing, localStorage auth behavior, form validation, and API integration points.
- It verifies important payloads, including that post images are sent as `data:image/*`.

## Commands

Install dependencies:

```powershell
cd frontend
npm install
npx playwright install
```

Run the full E2E suite:

```powershell
cd frontend
npm run test:e2e
```

Open the Playwright interactive runner:

```powershell
cd frontend
npm run test:e2e:ui
```

Open the latest HTML report:

```powershell
cd frontend
npm run test:e2e:report
```

## Presentation Talking Point

The Playwright QA suite proves the most important user-facing behavior from a real browser:

- a student can authenticate and register for an event,
- a student cannot edit organization management information,
- an organizer can publish news with an image,
- profile edits persist through the API integration point.

