# Demetra Technical Architecture

Demetra is a school music events and notification platform. The system lets organizers create organizations, invite members, publish events, design seating/stage layouts, manage registrations and waitlists, and send notifications through the app and optional email.

This document describes the current implementation in this repository, with emphasis on backend architecture, Redis, queues, workers, APIs, and the main technical decisions.

## 1. High-Level System

The project is split into these major parts:

- `frontend/`: React 19 + TypeScript + Vite client application.
- `backend/`: Node.js + Express API, Socket.IO server, Redis integration, SMTP email helper, and the worker entrypoint.
- `prisma/`: Prisma schema for MySQL.
- `nginx/`: reverse proxy for frontend, API, and Socket.IO traffic.
- `docker-compose.yml`: local multi-service runtime.
- `documents/`: project documents and presentation material.

At runtime, Docker Compose starts:

- `db`: MySQL 8.4 database.
- `redis`: Redis 7 Alpine.
- `api`: Express API and Socket.IO server on port `3000`.
- `worker`: background worker for outbox events and event reminders.
- `frontend`: Vite development server on port `5173`.
- `nginx`: gateway on port `8080`.
- `adminer`: database UI on port `8081`.

The usual browser entrypoint is `http://localhost:8080` through nginx. Nginx forwards:

- `/` to the frontend container.
- `/api/` to the API container.
- `/socket.io/` to the API container with WebSocket upgrade headers.

## 2. Backend Overview

The backend is implemented mainly in `backend/src/index.ts`.

Responsibilities:

- Start the Express HTTP API.
- Start the Socket.IO server.
- Connect Socket.IO to Redis through `@socket.io/redis-adapter`.
- Subscribe to Redis worker broadcasts.
- Validate inputs.
- Authenticate users with custom HMAC-signed JWT-style tokens.
- Hash passwords with Node `crypto.scrypt`.
- Read and write MySQL data through Prisma.
- Create outbox events for asynchronous work.
- Send some direct notifications and email mirrors.

The worker is implemented in `backend/src/worker.ts`.

Responsibilities:

- Poll `OutboxEvent` rows from MySQL.
- Claim jobs safely with SQL row locking.
- Execute notification/reminder handlers.
- Mark jobs as processed, failed, or pending for retry.
- Publish processed event broadcasts to Redis.
- Periodically enqueue upcoming event reminders.

The email helper is implemented in `backend/src/email.ts`.

Responsibilities:

- Send plain-text SMTP email without an external mail library.
- Support direct TLS or STARTTLS.
- Support optional SMTP username/password authentication.
- Fail safely through `sendNotificationEmailSafely`.

## 3. Infrastructure and Deployment Topology

`docker-compose.yml` defines the local architecture.

### MySQL

Service: `db`

- Image: `mysql:8.4`.
- Database: `demetra`.
- User: `demetra`.
- Password: `demetra_password`.
- Persistent volume: `mysqldata`.
- Healthcheck uses `mysqladmin ping`.

The API runs `npm run prisma:push` before startup, so the Prisma schema is pushed to the database automatically in the local Compose environment.

### Redis

Service: `redis`

- Image: `redis:7-alpine`.
- Used for Socket.IO horizontal scaling support.
- Used as a pub/sub transport from the worker to the API.

Redis is not used as the durable queue storage. Durable queue state lives in the MySQL `OutboxEvent` table.

### API

Service: `api`

- Dockerfile: `backend/Dockerfile`.
- Command: `npm run prisma:push && npm start`.
- Exposes `127.0.0.1:3000:3000`.
- Environment:
  - `PORT=3000`
  - `DATABASE_URL=mysql://demetra:demetra_password@db:3306/demetra`
  - `REDIS_URL=redis://redis:6379`
  - `JWT_SECRET=...`
  - `CORS_ORIGIN=...`
  - `CORS_ORIGIN_PATTERN=...`

### Worker

Service: `worker`

- Dockerfile: `backend/Dockerfile.worker`.
- Uses the same `DATABASE_URL` and `REDIS_URL`.
- Does not expose ports.
- Depends on MySQL and Redis.

The worker is separate from the API so slow notification work, retries, and reminders do not block API request/response latency.

### Frontend

Service: `frontend`

