# Demetra Automated QA Plan

This document explains how automated quality assurance should be presented for Demetra, where the QA files should live in the repository, how the checks are made, and what parts of the system they verify.

Demetra is a full-stack event platform with a React frontend, Express API, Prisma/MySQL database, Redis-backed realtime broadcasts, and a background worker. The automated QA strategy should therefore cover three levels:

- Static checks: TypeScript, linting, and production build checks.
- Backend API/integration tests: authentication, organization access, event registration, waitlists, notifications, and data validation.
- Frontend end-to-end tests: real user workflows in the browser, including organizer and student journeys.

The goal is not only to prove that individual functions work. The goal is to prove that the most important product flows keep working when the project changes.

## 1. Where To Put It

Recommended repository structure:

```text
Demetra/
  documents/
    automated-qa.md

  backend/
    tests/
      auth.test.ts
      organization.test.ts
      events.test.ts
      registrations.test.ts
      notifications.test.ts
      worker.test.ts
      helpers/
        test-db.ts
        test-users.ts
        test-server.ts

  frontend/
    e2e/
      auth.spec.ts
      dashboard.spec.ts
      events.spec.ts
      profile.spec.ts
      organization-news.spec.ts
      permissions.spec.ts
      fixtures/
        users.ts
        seed.ts

    tests/
      api-client.test.ts
      profile-image.test.ts

  scripts/
    qa.ps1
```

For presentation, keep this document in:

```text
documents/automated-qa.md
```

That location is best because `documents/` already contains the technical architecture and presentation material. You can open this Markdown file during the presentation, export it to PDF, or copy the key sections into slides.

Implemented Playwright QA files in this project:

```text
frontend/
  playwright.config.ts
  e2e/
    README.md
    auth.spec.ts
    events.spec.ts
    organization-news.spec.ts
    permissions.spec.ts
    profile.spec.ts
    fixtures/
      api.ts
```

The current suite contains 16 checks because each scenario runs in desktop Chromium and mobile Chromium.

## 2. Recommended Tools

### Frontend

Use:

- Playwright for browser end-to-end tests.
- Vitest for small frontend unit tests.
- TypeScript build checks through the existing Vite setup.

Why:

- Playwright tests the app like a real user.
- Vitest is fast for isolated utilities such as image compression helpers or API client behavior.
- `npm run build` verifies TypeScript and production bundling.

### Backend

Use:

- Vitest or Jest for API and worker tests.
- Supertest for HTTP API route tests.
- A test MySQL database for integration tests.
- Prisma test seed helpers to create users, organizations, events, registrations, and notifications.

Why:

- Most Demetra backend logic depends on database state, permissions, transactions, and Prisma models. Integration tests are more useful than isolated mocks for these flows.
- Supertest can call Express routes without manually starting a separate HTTP server.

### Full Project

Use:

- A root QA script that runs all checks in order.
- Docker Compose for a stable local test environment when database/Redis tests are needed.

Recommended command:

```powershell
.\scripts\qa-playwright.ps1
```

The script should run:

```text
frontend build
frontend tests
frontend e2e tests
backend tests
backend build/type checks
```

## 3. QA Commands To Present

These are the commands that should be shown in the presentation.

### Frontend Build

```powershell
cd frontend
npm run build
```

Checks:

- React app compiles.
- TypeScript types are valid.
- Vite can produce a production bundle.
- CSS imports and assets resolve correctly.

### Frontend End-To-End Tests

```powershell
cd frontend
npm run test:e2e
```

Checks:

- Users can register and log in.
- Students can browse events.
- Students can select seats and register.
- Organizers can use the dashboard.
- Organization news posts can include images.
- Profile page loads and saves profile details.
- Students cannot access organizer-only controls.

One-time browser setup:

```powershell
cd frontend
npx playwright install chromium
```

This downloads the browser binary used by Playwright. If the machine has no free space, this step fails before tests can run.

### Backend Tests

```powershell
cd backend
npm test
```

Checks:

- API validation.
- Authentication and lockout behavior.
- Organization membership and management permissions.
- Event creation and updates.
- Registration capacity, waitlist, and seat assignment.
- Notification creation.
- Worker outbox processing.

### Full QA Script

```powershell
.\scripts\qa-playwright.ps1
```

Checks everything from one command. This is the best command to demonstrate because it shows the project has a repeatable QA process.

## 4. What The Automated QA Checks

## 4.1 Static And Build Checks

Static and build checks are the first gate.

They verify:

- TypeScript code has no type errors.
- React components compile.
- API client types match expected data shapes.
- CSS and image assets are included correctly.
- The app can be packaged for production.

Example command:

