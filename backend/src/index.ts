import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import crypto from 'crypto';
import { EventStatus, OrganizationKind, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginPatterns = (process.env.CORS_ORIGIN_PATTERN || '^https://.*\\.ngrok-free\\.app$,^https://.*\\.ngrok-free\\.dev$')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => new RegExp(pattern));

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith('.ngrok-free.app') || hostname.endsWith('.ngrok-free.dev');
  } catch {
    return false;
  }
}

app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '32kb' }));

const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  }
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

type AuthUser = {
  sub: string;
  email: string;
  role: Role;
  exp: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 20;
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function timingSafeEqualString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function signToken(user: { id: string; email: string; role: Role }) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET as string)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET as string)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');

  if (!timingSafeEqualString(parts[2], expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as AuthUser;
    if (!payload.sub || !payload.email || !Object.values(Role).includes(payload.role) || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('base64url');
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`scrypt$${salt}$${derivedKey.toString('base64url')}`);
    });
  });
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return Promise.resolve(false);

  return new Promise<boolean>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(timingSafeEqualString(derivedKey.toString('base64url'), hash));
    });
  });
}

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function normalizeOrganizationKind(kind: unknown) {
  const normalized = typeof kind === 'string'
    ? kind.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    : '';

  if (Object.values(OrganizationKind).includes(normalized as OrganizationKind)) {
    return normalized as OrganizationKind;
  }

  return OrganizationKind.OTHER;
}

function validateAuthInput(body: any, mode: 'register' | 'login') {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const role = body.role === 'ORGANIZER' ? Role.ORGANIZER : Role.STUDENT;
  const organizationName = typeof body.organizationName === 'string'
    ? body.organizationName.trim().replace(/\s+/g, ' ')
    : '';
  const organizationKind = normalizeOrganizationKind(body.organizationKind);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: 'Enter a valid email address.' };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: 'Password must be between 8 and 128 characters.' };
  }
  if (mode === 'register' && (name.length < 2 || name.length > 80)) {
    return { error: 'Name must be between 2 and 80 characters.' };
  }
  if (mode === 'register' && role === Role.ORGANIZER && (organizationName.length < 2 || organizationName.length > 120)) {
    return { error: 'Organization name must be between 2 and 120 characters.' };
  }

  return { email, password, name, role, organizationName, organizationKind };
}

function authRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = `${req.ip}:${normalizeEmail(req.body?.email)}`;
  const now = Date.now();
  const attempt = authAttempts.get(key);

  if (!attempt || attempt.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return next();
  }

  if (attempt.count >= AUTH_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  attempt.count += 1;
  return next();
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? verifyToken(token) : null;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  req.user = user;
  return next();
}

function requireRole(role: Role) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'You do not have access to this action.' });
    }
    return next();
  };
}

function parseEventInput(body: any) {
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim().replace(/\s+/g, ' ') : '';
  const location = typeof body.location === 'string' ? body.location.trim().replace(/\s+/g, ' ') : '';
  const capacity = Number(body.capacity);
  const startsAt = typeof body.startsAt === 'string' && body.startsAt.trim()
    ? new Date(body.startsAt)
    : null;

  if (title.length < 2 || title.length > 160) return { error: 'Event title must be between 2 and 160 characters.' };
  if (description.length > 5000) return { error: 'Description must be 5000 characters or less.' };
  if (category.length > 80) return { error: 'Category must be 80 characters or less.' };
  if (location.length > 180) return { error: 'Location must be 180 characters or less.' };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) return { error: 'Capacity must be between 1 and 100000.' };
  if (startsAt && Number.isNaN(startsAt.getTime())) return { error: 'Event date is invalid.' };

  return {
    title,
    description: description || null,
    category: category || null,
    location: location || null,
    capacity,
    startsAt,
  };
}

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt?: Date;
  organization?: { id: string; name: string; kind: OrganizationKind } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: user.organization ?? null,
    createdAt: user.createdAt,
  };
}

app.get('/api/health', async (_, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  const input = validateAuthInput(req.body, 'register');
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          passwordHash: await hashPassword(input.password),
        },
      });

      if (input.role === Role.ORGANIZER) {
        await tx.organization.create({
          data: {
            name: input.organizationName,
            kind: input.organizationKind,
            ownerId: createdUser.id,
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: { organization: { select: { id: true, name: true, kind: true } } },
      });
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
  const input = validateAuthInput(req.body, 'login');
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organization: { select: { id: true, name: true, kind: true } } },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    include: { organization: { select: { id: true, name: true, kind: true } } },
  });

  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user: publicUser(user) });
});

app.get('/api/events', async (_, res) => {
  const events = await prisma.event.findMany({
    where: { status: EventStatus.PUBLISHED },
    include: {
      organizer: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, kind: true } },
      _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } },
    },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({
    events: events.map(({ _count, ...event }) => ({
      ...event,
      registered: _count.registrations,
    })),
  });
});

app.get('/api/events/my', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const events = await prisma.event.findMany({
    where: { organizerId: req.user!.sub },
    include: {
      organization: { select: { id: true, name: true, kind: true } },
      _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } },
    },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({
    events: events.map(({ _count, ...event }) => ({
      ...event,
      registered: _count.registrations,
    })),
  });
});

app.post('/api/events', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const input = parseEventInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const organization = await prisma.organization.findUnique({
      where: { ownerId: req.user!.sub },
      select: { id: true },
    });

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          startsAt: input.startsAt,
          location: input.location,
          capacity: input.capacity,
          status: EventStatus.PUBLISHED,
          organizerId: req.user!.sub,
          organizationId: organization?.id ?? null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Event',
          aggregateId: created.id,
          eventType: 'EventPublished',
          payload: { eventId: created.id, organizerId: req.user!.sub },
        },
      });

      return created;
    });

    res.status(201).json({ event: { ...event, registered: 0 } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Event Registration Endpoint (Concurrency Safe)
app.post('/api/register', requireAuth, requireRole(Role.STUDENT), async (req, res) => {
  const userId = req.user!.sub;
  const { eventId } = req.body;

  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'eventId is required' });
  }

  try {
    // 1. Transaction to guarantee concurrency constraints
    const registration = await prisma.$transaction(async (tx) => {
      
      // Strict Row-level Locking: Lock the Event row against other concurrent threads
      // This ensures we always read the *absolute latest* count before proceeding.
      const lockQuery = await tx.$queryRaw<{ id: string, capacity: number }[]>`
        SELECT id, capacity FROM \`Event\`
        WHERE id = ${eventId} 
        FOR UPDATE
      `;

      if (lockQuery.length === 0) {
        throw new Error('Event not found');
      }

      const event = lockQuery[0]!;

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