- Dockerfile: `frontend/Dockerfile`.
- Runs Vite dev server with `npm run dev -- --host 0.0.0.0 --port 5173`.
- Exposes `127.0.0.1:5173:5173`.
- In Compose, `VITE_API_URL=/api` and `VITE_SOCKET_URL=/socket.io`, so browser traffic goes through nginx.

### Nginx

Service: `nginx`

- Image: `nginx:alpine`.
- Exposes `8080:80`.
- Proxies frontend, API, and Socket.IO.
- Sets WebSocket upgrade headers for Socket.IO.

## 4. Data Model

The Prisma schema is in `prisma/schema.prisma`. The database provider is MySQL.

### Enums

`Role`

- `STUDENT`
- `ORGANIZER`

`EventStatus`

- `DRAFT`
- `PUBLISHED`
- `CANCELLED`
- `CLOSED`

`RegistrationStatus`

- `CONFIRMED`
- `WAITLISTED`
- `CANCELLED`

`OutboxEventStatus`

- `PENDING`
- `PROCESSING`
- `PROCESSED`
- `FAILED`

`NotificationStatus`

- `UNREAD`
- `READ`

`OrganizationKind`

- `MUSIC_SCHOOL`
- `CONSERVATORY`
- `UNIVERSITY_DEPARTMENT`
- `CHOIR`
- `STUDENT_CLUB`
- `OTHER`

### Core Tables

`User`

- Stores account identity, email, password hash, name, and role.
- Has optional profile.
- Can own one organization.
- Can belong to organizations through memberships.
- Can organize events.
- Has registrations and notifications.

Important constraints:

- `email` is unique.
- `organization` relation uses `ownerId` on `Organization`.

`UserProfile`

- Stores optional profile data: avatar, location, bio, headline, primary focus, phone, website.
- `userId` is unique.
- Deleted automatically when the user is deleted.

`Organization`

- Represents a school, conservatory, choir, club, or other group.
- Has one owner.
- Has events, stage layouts, posts, members, and invitations.

Important constraints:

- `ownerId` is unique, so one user can own only one organization.

`OrganizationMembership`

- Join table between users and organizations.
- Stores the member role inside the organization.
- Unique pair: `(organizationId, userId)`.

Note: a user's global role and membership role are related but not identical. The API only allows teacher/organizer accounts to be promoted to organizer membership role.

`OrganizationInvitation`

- Stores invitation token, optional target email, invited role, organization, creator, acceptance details, and expiration.
- `token` is unique.
- Invitations expire after 14 days in the API logic.

`OrganizationPost`

- Organization news/announcement posts.
- Creating a post creates notifications for organization members.

`StageLayout`

- Stores reusable venue layouts.
- Fields include rows, columns, JSON seat list, and stage shape.
- Belongs to an organization and creator.

`Event`

- Stores event title, description, date, location, category, capacity, price, VIP price, optional seating map, status, organizer, and organization.
- `reminderSentAt` tracks whether the reminder worker already scheduled reminders for that event.

Important indexes:

- `(status, startsAt)` for event listing.
- `(reminderSentAt, startsAt)` for reminder polling.
- `organizerId`.
- `organizationId`.

`Registration`

- Stores a user's registration for an event.
- Status can be confirmed, waitlisted, or cancelled.
- Stores assigned seat label and seat type.

Important constraints:

- Unique pair: `(userId, eventId)`, so a user has at most one registration row per event.
- Cancelled registrations can be reused/reactivated by the registration endpoint.

`Notification`

- Stores in-app notifications.
- Has type, title, message, status, metadata JSON, creation time, and read time.

`OutboxEvent`

- Durable queue table.
- Stores event type, aggregate type/id, JSON payload, status, attempts, error reason, created time, and processed time.
- This is the source of truth for asynchronous jobs.

## 5. Authentication and Security

Authentication is handled directly in `backend/src/index.ts`.

### Passwords

Passwords are hashed with Node `crypto.scrypt`.

Stored format:

```text
scrypt$<salt>$<derived-key>
```

Password requirements during registration:

- 8 to 128 characters.
- At least one lowercase letter.
- At least one uppercase letter.

### Tokens

The API creates a custom JWT-style token:

- Header: `{ alg: "HS256", typ: "JWT" }`
- Payload:
  - `sub`: user id
  - `email`
  - `role`
  - `exp`