```powershell
cd frontend
npm run build
```

Presentation explanation:

"This check catches broken imports, invalid TypeScript, component errors, and production build issues before the app is manually tested."

## 4.2 Authentication QA

Files:

```text
backend/tests/auth.test.ts
frontend/e2e/auth.spec.ts
```

Checks:

- A student can register.
- An organizer can register.
- Login works with a valid email and password.
- Login fails with the wrong password.
- Repeated wrong passwords trigger warning/lockout behavior.
- Auth token is returned after successful login.
- `/api/auth/me` returns the current user when a valid token is supplied.
- Protected routes reject requests without a token.

Why it matters:

Authentication is the entry point for all protected workflows. If this breaks, dashboard, events, profile, notifications, and organization features all break.

Example E2E scenario:

```text
1. Open login page.
2. Enter known student credentials.
3. Submit.
4. Expect navbar to show the user.
5. Open profile/dashboard area.
6. Confirm the user remains authenticated after navigation.
```

## 4.3 Organization And Permission QA

Files:

```text
backend/tests/organization.test.ts
frontend/e2e/permissions.spec.ts
frontend/e2e/dashboard.spec.ts
```

Checks:

- Organizer can create an organization.
- Organizer owner can invite members.
- Organizer owner can create events, layouts, and posts.
- Student member can view organization data.
- Student member cannot edit organization settings.
- Student member cannot create events.
- Student member cannot create stage layouts.
- Student member cannot remove members.
- Student member cannot publish organization posts.
- Teacher account without organizer membership cannot manage the organization.
- Organizer membership can manage organization resources.

Why it matters:

Demetra has both global user roles and organization membership roles. QA must prove that being a member of an organization does not automatically grant management permissions.

Important bug this protects against:

```text
A student inside an organization should not be able to edit organization information.
```

Expected result:

- The settings and stage-layout sections are hidden from students.
- Direct API calls from students return `403`.
- UI save buttons for organization profile are not available to students.

## 4.4 Event Creation QA

Files:

```text
backend/tests/events.test.ts
frontend/e2e/events.spec.ts
frontend/e2e/dashboard.spec.ts
```

Checks:

- Organizer can create an event.
- Event requires valid title, capacity, price, and date values.
- Event appears in public event listing after creation.
- Organizer can edit an open event.
- Organizer cannot reduce capacity below confirmed registration count.
- Organizer can cancel an event.
- Cancelled event no longer behaves like an open event.
- Event location is displayed on event cards and detail pages.
- Google Maps link/embed appears when location exists.

Why it matters:

Events are the main product object. These tests prove that event publishing and management workflows are stable.

## 4.5 Seat Selection And Registration QA

Files:

```text
backend/tests/registrations.test.ts
frontend/e2e/events.spec.ts
```

Checks:

- Student can register for an event with available capacity.
- Student can choose a seat when the event has a seating map.
- Blocked seats cannot be selected.
- Already taken seats cannot be selected.
- VIP seats store VIP seat type.
- Standard seats store standard seat type.
- Registration count increases after confirmed registration.
- Student can cancel registration.
- Registration count decreases after cancellation when no waitlist promotion happens.
- User cannot create duplicate active registrations for the same event.

Why it matters:

This is one of the highest-risk parts of the system because it affects capacity, payments/pricing display, and seat assignment.

## 4.6 Waitlist QA

Files:

```text
backend/tests/registrations.test.ts
frontend/e2e/events.spec.ts
```

Checks:

- Full event creates waitlisted registration.
- Waitlist position is calculated correctly.
- When a confirmed student cancels, the oldest waitlisted user is promoted.
- Promoted user becomes confirmed.
- Waitlist position updates for remaining waitlisted users.
- Notifications are created for waitlist and promotion events.

Why it matters:

The waitlist logic protects event capacity while still allowing students to join full events.

High-value backend test:

```text
1. Create event with capacity 1.
2. Register student A.
3. Register student B.
4. Expect A to be CONFIRMED.
5. Expect B to be WAITLISTED.
6. Cancel A registration.
7. Expect B to become CONFIRMED.
```

## 4.7 Registration Concurrency QA

Files:

```text
backend/tests/registrations.test.ts
```

Checks:

- Multiple students registering at the same time do not oversell the event.
- Two students cannot get the same seat.
- Confirmed registration count never exceeds event capacity.
- Overflow users go to waitlist.

Why it matters:

The backend uses database transactions and row locking to protect capacity. Automated QA should prove this behavior.

Example test idea:

