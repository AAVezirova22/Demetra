import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { sendNotificationEmailSafely } from './email';

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: REDIS_URL });
const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 5);
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 2000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);
const REMINDER_POLL_INTERVAL_MS = Number(process.env.EVENT_REMINDER_POLL_INTERVAL_MS || 60_000);
const REMINDER_LEAD_MS = Number(process.env.EVENT_REMINDER_LEAD_MS || 24 * 60 * 60 * 1000);

type OutboxJob = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  attempts: number;
};

async function claimPendingJobs() {
  return prisma.$transaction(async (tx: any) => {
    const jobs = await tx.$queryRaw<OutboxJob[]>`
      SELECT id, aggregateType, aggregateId, eventType, payload, attempts
      FROM \`OutboxEvent\`
      WHERE status = 'PENDING' AND attempts < ${MAX_ATTEMPTS}
      ORDER BY createdAt ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;

    const claimedJobs = (jobs as OutboxJob[]).map((job) => ({
      ...job,
      payload: typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload,
    }));
    const ids = claimedJobs.map((job: OutboxJob) => job.id);
    if (ids.length > 0) {
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids }, status: 'PENDING' },
        data: { status: 'PROCESSING', attempts: { increment: 1 }, errorReason: null },
      });
    }

    return claimedJobs;
  });
}

async function notifyUser(userId: string, type: string, title: string, message: string, metadata: Record<string, unknown>) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      metadata: metadata as any,
    },
  });

  await sendNotificationEmailSafely(user?.email, title, message);
}

async function ensureReminderColumn() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE `Event` ADD COLUMN `reminderSentAt` DATETIME(3) NULL');
  } catch (error: any) {
    if (!String(error?.message ?? '').includes('Duplicate column')) {
      throw error;
    }
  }

  try {
    await prisma.$executeRawUnsafe('CREATE INDEX `Event_reminderSentAt_startsAt_idx` ON `Event`(`reminderSentAt`, `startsAt`)');
  } catch (error: any) {
    if (!String(error?.message ?? '').includes('Duplicate key name')) {
      throw error;
    }
  }
}

async function getRegistrationContext(registrationId: string) {
  return prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      event: { select: { id: true, title: true, startsAt: true, location: true, organizationId: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

async function handleRegistrationConfirmed(payload: any) {
  const registration = await getRegistrationContext(payload.registrationId);
  if (!registration) return;

  await notifyUser(
    registration.userId,
    'RegistrationConfirmed',
    `Registration confirmed: ${registration.event.title}`,
    `Your place for ${registration.event.title} is confirmed.`,
    { eventId: registration.eventId, registrationId: registration.id },
  );
}

async function handleRegistrationWaitlisted(payload: any) {
  const registration = await getRegistrationContext(payload.registrationId);
  if (!registration) return;

  const position = await prisma.registration.count({
    where: {
      eventId: registration.eventId,
      status: 'WAITLISTED',
      createdAt: { lte: registration.createdAt },
    },
  });

  await notifyUser(
    registration.userId,
    'RegistrationWaitlisted',
    `Added to waitlist: ${registration.event.title}`,
    `The event is full. You are waitlist position ${position} for ${registration.event.title}.`,
    { eventId: registration.eventId, registrationId: registration.id, position },
  );
}

async function handleWaitlistPromoted(payload: any) {
  const registration = await getRegistrationContext(payload.registrationId);
  if (!registration) return;

  await notifyUser(
    registration.userId,
    'WaitlistPromoted',
    `You're in: ${registration.event.title}`,
    `A place opened up and your waitlist registration for ${registration.event.title} is now confirmed.`,
    { eventId: registration.eventId, registrationId: registration.id },
  );
}

async function handleRegistrationCancelled(payload: any) {
  const registration = await getRegistrationContext(payload.registrationId);
  if (!registration) return;

  await notifyUser(
    registration.userId,
    'RegistrationCancelled',
    `Registration cancelled: ${registration.event.title}`,
    `Your registration for ${registration.event.title} has been cancelled.`,
    { eventId: registration.eventId, registrationId: registration.id, previousStatus: payload.previousStatus },
  );
}

async function getOrganizationStudentIds(organizationId: string | null) {
  if (!organizationId) return [];

  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId, role: 'STUDENT' },
    select: { userId: true },
  });

  return memberships.map((membership: { userId: string }) => membership.userId);
}

async function handleEventPublished(payload: any) {
  const event = await prisma.event.findUnique({
    where: { id: payload.eventId },
    select: { id: true, title: true, organizationId: true },
  });
  if (!event) return;

  const userIds = await getOrganizationStudentIds(event.organizationId);
  await Promise.all(userIds.map((userId: string) => notifyUser(
    userId,
    'EventPublished',
    `New event: ${event.title}`,
    `${event.title} has been published and is open for registration.`,
    { eventId: event.id },
  )));
}