- Signature: HMAC SHA-256 using `JWT_SECRET`.

Token TTL is 12 hours.

`JWT_SECRET` is required and must be at least 32 characters. The API process exits if the secret is missing or too short.

### Auth Middleware

`requireAuth`:

- Reads `Authorization: Bearer <token>`.
- Verifies signature and expiration.
- Attaches the decoded user to `req.user`.

`requireRole(role)`:

- Checks the authenticated user's global role.
- Used mainly to restrict organizer-only routes.

### Rate Limiting and Login Lock

The API uses in-memory maps:

- `authAttempts`: limits auth attempts by IP and email.
- `loginFailures`: tracks wrong password attempts by email.

Limits:

- Maximum auth attempts: 20 per 15 minutes.
- Wrong login warning starts at 3 failed attempts.
- Login locks after 5 failed attempts.
- Lock duration: 2 minutes.

Because this is in-memory, the counters reset when the API process restarts and are not shared between API replicas.

### HTTP Hardening

The API disables `x-powered-by` and sets:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cache-Control: no-store` for `/api` responses.

### CORS

Allowed origins come from:

- `CORS_ORIGIN`
- `CORS_ORIGIN_PATTERN`

The default allows local Vite and nginx origins, plus ngrok patterns.

## 6. Redis and Realtime Architecture

Redis has two roles.

### Socket.IO Redis Adapter

The API creates two Redis clients:

- `pubClient`
- `subClient`

After both connect, Socket.IO uses:

```ts
io.adapter(createAdapter(pubClient, subClient))
```

This enables Socket.IO events to work across multiple API instances if the API is horizontally scaled. In the current Compose setup there is one API instance, but the adapter makes the architecture ready for more.

### Worker-to-API Pub/Sub

The worker publishes processed outbox events to a Redis channel:

```text
worker-broadcast
```

Payload shape:

```json
{
  "type": "EventPublished",
  "payload": { "...": "..." }
}
```

The API subscribes to `worker-broadcast`, parses each message, and emits the event through Socket.IO:

```ts
io.emit(type, payload)
```

This means:

- The worker does not need direct access to Socket.IO.
- The API remains the WebSocket server.
- Redis decouples background work from realtime browser delivery.

Current Socket.IO behavior is broad broadcast: events are emitted to all connected clients, not to per-user or per-organization rooms.

## 7. Queue and Outbox Architecture

The durable queue is implemented with the `OutboxEvent` MySQL table.

The API writes outbox rows inside the same database transaction as the business change. This is the transactional outbox pattern.

Example: when a user registers for an event:

1. API starts a database transaction.
2. API locks the event row.
3. API creates or updates the `Registration`.
4. API creates an `OutboxEvent` such as `RegistrationConfirmed`.
5. Transaction commits.
6. Worker later processes the outbox row.

This matters because the business data and the async job are committed together. The system avoids the common bug where the registration succeeds but the notification job is lost, or the job is created for a registration that later rolls back.

### Outbox Status Lifecycle

`PENDING`

- Created by API or reminder scheduler.
- Ready for worker pickup.

`PROCESSING`

- Claimed by worker.
- Attempts incremented.

`PROCESSED`

- Handler completed successfully.
- Worker also published a Redis broadcast.

`FAILED`

- Handler failed too many times.
- Controlled by `OUTBOX_MAX_ATTEMPTS`, default `5`.

If a handler fails but attempts are still below the max, the job goes back to `PENDING`.

### Worker Claiming

The worker claims jobs with:

```sql
SELECT ...
FROM `OutboxEvent`
WHERE status = 'PENDING' AND attempts < MAX_ATTEMPTS
ORDER BY createdAt ASC
LIMIT BATCH_SIZE
FOR UPDATE SKIP LOCKED
```

This is important for concurrency:

- `FOR UPDATE` locks selected rows inside the transaction.
- `SKIP LOCKED` lets multiple workers run without processing the same row.
- Oldest jobs are processed first.

Default worker settings:

- `OUTBOX_MAX_ATTEMPTS`: `5`
- `OUTBOX_POLL_INTERVAL_MS`: `2000`
- `OUTBOX_BATCH_SIZE`: `50`

## 8. Worker Responsibilities

### What a Worker Is

A worker is a separate background process that does jobs the main API should not do during a user's request.

In this project, the API is responsible for fast user-facing actions. For example, when a student registers for an event, the API checks capacity, saves the registration, and immediately returns a response to the frontend. It does not wait to send all notifications and emails before answering the user.

Instead, the API writes a job into the `OutboxEvent` table. The worker keeps checking that table for new jobs. When it finds one, it performs the slower background work, such as:

- creating notification records,
- sending optional email messages,
- notifying students when an event is published,
- notifying users when registrations change,
- scheduling and sending event reminders,
- publishing realtime updates through Redis.

So the worker is like a second backend process dedicated to asynchronous work. It has no public HTTP routes and users do not call it directly. It runs in the background, talks to the same MySQL database, and uses Redis to tell the API when something should be broadcast through Socket.IO.

The main reason for using a worker is reliability and speed. The API can finish the user's action quickly, while the worker can retry notification jobs if something temporary fails, such as an email problem.

In Docker Compose, this is the `worker` service. It starts from `backend/src/worker.ts`.

The worker handles these outbox event types:

- `RegistrationConfirmed`
- `RegistrationWaitlisted`
- `WaitlistPromoted`
- `RegistrationCancelled`
- `EventPublished`
- `EventUpdated`
- `EventCancelled`
- `EventReminderDue`

### RegistrationConfirmed

Looks up the registration, event, and user context, then creates:

- In-app notification.
- Optional email.

Message tells the user their place is confirmed.

### RegistrationWaitlisted

Calculates waitlist position by counting waitlisted registrations created at or before the current registration. Then creates notification/email with position.

### WaitlistPromoted

Notifies a waitlisted user that they have been promoted to confirmed.

### RegistrationCancelled

Notifies the user that their registration was cancelled. Metadata includes previous status.

### EventPublished

Finds student members of the event organization and notifies them that a new event is open for registration.

### EventUpdated

Finds confirmed and waitlisted registrations for the event and notifies those users that event details changed.

### EventCancelled

Notifies users affected by cancellation. The API usually passes active user IDs in the payload; if not, the worker falls back to event registrations.

### EventReminderDue

Finds confirmed registrations and sends reminder notifications. The default reminder lead time is 24 hours.

## 9. Event Reminder Scheduling

The worker runs a separate interval for reminders.

Defaults:

- `EVENT_REMINDER_POLL_INTERVAL_MS`: `60000`
- `EVENT_REMINDER_LEAD_MS`: `24 * 60 * 60 * 1000`

Every reminder poll:

1. Find up to 100 published events where:
   - `startsAt` is in the future.
   - `startsAt` is within the reminder lead window.
   - `reminderSentAt` is `null`.
2. For each event, update `reminderSentAt` inside a transaction.
3. If the update claimed the event, create an `EventReminderDue` outbox event.

This prevents duplicate reminder scheduling. If an event date changes, the event update endpoint resets `reminderSentAt` to `null` when the start time changed.

## 10. Notification Architecture

There are three notification paths:

### API Direct Notification

Some operations create notifications immediately in the API request:

- Joining an organization through invitation.
- Creating organization posts.
- Removing organization members.
- Inviting an existing user.

These actions do not go through the outbox worker in the current implementation.

### Outbox Worker Notification

Event and registration lifecycle notifications are asynchronous:

- Registration confirmed/waitlisted/cancelled.
- Waitlist promotion.
- Event published/updated/cancelled.
- Event reminders.

These are persisted as outbox rows and handled by the worker.

### Email Mirror

Email is optional. If SMTP is configured, each notification can be mirrored to email.

Relevant environment variables:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`
- `SMTP_STARTTLS`

