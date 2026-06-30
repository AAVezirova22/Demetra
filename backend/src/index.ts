import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import crypto from 'crypto';
import { EventStatus, NotificationStatus, OrganizationKind, PrismaClient, Role } from '@prisma/client';

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
app.use('/api', (_, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
const INVITE_TTL_DAYS = 14;

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

function normalizeRole(role: unknown) {
  return role === Role.ORGANIZER || role === 'ORGANIZER' ? Role.ORGANIZER : Role.STUDENT;
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
  const hasInvitationToken = typeof body.invitationToken === 'string' && body.invitationToken.trim().length > 0;
  if (mode === 'register' && role === Role.ORGANIZER && !hasInvitationToken && (organizationName.length < 2 || organizationName.length > 120)) {
    return { error: 'Organization name must be between 2 and 120 characters.' };
  }

  return { email, password, name, role, organizationName, organizationKind, invitationToken: hasInvitationToken ? body.invitationToken.trim() : '' };
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
  memberships?: { organization: { id: string; name: string; kind: OrganizationKind } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: user.organization ?? user.memberships?.[0]?.organization ?? null,
    createdAt: user.createdAt,
  };
}

async function getUserOrganization(userId: string) {
  const owned = await prisma.organization.findUnique({
    where: { ownerId: userId },
    select: { id: true, name: true, kind: true, ownerId: true },
  });
  if (owned) return owned;

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    include: { organization: { select: { id: true, name: true, kind: true, ownerId: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return membership?.organization ?? null;
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
      const invitation = input.invitationToken
        ? await tx.organizationInvitation.findUnique({
            where: { token: input.invitationToken },
            include: { organization: { select: { id: true, name: true, kind: true } } },
          })
        : null;

      if (input.invitationToken && (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date())) {
        throw new Error('Invitation is invalid or expired.');
      }
      if (invitation?.email && invitation.email !== input.email) {
        throw new Error('This invitation was issued for a different email address.');
      }

      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: invitation?.role ?? input.role,
          passwordHash: await hashPassword(input.password),
        },
      });

      if (invitation) {
        await tx.organizationMembership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: createdUser.id,
            role: invitation.role,
          },
        });
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date(), acceptedById: createdUser.id },
        });
        await tx.notification.create({
          data: {
            userId: createdUser.id,
            type: 'OrganizationJoined',
            title: `Joined ${invitation.organization.name}`,
            message: `You accepted the invitation to join ${invitation.organization.name} as ${invitation.role.toLowerCase()}.`,
            metadata: { organizationId: invitation.organizationId },
          },
        });
      } else if (input.role === Role.ORGANIZER) {
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
        include: {
          organization: { select: { id: true, name: true, kind: true } },
          memberships: { include: { organization: { select: { id: true, name: true, kind: true } } } },
        },
      });
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (error instanceof Error && error.message.includes('Invitation')) {
      return res.status(400).json({ error: error.message });
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
      include: {
        organization: { select: { id: true, name: true, kind: true } },
        memberships: { include: { organization: { select: { id: true, name: true, kind: true } } } },
      },
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
    include: {
      organization: { select: { id: true, name: true, kind: true } },
      memberships: { include: { organization: { select: { id: true, name: true, kind: true } } } },
    },
  });

  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user: publicUser(user) });
});

app.get('/api/organization', requireAuth, async (req, res) => {
  const organization = await getUserOrganization(req.user!.sub);
  if (!organization) return res.status(404).json({ error: 'Organization not found.' });

  const [owner, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: organization.ownerId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { id: true, name: true, email: true, role: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const canManageOrganization = organization.ownerId === req.user!.sub ||
    memberships.some((membership) => membership.userId === req.user!.sub && membership.role === Role.ORGANIZER);

  const invitations = canManageOrganization
    ? await prisma.organizationInvitation.findMany({
      where: { organizationId: organization.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, token: true, email: true, role: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    })
    : [];

  const members = [
    ...(owner ? [{ ...owner, membershipRole: Role.ORGANIZER, status: 'OWNER', joinedAt: owner.createdAt }] : []),
    ...memberships
      .filter((membership) => membership.userId !== organization.ownerId)
      .map((membership) => ({
        ...membership.user,
        membershipRole: membership.role,
        status: 'ACTIVE',
        joinedAt: membership.createdAt,
      })),
  ];

  res.json({ organization, members, invitations });
});

app.post('/api/organization/invitations', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const organization = await getUserOrganization(req.user!.sub);
  if (!organization) return res.status(404).json({ error: 'Organization not found.' });

  const email = normalizeEmail(req.body?.email);
  const role = normalizeRole(req.body?.role);
  if (req.body?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    const token = crypto.randomBytes(24).toString('base64url');
    const invitation = await prisma.organizationInvitation.create({
      data: {
        token,
        email: email || null,
        role,
        organizationId: organization.id,
        createdById: req.user!.sub,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, token: true, email: true, role: true, createdAt: true, expiresAt: true },
    });

    if (email) {
      const invitedUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (invitedUser) {
        await prisma.notification.create({
          data: {
            userId: invitedUser.id,
            type: 'OrganizationInvite',
            title: `Invitation to ${organization.name}`,
            message: `You have been invited to join ${organization.name} as ${role.toLowerCase()}.`,
            metadata: { token, organizationId: organization.id, role },
          },
        });
      }
    }

    res.status(201).json({ invitation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/invitations/:token', async (req, res) => {
  const token = req.params.token;
  if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'Invitation token is required.' });

  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true, kind: true } } },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
    return res.status(404).json({ error: 'Invitation is invalid or expired.' });
  }

  res.json({
    invitation: {
      token: invitation.token,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organization: invitation.organization,
    },
  });
});

app.post('/api/invitations/:token/accept', requireAuth, async (req, res) => {
  const token = req.params.token;
  if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'Invitation token is required.' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { token },
        include: { organization: { select: { id: true, name: true, kind: true } } },
      });

      if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
        throw new Error('Invitation is invalid or expired.');
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: req.user!.sub },
        select: { id: true, email: true, role: true },
      });

      if (invitation.email && invitation.email !== user.email) {
        throw new Error('This invitation was issued for a different email address.');
      }

      await tx.user.update({
        where: { id: user.id },
        data: { role: invitation.role === Role.ORGANIZER ? Role.ORGANIZER : user.role },
      });

      await tx.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
        create: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
        update: { role: invitation.role },
      });

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), acceptedById: user.id },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'OrganizationJoined',
          title: `Joined ${invitation.organization.name}`,
          message: `You joined ${invitation.organization.name} as ${invitation.role.toLowerCase()}.`,
          metadata: { organizationId: invitation.organizationId },
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          organization: { select: { id: true, name: true, kind: true } },
          memberships: { include: { organization: { select: { id: true, name: true, kind: true } } } },
        },
      });

      return { user: updatedUser, organization: invitation.organization };
    });

    res.json({ user: publicUser(result.user), organization: result.organization });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Invitation') || error.message.includes('different email'))) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    notifications,
    unreadCount: notifications.filter((notification) => notification.status === NotificationStatus.UNREAD).length,
  });
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'Notification id is required.' });

  const notification = await prisma.notification.updateMany({
    where: { id, userId: req.user!.sub },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });

  if (notification.count === 0) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ success: true });
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, status: NotificationStatus.UNREAD },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });

  res.json({ success: true });
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
    const organization = await getUserOrganization(req.user!.sub);

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
