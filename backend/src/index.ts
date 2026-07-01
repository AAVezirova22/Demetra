import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const Role = {
  STUDENT: 'STUDENT',
  ORGANIZER: 'ORGANIZER',
} as const;
type Role = typeof Role[keyof typeof Role];

const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const;

const NotificationStatus = {
  UNREAD: 'UNREAD',
  READ: 'READ',
} as const;

const RegistrationStatus = {
  CONFIRMED: 'CONFIRMED',
  WAITLISTED: 'WAITLISTED',
  CANCELLED: 'CANCELLED',
} as const;

const OrganizationKind = {
  MUSIC_SCHOOL: 'MUSIC_SCHOOL',
  CONSERVATORY: 'CONSERVATORY',
  UNIVERSITY_DEPARTMENT: 'UNIVERSITY_DEPARTMENT',
  CHOIR: 'CHOIR',
  STUDENT_CLUB: 'STUDENT_CLUB',
  OTHER: 'OTHER',
} as const;
type OrganizationKind = typeof OrganizationKind[keyof typeof OrganizationKind];
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
app.use(express.json({ limit: '2mb' }));
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

type StoredUserProfile = {
  userId: string;
  avatar: string | null;
  location: string | null;
  bio: string | null;
  headline: string | null;
  primaryFocus: string | null;
  phone: string | null;
  website: string | null;
};

type ProfileInput =
  | { error: string }
  | { displayName: string | null; profile: Omit<StoredUserProfile, 'userId'> };

type SeatStatus = 'available' | 'taken' | 'selected' | 'vip' | 'blocked';
type StageSeat = {
  id: string;
  row: number;
  col: number;
  status: SeatStatus;
};
type StoredStageLayout = {
  id: string;
  name: string;
  venue: string | null;
  rows: number;
  cols: number;
  seats: string | StageSeat[];
  stageShape: 'rect' | 'arc' | 'thrust';
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};
type StageLayoutInput =
  | { error: string }
  | {
      name: string;
      venue: string | null;
      rows: number;
      cols: number;
      seats: StageSeat[];
      stageShape: 'rect' | 'arc' | 'thrust';
    };
type OrganizationPostInput =
  | { error: string }
  | {
      title: string;
      body: string;
    };

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

async function getUserOrganizationAccess(userId: string) {
  const organization = await getUserOrganization(userId);
  if (!organization) return null;

  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: organization.id, userId } },
    select: { role: true },
  });

  return {
    organization,
    canManage: organization.ownerId === userId || membership?.role === Role.ORGANIZER,
  };
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number,
  fieldName: string,
  collapseWhitespace = true,
): { value: string | null } | { error: string } {
  const normalized = typeof value === 'string'
    ? (collapseWhitespace ? value.trim().replace(/\s+/g, ' ') : value.trim())
    : '';

  if (normalized.length > maxLength) {
    return { error: `${fieldName} must be ${maxLength} characters or less.` };
  }

  return { value: normalized || null };
}

function parseProfileInput(body: any): ProfileInput {
  const displayName = normalizeOptionalText(body.displayName, 120, 'Display name');
  if ('error' in displayName) return displayName;

  const avatar = typeof body.avatar === 'string' ? body.avatar.trim() : '';
  if (avatar && (!avatar.startsWith('data:image/') || avatar.length > 1_000_000)) {
    return { error: 'Profile picture must be an image under 1 MB.' };
  }

  const location = normalizeOptionalText(body.location, 180, 'Location');
  if ('error' in location) return location;
  const bio = normalizeOptionalText(body.bio, 2000, 'Bio', false);
  if ('error' in bio) return bio;
  const headline = normalizeOptionalText(body.headline, 120, 'Headline');
  if ('error' in headline) return headline;
  const primaryFocus = normalizeOptionalText(body.primaryFocus, 120, 'Primary subject');
  if ('error' in primaryFocus) return primaryFocus;
  const phone = normalizeOptionalText(body.phone, 80, 'Phone');
  if ('error' in phone) return phone;
  const website = normalizeOptionalText(body.website, 240, 'Website');
  if ('error' in website) return website;

  return {
    displayName: displayName.value,
    profile: {
      avatar: avatar || null,
      location: location.value,
      bio: bio.value,
      headline: headline.value,
      primaryFocus: primaryFocus.value,
      phone: phone.value,
      website: website.value,
    },
  };
}