```text
1. Create event with capacity 2.
2. Start 5 registration requests in parallel.
3. Wait for all requests to finish.
4. Expect exactly 2 CONFIRMED registrations.
5. Expect exactly 3 WAITLISTED registrations.
6. Expect no duplicate seat labels.
```

## 4.8 Organization News And Image Posting QA

Files:

```text
backend/tests/organization.test.ts
frontend/e2e/organization-news.spec.ts
frontend/tests/profile-image.test.ts
```

Checks:

- Organizer can create an organization news post.
- Organizer can attach an image to a post.
- Frontend accepts image files only.
- Frontend compresses image before submission.
- Backend rejects non-image data.
- Backend rejects oversized image data.
- News card displays image thumbnail.
- News detail page displays full post image.
- Student members can view posts.
- Student members receive notification for organization post.
- Student members cannot create posts.

Why it matters:

News posts are organization-wide announcements. Image upload adds extra validation risk, so QA must check both UI behavior and backend input validation.

Expected backend validation:

```text
image must be empty/null or a data:image/* URL under 1 MB
```

## 4.9 Profile QA

Files:

```text
backend/tests/profile.test.ts
frontend/e2e/profile.spec.ts
frontend/tests/profile-image.test.ts
```

Checks:

- User can load their profile.
- User can update display name.
- User can update headline, location, bio, phone, and website.
- Updated display name appears in app navigation.
- Avatar image upload works.
- Avatar image is compressed before save.
- Backend rejects non-image avatar data.
- Backend rejects oversized avatar data.
- Profile page stays responsive on desktop and mobile widths.

Why it matters:

The profile page is user-facing and stores personal data. QA should verify both the save behavior and visual stability.

## 4.10 Stage Layout QA

Files:

```text
backend/tests/stage-layouts.test.ts
frontend/e2e/dashboard.spec.ts
```

Checks:

- Organizer can create a stage layout.
- Organizer can edit layout rows and columns.
- Organizer can paint seats as available, taken, VIP, or blocked.
- Organizer can delete a layout.
- Student cannot create, edit, or delete layouts.
- Invalid row/column values are rejected.
- Invalid seat statuses are rejected.
- Layout can be used when creating an event.

Why it matters:

Stage layouts feed directly into event seat selection. Bad layout data can break registration.

## 4.11 Notifications QA

Files:

```text
backend/tests/notifications.test.ts
frontend/e2e/dashboard.spec.ts
```

Checks:

- User can list notifications.
- Unread count is correct.
- User can mark one notification as read.
- User can mark all notifications as read.
- Organization invitation creates notification for existing users.
- Organization post creates notifications for members.
- Event registration creates notification through outbox worker.
- Event cancellation creates notification for affected users.

Why it matters:

Notifications connect many workflows. If they fail, users lose important event and organization updates.

## 4.12 Worker And Outbox QA

Files:

```text
backend/tests/worker.test.ts
```

Checks:

- Outbox event is created when a user registers.
- Worker processes pending outbox events.
- Processed outbox rows become `PROCESSED`.
- Failed rows retry until max attempts.
- Worker creates notifications from outbox events.
- Worker publishes Redis broadcast after processing.
- Event reminders are enqueued for upcoming events.
- Duplicate reminder jobs are not created for the same event.

Why it matters:

The worker is responsible for reliable asynchronous behavior. QA must prove that background jobs are not lost.

## 4.13 Realtime QA

Files:

```text
frontend/e2e/notifications.spec.ts
backend/tests/worker.test.ts
```

Checks:

- Browser connects to Socket.IO.
- Worker broadcasts processed event through Redis.
- API receives Redis message.
- API emits Socket.IO event.
- Frontend refreshes relevant data after realtime event.

Why it matters:

Realtime behavior is part of the user experience for registrations, waitlist promotions, and notifications.

## 5. Test Data Strategy

Automated QA should use deterministic test data.

Recommended seed objects:

```text
Owner organizer:
  email: owner.qa@demetra.test
  role: ORGANIZER

Teacher organizer member:
  email: teacher.qa@demetra.test
  role: ORGANIZER

Student member:
  email: student.qa@demetra.test
  role: STUDENT

Second student:
  email: student2.qa@demetra.test
  role: STUDENT

Organization:
  name: QA Music School
  kind: MUSIC_SCHOOL

Event:
  title: QA Recital
  capacity: 2
  category: Concert
  location: Sofia Music Hall
```

Rules:

- Tests should create their own data.
- Tests should clean up after themselves or run against a disposable test database.
- Tests should not depend on manually created accounts.
- E2E tests should use stable selectors where possible.

Recommended selector style:

```tsx
data-testid="create-event-button"
data-testid="event-title-input"
data-testid="save-profile-button"
```

