import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: { origin: '*' }
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('API Socket.io Redis adapter connected');

  // Listen to the custom pub-sub channel from the worker
  const broadcastSub = pubClient.duplicate();
  broadcastSub.connect().then(() => {
    broadcastSub.subscribe('worker-broadcast', (message) => {
      try {
        const { type, payload } = JSON.parse(message);
        // Emit locally, and adapter automatically manages syncing
        io.emit(type, payload);
      } catch (err) {
        console.error("Failed to parse broadcast", err);
      }
    });
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

// Event Registration Endpoint (Concurrency Safe)
app.post('/api/register', async (req, res) => {
  const { userId, eventId } = req.body;

  if (!userId || !eventId) {
    return res.status(400).json({ error: 'userId and eventId are required' });
  }

  try {
    // 1. Transaction to guarantee concurrency constraints
    const registration = await prisma.$transaction(async (tx) => {
      
      // Strict Row-level Locking: Lock the Event row against other concurrent threads
      // This ensures we always read the *absolute latest* count before proceeding.
      const lockQuery = await tx.$queryRaw<{ id: string, capacity: number }[]>`
        SELECT id, capacity FROM "Event" 
        WHERE id = ${eventId} 
        FOR UPDATE
      `;

      if (lockQuery.length === 0) {
        throw new Error('Event not found');
      }

      const event = lockQuery[0];

      // Read current confirmed counts
      const confirmedCount = await tx.registration.count({
        where: { eventId, status: 'CONFIRMED' }
      });

      // Implement our capacity logic
      const newStatus = confirmedCount < event.capacity ? 'CONFIRMED' : 'WAITLISTED';

      // Create the registration
      const newRegistration = await tx.registration.create({
        data: {
          userId,
          eventId,
          status: newStatus
        }
      });

      // Write domain event to Outbox atomic queue
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Registration',
          aggregateId: newRegistration.id,
          eventType: newStatus === 'CONFIRMED' ? 'RegistrationConfirmed' : 'RegistrationWaitlisted',
          payload: { 
            registrationId: newRegistration.id, 
            status: newStatus, 
            userId, 
            eventId 
          }
        }
      });

      return newRegistration;
    });

    res.json({ success: true, registration });
  } catch (error: any) {
    console.error(error);
    // Handle Prisma unique constraint violation (P2002) roughly
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'You are already registered for this event.' });
    }
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));