If SMTP is not configured, email sending is skipped. If email fails, errors are logged but the app continues.

## 11. API Surface

All API routes are served from `backend/src/index.ts`.

### Health

`GET /api/health`

- Runs `SELECT 1` against the database.
- Returns `{ ok: true }` if database access works.

### Authentication

`POST /api/auth/register`

- Creates a user.
- Supports optional invitation token.
- Hashes password.
- If registering through an invitation, creates organization membership, marks invitation accepted, and creates a joined notification.
- Returns auth token and public user.

`POST /api/auth/login`

- Verifies email/password.
- Applies wrong-password warning and lockout behavior.
- Returns auth token and public user.

`GET /api/auth/me`

- Requires auth.
- Returns current public user with organization context.

### Profile

`GET /api/profile`

- Requires auth.
- Returns public profile data.

`PUT /api/profile`

- Requires auth.
- Updates profile fields and optionally display name.
- Avatar must be a data image under 1 MB.

### Organization

`GET /api/organization`

- Requires auth.
- Returns current organization, members, and active invitations.
- Only managers see pending invitations.

`POST /api/organization`

- Requires organizer role.
- Creates an organization owned by the current user.
- A user can only belong to or own one organization in this flow.

`PATCH /api/organization/members/:userId`

- Requires organizer role and organization management access.
- Updates a member's organization role.
- Cannot modify the owner.
- Only global organizer accounts can become organizer members.