This makes browser tests less fragile than selecting by CSS class names.

## 6. Suggested QA Script

Create:

```text
scripts/qa.ps1
```

Recommended content:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Running frontend build..."
Push-Location frontend
npm run build
Pop-Location

Write-Host "Running frontend unit tests..."
Push-Location frontend
npm test
Pop-Location

Write-Host "Running backend tests..."
Push-Location backend
npm test
Pop-Location

Write-Host "Running Playwright E2E tests..."
Push-Location frontend
npx playwright test
Pop-Location

Write-Host "QA completed successfully."
```

This script gives the presentation a single command that represents the whole automated QA pipeline.

## 7. Example Playwright Test Flow

Example file:

```text
frontend/e2e/permissions.spec.ts
```

Scenario:

```text
Student cannot edit organization settings
```

What it does:

```text
1. Seed organization with owner and student member.
2. Log in as student.
3. Open dashboard.
4. Verify Settings navigation item is not visible.
5. Verify Stage Layouts navigation item is not visible.
6. Try to call organization management API directly.
7. Expect HTTP 403.
```

Why this is important:

This protects against the exact permission class where a student belongs to an organization but should not be able to edit organization information.

## 8. Example Backend Test Flow

Example file:

```text
backend/tests/registrations.test.ts
```

Scenario:

```text
Full event sends overflow registrations to waitlist
```

What it does:

```text
1. Create organization owner.
2. Create event with capacity 1.
3. Register student A.
4. Register student B.
5. Assert student A is CONFIRMED.
6. Assert student B is WAITLISTED.
7. Assert event has only one confirmed registration.
```

Why this is important:

It proves the backend protects event capacity.

## 9. Example API Security Test Flow

Example file:

```text
backend/tests/organization.test.ts
```

Scenario:

```text
Student direct API request cannot create organization post
```

What it does:

```text
1. Create organization owner.
2. Add student member.
3. Authenticate as student.
4. POST /api/organization/posts.
5. Expect 403.
6. Assert no post was created.
7. Assert no member notifications were created.
```

Why this is important:

UI hiding is not enough. The backend must enforce permissions too.

## 10. CI Pipeline Recommendation

If the project is pushed to GitHub, add:

```text
.github/workflows/qa.yml
```

Pipeline stages:

```text
1. Install dependencies.
2. Start MySQL and Redis services.
3. Run Prisma schema push against test database.
4. Run backend tests.
5. Run frontend build.
6. Run frontend unit tests.
7. Run Playwright tests.
8. Upload Playwright report as artifact.
```

Presentation explanation:

"The same checks we run locally can run automatically on every pull request. This prevents broken builds, permission regressions, and registration bugs from being merged."

## 11. What To Say In The Presentation

Short version:

```text
Automated QA for Demetra is organized around the riskiest user flows:
authentication, organization permissions, event creation, seat registration,
waitlists, notifications, profile updates, image posts, and background worker jobs.

The frontend is tested with Playwright because it verifies real user behavior in
the browser. The backend is tested with API integration tests because most
important logic depends on database transactions, roles, and Prisma models.

The most important automated checks prove that students cannot manage organization
data, events cannot be overbooked, seats cannot be duplicated, full events move
users to the waitlist, and notifications are created through the worker/outbox
pipeline.
```

Detailed version:

```text
The QA system has three layers.

First, build checks verify that TypeScript, React, CSS, and Vite can compile the
project for production.

Second, backend integration tests verify API behavior against a real test
database. These tests check authentication, role permissions, organization
membership, event capacity, seat assignment, waitlist promotion, notifications,
and worker outbox processing.

Third, Playwright end-to-end tests open the app in a browser and perform real
organizer and student workflows. These tests check that the dashboard, profile,
events page, image posts, and permission restrictions work from the user's point
of view.
```

## 12. Minimum QA Set For A Demo

If there is not enough time to implement every test, the minimum useful automated QA set is:

```text
1. npm run build for frontend.
2. Backend auth tests.
3. Backend organization permission tests.
4. Backend registration/waitlist tests.
5. Playwright student event registration test.
6. Playwright organizer dashboard post-with-image test.
7. Playwright student cannot edit organization settings test.
```

This covers the most important product and security behavior.

## 13. Final Checklist

Before presenting:

- Put this file at `documents/automated-qa.md`.
- Add screenshots of Playwright passing if tests are implemented.
- Show `npm run build` output as the current working automated check.
- Explain that backend tests focus on rules and data integrity.
- Explain that Playwright tests focus on user workflows.
- Highlight the student permission test because it protects a real project issue.
- Highlight registration concurrency and waitlist tests because they protect the core event logic.
