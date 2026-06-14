import { PrismaClient, OutboxEventStatus } from '@prisma/client';
import { createClient } from 'redis';

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: REDIS_URL });

async function startWorker() {
  await pubClient.connect();
  console.log('Worker started. Polling outbox...');

  // Simple polling loop
  setInterval(async () => {
    try {
      // 1. Fetch pending outbox events (limit to prevent memory bloat)
      const events = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        take: 50,
        orderBy: { createdAt: 'asc' }
      });

      for (const event of events) {
        try {
          // 2. Process the event based on its type
          if (event.eventType === 'RegistrationConfirmed') {
            await handleRegistrationConfirmed(event.payload);
          } else if (event.eventType === 'RegistrationWaitlisted') {
            // Handle waitlist specific logic if any
          }

          // 3. Mark as processed
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PROCESSED', processedAt: new Date() }
          });

          // 4. Broadcast event via Redis so the API can push via WebSockets
          pubClient.publish('worker-broadcast', JSON.stringify({
            type: event.eventType,
            payload: event.payload
          }));

        } catch (err: any) {
          console.error(`Failed to process event ${event.id}:`, err);
          // Mark as failed to prevent infinite retries
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED', errorReason: err.message }
          });
        }
      }
    } catch (err) {
      console.error('Error querying outbox:', err);
    }
  }, 2000); // Poll every 2 seconds
}

async function handleRegistrationConfirmed(payload: any) {
  // Simulate slow task (e.g., sending email)
  console.log(`Sending confirmation email to user ${payload.userId} for event ${payload.eventId}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
}

startWorker().catch(console.error);