function isSeatStatus(value: unknown): value is SeatStatus {
  return value === 'available' || value === 'taken' || value === 'selected' || value === 'vip' || value === 'blocked';
}

function parseStageLayoutInput(body: any): StageLayoutInput {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const venue = typeof body.venue === 'string' ? body.venue.trim().replace(/\s+/g, ' ') : '';
  const rows = Number(body.rows);
  const cols = Number(body.cols);
  const stageShape = body.stageShape === 'arc' || body.stageShape === 'thrust' ? body.stageShape : 'rect';

  if (name.length < 2 || name.length > 120) return { error: 'Layout name must be between 2 and 120 characters.' };
  if (venue.length > 180) return { error: 'Venue must be 180 characters or less.' };
  if (!Number.isInteger(rows) || rows < 2 || rows > 20) return { error: 'Rows must be between 2 and 20.' };
  if (!Number.isInteger(cols) || cols < 4 || cols > 24) return { error: 'Columns must be between 4 and 24.' };
  if (!Array.isArray(body.seats) || body.seats.length !== rows * cols) return { error: 'Seat map does not match the selected rows and columns.' };

  const seats: Array<StageSeat | null> = body.seats.map((seat: any): StageSeat | null => {
    const row = Number(seat?.row);
    const col = Number(seat?.col);
    const status = seat?.status;
    if (!Number.isInteger(row) || row < 0 || row >= rows) return null;
    if (!Number.isInteger(col) || col < 0 || col >= cols) return null;
    if (!isSeatStatus(status)) return null;
    return {
      id: `${row}-${col}`,
      row,
      col,
      status,
    };
  });

  if (seats.some((seat) => seat === null)) return { error: 'Seat map contains invalid seats.' };

  return {
    name,
    venue: venue || null,
    rows,
    cols,
    seats: seats as StageSeat[],
    stageShape,
  };
}

function parseOrganizationPostInput(body: any): OrganizationPostInput {
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';

  if (title.length < 2 || title.length > 160) return { error: 'Post title must be between 2 and 160 characters.' };
  if (bodyText.length < 2 || bodyText.length > 10000) return { error: 'Post text must be between 2 and 10000 characters.' };

  return { title, body: bodyText };
}

function publicProfile(user: {
  name: string;
  role: Role;
  profile?: Omit<StoredUserProfile, 'userId'> | null;
}) {
  return {
    displayName: user.name,
    avatar: user.profile?.avatar ?? '',
    location: user.profile?.location ?? '',
    bio: user.profile?.bio ?? '',
    headline: user.profile?.headline ?? (user.role === Role.ORGANIZER ? 'Teacher' : 'Student'),
    primaryFocus: user.profile?.primaryFocus ?? '',
    phone: user.profile?.phone ?? '',
    website: user.profile?.website ?? '',
  };
}