`DELETE /api/organization/members/:userId`

- Requires organizer role and organization management access.
- Removes a member.
- Cannot remove owner or self.
- Creates notification/email for removed user.

### Organization Invitations

`POST /api/organization/invitations`

- Requires organizer role and organization management access.
- Creates a 14-day invitation token.
- Optional email restriction.
- If the invited email already belongs to a user, creates an in-app notification and optional email.

`GET /api/invitations/:token`

- Public route.
- Returns invitation details if token is valid, unaccepted, and not expired.

`POST /api/invitations/:token/accept`

- Requires auth.
- Validates invitation.
- Checks email restriction.
- Updates user's global role to organizer if the invitation role is organizer.
- Upserts organization membership.
- Marks invitation accepted.
- Creates joined notification/email.

### Organization Posts

`GET /api/organization/posts`

- Requires auth.
- Lists posts for the user's organization.

`GET /api/organization/posts/:id`

- Requires auth.
- Returns a single organization post.

`POST /api/organization/posts`

- Requires organizer role and organization management access.
- Creates a post.
- Creates notifications for owner and members.
- Sends optional email mirror.

### Notifications

`GET /api/notifications`

- Requires auth.
- Returns latest 50 notifications and unread count.

`PATCH /api/notifications/:id/read`

- Requires auth.
- Marks one notification as read.

`POST /api/notifications/read-all`

- Requires auth.
- Marks all current user's unread notifications as read.

### Stage Layouts

`GET /api/stage-layouts`

- Requires auth.
- Lists layouts for the user's organization.

`POST /api/stage-layouts`

- Requires organizer role and organization management access.
- Creates a stage layout.

`PUT /api/stage-layouts/:id`

- Requires organizer role and organization management access.
- Updates a layout in the same organization.

`DELETE /api/stage-layouts/:id`

- Requires organizer role and organization management access.
- Deletes a layout in the same organization.

Stage layouts validate:

- Name length.
- Venue length.
- Row/column bounds.
- Seat array size.
- Seat ids, row/column indexes, and status values.
- Stage shape: `rect`, `arc`, or `thrust`.

### Events

`GET /api/events`

- Public route.
- Lists published events.
- Includes organizer, organization, confirmed registration count, and active occupied seats.

`GET /api/events/my`

- Requires organizer role.
- Lists events for the organizer's organization, or organizer id if no organization is found.

`POST /api/events`

- Requires organizer role and organization management access.
- Creates a published event.
- Creates `EventPublished` outbox event.

`PATCH /api/events/:id`

- Requires organizer role and organization management access.
- Updates an open event.
- Cannot reduce capacity below confirmed registration count.
- Resets `reminderSentAt` if start time changed.
- Creates `EventUpdated` outbox event.

`PATCH /api/events/:id/cancel`

- Requires organizer role and organization management access.
- Cancels an open event.
- Cancels active registrations.
- Creates `EventCancelled` outbox event with affected user IDs.

### Registrations

`POST /api/register`

- Requires auth.
- Registers current user for an event.
- Uses a transaction and locks the event row with `FOR UPDATE`.
- If capacity remains, creates a confirmed registration.
- If full, creates a waitlisted registration.
- Assigns requested seat if valid and available.
- If no requested seat, auto-assigns first available seat from seating map.
- If no seating map, uses fallback labels like `A1`, `A2`, etc.
- Creates `RegistrationConfirmed` or `RegistrationWaitlisted` outbox event.

`GET /api/registrations/my`

- Requires auth.
- Lists current user's registrations.
- Includes event details and waitlist position.