async function handleEventCancelled(payload: any) {
  const event = await prisma.event.findUnique({
    where: { id: payload.eventId },
    select: { id: true, title: true, organizationId: true },
  });
  if (!event) return;

  const payloadUserIds = Array.isArray(payload.userIds)
    ? payload.userIds.filter((userId: unknown): userId is string => typeof userId === 'string')
    : [];
  const registrations = payloadUserIds.length > 0
    ? []
    : await prisma.registration.findMany({
        where: { eventId: event.id },
        select: { userId: true },
      });
  const uniqueUserIds = Array.from(new Set<string>(
    payloadUserIds.length > 0
      ? payloadUserIds
      : registrations.map((registration: { userId: string }) => registration.userId),
  ));

  await Promise.all(uniqueUserIds.map((userId: string) => notifyUser(
    userId,
    'EventCancelled',
    `Event cancelled: ${event.title}`,
    `${event.title} has been cancelled by the organizer.`,
    { eventId: event.id },
  )));
}

async function handleEventUpdated(payload: any) {
  const event = await prisma.event.findUnique({
    where: { id: payload.eventId },
    select: { id: true, title: true },
  });
  if (!event) return;

  const registrations = await prisma.registration.findMany({
    where: { eventId: event.id, status: { in: ['CONFIRMED', 'WAITLISTED'] } },
    select: { userId: true },
  });
  const uniqueUserIds = Array.from(new Set<string>(registrations.map((registration: { userId: string }) => registration.userId)));

  await Promise.all(uniqueUserIds.map((userId: string) => notifyUser(
    userId,
    'EventUpdated',
    `Event updated: ${event.title}`,
    `${event.title} has updated details. Check the event page for the latest information.`,
    { eventId: event.id },
  )));
}

async function enqueueUpcomingEventReminders() {
  const now = new Date();
  const reminderWindowEnd = new Date(now.getTime() + REMINDER_LEAD_MS);

  const events = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      startsAt: {
        gt: now,
        lte: reminderWindowEnd,
      },
      reminderSentAt: null,
    },
    select: { id: true, startsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 100,
  });

  for (const event of events) {
    await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.event.updateMany({
        where: { id: event.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });

      if (claimed.count === 0) return;

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Event',
          aggregateId: event.id,
          eventType: 'EventReminderDue',
          payload: { eventId: event.id, startsAt: event.startsAt },
        },
      });
    });
  }
}

async function handleEventReminderDue(payload: any) {
  const event = await prisma.event.findUnique({
    where: { id: payload.eventId },
    select: { id: true, title: true, startsAt: true, location: true, status: true },
  });
  if (!event || event.status !== 'PUBLISHED') return;

  const registrations = await prisma.registration.findMany({
    where: { eventId: event.id, status: 'CONFIRMED' },
    select: { userId: true },
  });

  const startsAt = event.startsAt
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(event.startsAt)
    : 'soon';

  await Promise.all(registrations.map((registration: { userId: string }) => notifyUser(
    registration.userId,
    'EventReminder',
    `Reminder: ${event.title} starts soon`,
    `${event.title} starts on ${startsAt}${event.location ? ` at ${event.location}` : ''}.`,
    { eventId: event.id, startsAt: event.startsAt?.toISOString() ?? null },
  )));
}

async function processJob(job: OutboxJob) {
  switch (job.eventType) {
    case 'RegistrationConfirmed':
      await handleRegistrationConfirmed(job.payload);
      break;
    case 'RegistrationWaitlisted':
      await handleRegistrationWaitlisted(job.payload);
      break;
    case 'WaitlistPromoted':
      await handleWaitlistPromoted(job.payload);
      break;
    case 'RegistrationCancelled':
      await handleRegistrationCancelled(job.payload);
      break;
    case 'EventPublished':
      await handleEventPublished(job.payload);
      break;
    case 'EventUpdated':
      await handleEventUpdated(job.payload);
      break;
    case 'EventCancelled':
      await handleEventCancelled(job.payload);
      break;
    case 'EventReminderDue':
      await handleEventReminderDue(job.payload);
      break;
    default:
      console.warn(`No handler registered for outbox event ${job.eventType}`);
  }
}

async function publishBroadcast(job: OutboxJob) {
  await pubClient.publish('worker-broadcast', JSON.stringify({
    type: job.eventType,
    payload: job.payload,
  }));
}

async function processPendingJobs() {
  const jobs = await claimPendingJobs();

  for (const job of jobs) {
    try {
      await processJob(job);
      await prisma.outboxEvent.update({
        where: { id: job.id },
        data: { status: 'PROCESSED', processedAt: new Date(), errorReason: null },
      });
      await publishBroadcast(job);
    } catch (err: any) {
      const nextAttempts = job.attempts + 1;
      const terminal = nextAttempts >= MAX_ATTEMPTS;
      console.error(`Failed to process outbox event ${job.id}:`, err);

      await prisma.outboxEvent.update({
        where: { id: job.id },
        data: {
          status: terminal ? 'FAILED' : 'PENDING',
          errorReason: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}

async function startWorker() {
  await pubClient.connect();
  await ensureReminderColumn();
  console.log('Worker started. Polling outbox...');

  setInterval(() => {
    processPendingJobs().catch((err) => {
      console.error('Error processing outbox:', err);
    });
  }, POLL_INTERVAL_MS);

  setInterval(() => {
    enqueueUpcomingEventReminders().catch((err) => {
      console.error('Error scheduling event reminders:', err);
    });
  }, REMINDER_POLL_INTERVAL_MS);

  enqueueUpcomingEventReminders().catch((err) => {
    console.error('Error scheduling event reminders:', err);
  });
}

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