async function ensureUserProfileTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS \`UserProfile\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`avatar\` MEDIUMTEXT NULL,
      \`location\` VARCHAR(191) NULL,
      \`bio\` TEXT NULL,
      \`headline\` VARCHAR(191) NULL,
      \`primaryFocus\` VARCHAR(191) NULL,
      \`phone\` VARCHAR(191) NULL,
      \`website\` VARCHAR(191) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`UserProfile_userId_key\`(\`userId\`),
      CONSTRAINT \`UserProfile_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
}

async function ensureStageLayoutTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS \`StageLayout\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`venue\` VARCHAR(191) NULL,
      \`rows\` INTEGER NOT NULL,
      \`cols\` INTEGER NOT NULL,
      \`seats\` JSON NOT NULL,
      \`stageShape\` VARCHAR(191) NOT NULL,
      \`organizationId\` VARCHAR(191) NOT NULL,
      \`createdById\` VARCHAR(191) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`StageLayout_organizationId_createdAt_idx\`(\`organizationId\`, \`createdAt\`),
      INDEX \`StageLayout_createdById_idx\`(\`createdById\`),
      CONSTRAINT \`StageLayout_organizationId_fkey\` FOREIGN KEY (\`organizationId\`) REFERENCES \`Organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`StageLayout_createdById_fkey\` FOREIGN KEY (\`createdById\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
}

function publicStageLayout(layout: StoredStageLayout) {
  const parsedSeats = typeof layout.seats === 'string' ? JSON.parse(layout.seats) : layout.seats;

  return {
    id: layout.id,
    name: layout.name,
    venue: layout.venue ?? '',
    rows: layout.rows,
    cols: layout.cols,
    seats: parsedSeats,
    stageShape: layout.stageShape,
    createdAt: layout.createdAt,
    updatedAt: layout.updatedAt,
  };
}

function publicRegistration(registration: any) {
  return {
    id: registration.id,
    status: registration.status,
    userId: registration.userId,
    eventId: registration.eventId,
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
    event: registration.event
      ? {
          ...registration.event,
          registered: registration.event._count?.registrations ?? registration.event.registered ?? 0,
        }
      : undefined,
    user: registration.user
      ? {
          id: registration.user.id,
          email: registration.user.email,
          name: registration.user.name,
        }
      : undefined,
  };
}

function publicOrganizationPost(post: any) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    organizationId: post.organizationId,
    author: post.author
      ? {
          id: post.author.id,
          name: post.author.name,
        }
      : undefined,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function getProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, StoredUserProfile>();

  const placeholders = userIds.map(() => '?').join(',');
  const profiles = await prisma.$queryRawUnsafe(
    `SELECT userId, avatar, location, bio, headline, primaryFocus, phone, website FROM \`UserProfile\` WHERE userId IN (${placeholders})`,
    ...userIds,
  ) as StoredUserProfile[];

  return new Map(profiles.map((profile: StoredUserProfile) => [profile.userId, profile]));
}

async function getProfileByUserId(userId: string) {
  const profiles = await getProfilesByUserIds([userId]);
  return profiles.get(userId) ?? null;
}

async function saveUserProfile(userId: string, profile: Omit<StoredUserProfile, 'userId'>) {
  await prisma.$executeRaw`
    INSERT INTO \`UserProfile\` (
      \`id\`, \`userId\`, \`avatar\`, \`location\`, \`bio\`, \`headline\`, \`primaryFocus\`, \`phone\`, \`website\`, \`createdAt\`, \`updatedAt\`
    ) VALUES (
      ${crypto.randomUUID()}, ${userId}, ${profile.avatar}, ${profile.location}, ${profile.bio}, ${profile.headline}, ${profile.primaryFocus}, ${profile.phone}, ${profile.website}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
    )
    ON DUPLICATE KEY UPDATE
      \`avatar\` = VALUES(\`avatar\`),
      \`location\` = VALUES(\`location\`),
      \`bio\` = VALUES(\`bio\`),
      \`headline\` = VALUES(\`headline\`),
      \`primaryFocus\` = VALUES(\`primaryFocus\`),
      \`phone\` = VALUES(\`phone\`),
      \`website\` = VALUES(\`website\`),
      \`updatedAt\` = CURRENT_TIMESTAMP(3)
  `;
}

app.get('/api/health', async (_, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  const input = validateAuthInput(req.body, 'register');
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const user = await prisma.$transaction(async (tx: any) => {
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
            role: Role.STUDENT,
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
            message: `You accepted the invitation to join ${invitation.organization.name} as ${invitation.role === Role.ORGANIZER ? 'teacher' : 'student'}.`,
            metadata: { organizationId: invitation.organizationId },
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

app.get('/api/profile', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, name: true, role: true },
  });

  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const profile = await getProfileByUserId(user.id);
  res.json({ profile: publicProfile({ ...user, profile }) });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const input = parseProfileInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  await saveUserProfile(req.user!.sub, input.profile);

  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: input.displayName ? { name: input.displayName } : {},
    include: {
      organization: { select: { id: true, name: true, kind: true } },
      memberships: { include: { organization: { select: { id: true, name: true, kind: true } } } },
    },
  });

  const profile = await getProfileByUserId(user.id);
  res.json({ user: publicUser(user), profile: publicProfile({ ...user, profile }) });
});