`GET /api/events/:id/registrations`

- Requires organizer role and organization management access.
- Lists confirmed and waitlisted registrations for a managed event.

`DELETE /api/events/:id/registration`

- Requires auth.
- Cancels current user's registration.
- Locks event row with `FOR UPDATE`.
- Creates `RegistrationCancelled` outbox event.
- If the cancelled registration was confirmed, promotes the oldest waitlisted registration and creates `WaitlistPromoted` outbox event.

## 12. Event Registration Concurrency

The registration endpoint is one of the most important technical parts.

Problem:

- Multiple users can register for the same event at the same time.
- The system must not oversell capacity.
- The system must not assign the same seat twice.

Solution:

- The endpoint starts a Prisma transaction.
- It locks the event row using SQL `FOR UPDATE`.
- While the row is locked, it counts confirmed registrations.
- It decides confirmed vs waitlisted.
- It checks occupied seats.
- It creates or updates the registration.
- It creates an outbox event inside the same transaction.

Because all competing registration requests lock the same event row, they are serialized per event. That protects capacity and seat assignment.

The cancellation endpoint uses the same row-locking approach before cancellation and waitlist promotion.

## 13. Seating Model

Events can store a `seatingMap` JSON object:

```json
{
  "rows": 10,
  "cols": 12,
  "stageShape": "rect",
  "seats": [
    { "id": "seat-0-0", "row": 0, "col": 0, "status": "available" }
  ]
}
```

Seat statuses:

- `available`
- `taken`
- `selected`
- `vip`
- `blocked`

Backend behavior:

- Seat labels are generated from row/column, for example row `0`, col `0` becomes `A1`.
- Requested seat labels are normalized to uppercase and stripped of whitespace.
- Blocked seats cannot be selected.
- VIP seats get seat type `VIP`; other seats get `STANDARD`.
- Active occupied seats are returned in event list responses so the frontend can show taken seats.

## 14. Frontend API Integration

The frontend API client is in `frontend/src/shared/api/api.ts`.

It defines TypeScript types for:

- Auth users.
- Profiles.
- Events.
- Registrations.
- Stage layouts.
- Organization members.
- Invitations.
- Notifications.
- Organization posts.

`API_BASE_URL` comes from:

```ts
import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
```

In Docker Compose, this is `/api`, so nginx handles proxying.

Authentication is stored in local storage:

- Token key: `demetra.authToken`
- User key: `demetra.authUser`

The client sends the bearer token for protected endpoints.

Frontend structure follows the documented architecture in `frontend/src/ARCHITECTURE.md`:

- `app/`: composition and app shell.
- `features/`: auth, dashboard, events, instruments, profile.
- `widgets/`: reusable composed UI such as navbar.
- `shared/`: API client and UI utilities.

Import direction should stay:

```text
app -> features/widgets -> shared
```

## 15. Important Environment Variables

Backend/API:

- `PORT`: API port, default `3000`.
- `DATABASE_URL`: MySQL connection string.
- `REDIS_URL`: Redis connection string, default `redis://localhost:6379`.
- `JWT_SECRET`: required, at least 32 characters.
- `CORS_ORIGIN`: comma-separated exact origins.
- `CORS_ORIGIN_PATTERN`: comma-separated regex patterns.

Worker:

- `DATABASE_URL`
- `REDIS_URL`
- `OUTBOX_MAX_ATTEMPTS`: default `5`.
- `OUTBOX_POLL_INTERVAL_MS`: default `2000`.
- `OUTBOX_BATCH_SIZE`: default `50`.
- `EVENT_REMINDER_POLL_INTERVAL_MS`: default `60000`.
- `EVENT_REMINDER_LEAD_MS`: default `86400000`.