app.get('/api/organization', requireAuth, async (req, res) => {
  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  const { organization, canManage } = access;

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

  const memberUsers = [
    ...(owner ? [owner] : []),
    ...memberships.filter((membership: any) => membership.userId !== organization.ownerId).map((membership: any) => membership.user),
  ];
  const profiles = await getProfilesByUserIds(memberUsers.map((member) => member.id));

  const invitations = canManage
    ? await prisma.organizationInvitation.findMany({
      where: { organizationId: organization.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, token: true, email: true, role: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    })
    : [];

  const members = [
    ...(owner ? [{ ...owner, profile: publicProfile({ ...owner, profile: profiles.get(owner.id) ?? null }), membershipRole: Role.ORGANIZER, status: 'OWNER', joinedAt: owner.createdAt }] : []),
    ...memberships
      .filter((membership: any) => membership.userId !== organization.ownerId)
      .map((membership: any) => ({
        ...membership.user,
        profile: publicProfile({ ...membership.user, profile: profiles.get(membership.userId) ?? null }),
        membershipRole: membership.role,
        status: 'ACTIVE',
        joinedAt: membership.createdAt,
      })),
  ];

  res.json({ organization, members, invitations });
});

app.patch('/api/organization/members/:userId', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

  const targetUserId = typeof req.params.userId === 'string' ? req.params.userId : '';
  const role = normalizeRole(req.body?.role);
  if (!targetUserId || targetUserId === access.organization.ownerId) {
    return res.status(400).json({ error: 'This member cannot be changed.' });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!target) return res.status(404).json({ error: 'Member not found.' });
  if (role === Role.ORGANIZER && target.role !== Role.ORGANIZER) {
    return res.status(400).json({ error: 'Only teacher accounts can be made organizers.' });
  }

  const membership = await prisma.organizationMembership.updateMany({
    where: { organizationId: access.organization.id, userId: targetUserId },
    data: { role },
  });
  if (membership.count === 0) return res.status(404).json({ error: 'Member not found.' });

  res.json({ success: true });
});

app.post('/api/organization', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim().replace(/\s+/g, ' ')
    : '';
  const kind = normalizeOrganizationKind(req.body?.kind);

  if (name.length < 2 || name.length > 120) {
    return res.status(400).json({ error: 'Organization name must be between 2 and 120 characters.' });
  }

  const existingOrganization = await getUserOrganization(req.user!.sub);
  if (existingOrganization) {
    return res.status(409).json({ error: 'You already belong to an organization.' });
  }

  try {
    const organization = await prisma.organization.create({
      data: {
        name,
        kind,
        ownerId: req.user!.sub,
      },
      select: { id: true, name: true, kind: true },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.sub },
      include: {
        organization: { select: { id: true, name: true, kind: true } },
        memberships: { include: { organization: { select: { id: true, name: true, kind: true } } } },
      },
    });

    res.status(201).json({ organization, user: publicUser(user) });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'You already own an organization.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/organization/invitations', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });
  const { organization } = access;

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
            message: `You have been invited to join ${organization.name} as ${role === Role.ORGANIZER ? 'teacher' : 'student'}.`,
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

app.get('/api/organization/posts', requireAuth, async (req, res) => {
  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });

  const posts = await prisma.organizationPost.findMany({
    where: { organizationId: access.organization.id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ posts: posts.map(publicOrganizationPost) });
});

app.get('/api/organization/posts/:id', requireAuth, async (req, res) => {
  const postId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!postId) return res.status(400).json({ error: 'Post id is required.' });

  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });

  const post = await prisma.organizationPost.findFirst({
    where: { id: postId, organizationId: access.organization.id },
    include: { author: { select: { id: true, name: true } } },
  });

  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json({ post: publicOrganizationPost(post) });
});

app.post('/api/organization/posts', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const input = parseOrganizationPostInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const access = await getUserOrganizationAccess(req.user!.sub);
    if (!access) return res.status(404).json({ error: 'Organization not found.' });
    if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

    const post = await prisma.$transaction(async (tx: any) => {
      const created = await tx.organizationPost.create({
        data: {
          title: input.title,
          body: input.body,
          organizationId: access.organization.id,
          authorId: req.user!.sub,
        },
        include: { author: { select: { id: true, name: true } } },
      });

      const organization = await tx.organization.findUnique({
        where: { id: access.organization.id },
        select: { ownerId: true },
      });
      const memberships = await tx.organizationMembership.findMany({
        where: { organizationId: access.organization.id },
        select: { userId: true },
      });
      const recipientIds = Array.from(new Set([
        organization?.ownerId,
        ...memberships.map((membership: { userId: string }) => membership.userId),
      ].filter((userId): userId is string => typeof userId === 'string')));

      if (recipientIds.length > 0) {
        await tx.notification.createMany({
          data: recipientIds.map((userId: string) => ({
            userId,
            type: 'OrganizationPostPublished',
            title: `New post: ${created.title}`,
            message: `${created.author.name} posted news in ${access.organization.name}.`,
            metadata: { postId: created.id, organizationId: access.organization.id },
          })),
        });
      }

      return created;
    });

    res.status(201).json({ post: publicOrganizationPost(post) });
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
    const result = await prisma.$transaction(async (tx: any) => {
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
        create: { organizationId: invitation.organizationId, userId: user.id, role: Role.STUDENT },
        update: {},
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
          message: `You joined ${invitation.organization.name} as ${invitation.role === Role.ORGANIZER ? 'teacher' : 'student'}.`,
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
    unreadCount: notifications.filter((notification: any) => notification.status === NotificationStatus.UNREAD).length,
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

app.get('/api/stage-layouts', requireAuth, async (req, res) => {
  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });

  const layouts = await prisma.$queryRaw<StoredStageLayout[]>`
    SELECT \`id\`, \`name\`, \`venue\`, \`rows\`, \`cols\`, \`seats\`, \`stageShape\`, \`organizationId\`, \`createdById\`, \`createdAt\`, \`updatedAt\`
    FROM \`StageLayout\`
    WHERE \`organizationId\` = ${access.organization.id}
    ORDER BY \`createdAt\` DESC
  `;

  res.json({ layouts: layouts.map(publicStageLayout) });
});

app.post('/api/stage-layouts', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const input = parseStageLayoutInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

  const id = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO \`StageLayout\` (
      \`id\`, \`name\`, \`venue\`, \`rows\`, \`cols\`, \`seats\`, \`stageShape\`, \`organizationId\`, \`createdById\`, \`createdAt\`, \`updatedAt\`
    ) VALUES (
      ${id}, ${input.name}, ${input.venue}, ${input.rows}, ${input.cols}, ${JSON.stringify(input.seats)}, ${input.stageShape}, ${access.organization.id}, ${req.user!.sub}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
    )
  `;

  const layouts = await prisma.$queryRaw<StoredStageLayout[]>`
    SELECT \`id\`, \`name\`, \`venue\`, \`rows\`, \`cols\`, \`seats\`, \`stageShape\`, \`organizationId\`, \`createdById\`, \`createdAt\`, \`updatedAt\`
    FROM \`StageLayout\`
    WHERE \`id\` = ${id}
    LIMIT 1
  `;

  res.status(201).json({ layout: publicStageLayout(layouts[0]!) });
});

app.put('/api/stage-layouts/:id', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) return res.status(400).json({ error: 'Layout id is required.' });

  const input = parseStageLayoutInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

  const result = await prisma.$executeRaw`
    UPDATE \`StageLayout\`
    SET
      \`name\` = ${input.name},
      \`venue\` = ${input.venue},
      \`rows\` = ${input.rows},
      \`cols\` = ${input.cols},
      \`seats\` = ${JSON.stringify(input.seats)},
      \`stageShape\` = ${input.stageShape},
      \`updatedAt\` = CURRENT_TIMESTAMP(3)
    WHERE \`id\` = ${id} AND \`organizationId\` = ${access.organization.id}
  `;

  if (Number(result) === 0) return res.status(404).json({ error: 'Layout not found.' });

  const layouts = await prisma.$queryRaw<StoredStageLayout[]>`
    SELECT \`id\`, \`name\`, \`venue\`, \`rows\`, \`cols\`, \`seats\`, \`stageShape\`, \`organizationId\`, \`createdById\`, \`createdAt\`, \`updatedAt\`
    FROM \`StageLayout\`
    WHERE \`id\` = ${id}
    LIMIT 1
  `;

  res.json({ layout: publicStageLayout(layouts[0]!) });
});