Email:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_SECURE`
- `SMTP_STARTTLS`

Frontend:

- `VITE_API_URL`
- `VITE_SOCKET_URL`

## 16. Architecture Strengths

Transactional outbox:

- The system commits business changes and async jobs together.
- This improves reliability for notifications and realtime broadcasts.

Database locking for registration:

- Event capacity and seat assignment are protected under concurrent traffic.

Separate worker:

- Email and notification side effects do not slow down API responses.
- Worker can be scaled separately.

Redis decoupling:

- The worker can trigger realtime updates without owning Socket.IO connections.
- Socket.IO Redis adapter supports future multi-API deployments.

Prisma schema:

- The domain model is explicit and strongly represented in code.

Nginx gateway:

- Browser only needs one origin in the Compose setup.
- WebSocket and API traffic are routed cleanly.

## 17. Current Limitations and Talking Points

In-memory auth rate limiting:

- Rate limit and login lock maps live inside one API process.
- In a multi-replica production deployment, this should move to Redis or another shared store.

Custom token implementation:

- The project manually creates and verifies JWT-style HMAC tokens.
- For production, a mature JWT library could reduce maintenance risk.

Broad Socket.IO broadcasts:

- Worker events are emitted to all connected clients.
- A more private/scalable design would use rooms per user, organization, or event.

Mixed notification paths:

- Some notifications are direct in the API.
- Event/registration notifications use the outbox.
- For consistency, all notification side effects could eventually go through the outbox.

Schema bootstrap code:

- Some backend code includes manual table/column creation helpers.
- Production systems usually prefer formal migrations instead of runtime schema patching.

No dedicated queue product:

- The queue is MySQL-backed through `OutboxEvent`, not Redis lists or BullMQ.
- This is valid for reliability and simplicity, but high-throughput systems might use a dedicated queue after the outbox.

Email implementation:

- SMTP is implemented manually with sockets.
- This avoids extra dependencies, but a production mail provider SDK or well-tested SMTP library would be easier to maintain.

## 18. Technical Questions You May Be Asked

### Why use an outbox table instead of directly sending notifications in the API?

Because notifications and emails are side effects. If the API sends email directly during the request, the request becomes slower and more fragile. With the outbox pattern, the database change and the async job are committed in one transaction. The worker can retry failures without losing the original business event.

### Is Redis the queue?

No. Redis is used for Socket.IO scaling and pub/sub broadcasts from the worker to the API. The durable queue is the MySQL `OutboxEvent` table.

### How do you prevent overbooking an event?

Registration runs inside a transaction and locks the event row with `FOR UPDATE`. Competing registrations for the same event must wait for each other, so the confirmed count and seat assignment are calculated serially.

### What happens when an event is full?

The registration is created with status `WAITLISTED`. The worker sends a waitlist notification and includes the user's waitlist position.

### What happens when someone cancels a confirmed registration?

The cancellation endpoint locks the event row, marks the user's registration cancelled, finds the oldest waitlisted registration, promotes it to confirmed, assigns a seat, and creates a `WaitlistPromoted` outbox event.

### How are realtime updates sent?

The worker processes an outbox job and publishes a message to Redis channel `worker-broadcast`. The API subscribes to that channel and emits the event through Socket.IO.

### Can the worker run multiple instances?

The code is designed for that. Jobs are claimed with `FOR UPDATE SKIP LOCKED`, so multiple workers can skip rows already locked by another worker. Each job should be processed by only one worker at a time.

### How are event reminders scheduled?

The worker periodically finds published events starting within the reminder window and with `reminderSentAt = null`. It sets `reminderSentAt` and creates an `EventReminderDue` outbox job. That job notifies confirmed registrants.

### What is the role of nginx?

Nginx is the local gateway. It serves one external origin on port `8080` and routes frontend, API, and WebSocket traffic to the correct containers.

### How does authorization work for organization data?

The backend resolves the user's organization either through ownership or membership. Management actions require both global organizer role and organization management access. Owners and organizer memberships can manage organization-scoped resources.

### How is email handled if SMTP is not configured?

Email sending is skipped. In-app notifications still work. If SMTP is configured but sending fails, errors are logged and the app continues.

## 19. Source Map

Key files:

- `backend/src/index.ts`: Express API, Socket.IO setup, auth, routes, transactional event/registration logic.
- `backend/src/worker.ts`: outbox worker, notification handlers, reminder scheduler, Redis pub/sub publishing.
- `backend/src/email.ts`: SMTP email sender.
- `prisma/schema.prisma`: MySQL data model.
- `docker-compose.yml`: local service topology.
- `nginx/nginx.conf`: reverse proxy and WebSocket routing.
- `frontend/src/shared/api/api.ts`: frontend API client and shared API types.
- `frontend/src/ARCHITECTURE.md`: frontend layering rules.