app.delete('/api/stage-layouts/:id', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) return res.status(400).json({ error: 'Layout id is required.' });

  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

  const result = await prisma.$executeRaw`
    DELETE FROM \`StageLayout\`
    WHERE \`id\` = ${id} AND \`organizationId\` = ${access.organization.id}
  `;

  if (Number(result) === 0) return res.status(404).json({ error: 'Layout not found.' });
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
    events: events.map(({ _count, ...event }: any) => ({
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
    events: events.map(({ _count, ...event }: any) => ({
      ...event,
      registered: _count.registrations,
    })),
  });
});

app.get('/api/registrations/my', requireAuth, requireRole(Role.STUDENT), async (req, res) => {
  const registrations = await prisma.registration.findMany({
    where: { userId: req.user!.sub },
    include: {
      event: {
        include: {
          organizer: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, kind: true } },
          _count: { select: { registrations: { where: { status: RegistrationStatus.CONFIRMED } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ registrations: registrations.map(publicRegistration) });
});

app.get('/api/events/:id/registrations', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const eventId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!eventId) return res.status(400).json({ error: 'Event id is required.' });

  const access = await getUserOrganizationAccess(req.user!.sub);
  if (!access) return res.status(404).json({ error: 'Organization not found.' });
  if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const registrations = await prisma.registration.findMany({
    where: { eventId, status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
  const mapped = registrations.map(publicRegistration);

  res.json({
    registrations: mapped,
    confirmed: mapped.filter((registration) => registration.status === RegistrationStatus.CONFIRMED),
    waitlisted: mapped.filter((registration) => registration.status === RegistrationStatus.WAITLISTED),
  });
});

app.post('/api/events', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const input = parseEventInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const access = await getUserOrganizationAccess(req.user!.sub);
    if (!access) return res.status(404).json({ error: 'Organization not found.' });
    if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

    const event = await prisma.$transaction(async (tx: any) => {
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
          organizationId: access.organization.id,
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

app.patch('/api/events/:id', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const eventId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!eventId) return res.status(400).json({ error: 'Event id is required.' });

  const input = parseEventInput(req.body);
  if ('error' in input) return res.status(400).json({ error: input.error });

  try {
    const access = await getUserOrganizationAccess(req.user!.sub);
    if (!access) return res.status(404).json({ error: 'Organization not found.' });
    if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

    const event = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.event.findFirst({
        where: { id: eventId, organizationId: access.organization.id },
      });
      if (!existing) throw new Error('Event not found');
      if (existing.status === EventStatus.CANCELLED || existing.status === EventStatus.CLOSED) {
        throw new Error('Event is not editable');
      }

      const confirmedCount = await tx.registration.count({
        where: { eventId, status: RegistrationStatus.CONFIRMED },
      });
      if (input.capacity < confirmedCount) {
        throw new Error('Capacity below confirmed registrations');
      }

      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          startsAt: input.startsAt,
          location: input.location,
          capacity: input.capacity,
          reminderSentAt: existing.startsAt?.getTime() === input.startsAt?.getTime() ? existing.reminderSentAt : null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Event',
          aggregateId: updated.id,
          eventType: 'EventUpdated',
          payload: { eventId: updated.id, organizerId: req.user!.sub },
        },
      });

      return updated;
    });

    const registered = await prisma.registration.count({
      where: { eventId, status: RegistrationStatus.CONFIRMED },
    });

    res.json({ event: { ...event, registered } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (error instanceof Error && error.message === 'Event is not editable') {
      return res.status(409).json({ error: 'Event is not editable.' });
    }
    if (error instanceof Error && error.message === 'Capacity below confirmed registrations') {
      return res.status(409).json({ error: 'Capacity cannot be lower than confirmed registrations.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/api/events/:id/cancel', requireAuth, requireRole(Role.ORGANIZER), async (req, res) => {
  const eventId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!eventId) return res.status(400).json({ error: 'Event id is required.' });

  try {
    const access = await getUserOrganizationAccess(req.user!.sub);
    if (!access) return res.status(404).json({ error: 'Organization not found.' });
    if (!access.canManage) return res.status(403).json({ error: 'You do not have access to this action.' });

    const event = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.event.findFirst({
        where: { id: eventId, organizationId: access.organization.id },
      });
      if (!existing) throw new Error('Event not found');
      if (existing.status === EventStatus.CANCELLED) return existing;

      const activeRegistrations = await tx.registration.findMany({
        where: { eventId, status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
        select: { userId: true },
      });

      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.CANCELLED },
      });

      await tx.registration.updateMany({
        where: { eventId, status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] } },
        data: { status: RegistrationStatus.CANCELLED },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Event',
          aggregateId: updated.id,
          eventType: 'EventCancelled',
          payload: { eventId: updated.id, organizerId: req.user!.sub, userIds: activeRegistrations.map((registration: { userId: string }) => registration.userId) },
        },
      });

      return updated;
    });

    res.json({ event: { ...event, registered: 0 } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found.' });
    }
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
    const registration = await prisma.$transaction(async (tx: any) => {
      const lockQuery = await tx.$queryRaw<{ id: string, capacity: number, status: string }[]>`
        SELECT id, capacity, status FROM \`Event\`
        WHERE id = ${eventId} 
        FOR UPDATE
      `;

      if (lockQuery.length === 0) {
        throw new Error('Event not found');
      }

      const event = lockQuery[0]!;
      if (event.status !== EventStatus.PUBLISHED) {
        throw new Error('Event is not open for registration');
      }

      const existingRegistration = await tx.registration.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (existingRegistration && existingRegistration.status !== RegistrationStatus.CANCELLED) {
        throw new Error('Already registered');
      }

      const confirmedCount = await tx.registration.count({
        where: { eventId, status: RegistrationStatus.CONFIRMED }
      });

      const newStatus = confirmedCount < event.capacity ? RegistrationStatus.CONFIRMED : RegistrationStatus.WAITLISTED;
      const now = new Date();

      const newRegistration = existingRegistration
        ? await tx.registration.update({
            where: { id: existingRegistration.id },
            data: { status: newStatus, createdAt: now, updatedAt: now },
          })
        : await tx.registration.create({
            data: {
              userId,
              eventId,
              status: newStatus
            }
          });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Registration',
          aggregateId: newRegistration.id,
          eventType: newStatus === RegistrationStatus.CONFIRMED ? 'RegistrationConfirmed' : 'RegistrationWaitlisted',
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
    if (error instanceof Error && error.message === 'Already registered') {
      return res.status(409).json({ error: 'You are already registered for this event.' });
    }
    if (error instanceof Error && error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (error instanceof Error && error.message === 'Event is not open for registration') {
      return res.status(409).json({ error: 'Event is not open for registration.' });
    }
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.delete('/api/events/:id/registration', requireAuth, requireRole(Role.STUDENT), async (req, res) => {
  const userId = req.user!.sub;
  const eventId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!eventId) return res.status(400).json({ error: 'Event id is required.' });

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const lockQuery = await tx.$queryRaw<{ id: string, capacity: number }[]>`
        SELECT id, capacity FROM \`Event\`
        WHERE id = ${eventId}
        FOR UPDATE
      `;
      if (lockQuery.length === 0) throw new Error('Event not found');

      const registration = await tx.registration.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (!registration || registration.status === RegistrationStatus.CANCELLED) {
        throw new Error('Registration not found');
      }

      const cancelled = await tx.registration.update({
        where: { id: registration.id },
        data: { status: RegistrationStatus.CANCELLED },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Registration',
          aggregateId: cancelled.id,
          eventType: 'RegistrationCancelled',
          payload: { registrationId: cancelled.id, userId, eventId, previousStatus: registration.status },
        },
      });

      let promoted = null;
      if (registration.status === RegistrationStatus.CONFIRMED) {
        const nextWaitlisted = await tx.registration.findFirst({
          where: { eventId, status: RegistrationStatus.WAITLISTED },
          orderBy: { createdAt: 'asc' },
        });

        if (nextWaitlisted) {
          promoted = await tx.registration.update({
            where: { id: nextWaitlisted.id },
            data: { status: RegistrationStatus.CONFIRMED },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Registration',
              aggregateId: promoted.id,
              eventType: 'WaitlistPromoted',
              payload: { registrationId: promoted.id, userId: promoted.userId, eventId },
            },
          });
        }
      }

      return { cancelled, promoted };
    });

    res.json({
      success: true,
      registration: publicRegistration(result.cancelled),
      promoted: result.promoted ? publicRegistration(result.promoted) : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (error instanceof Error && error.message === 'Registration not found') {
      return res.status(404).json({ error: 'Registration not found.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
Promise.all([ensureUserProfileTable(), ensureStageLayoutTable()])
  .then(() => {
    server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
