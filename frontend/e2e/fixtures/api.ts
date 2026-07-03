import { expect, type Page, type Route } from '@playwright/test';

export const token = 'qa-token';

export const organization = {
  id: 'org-qa',
  name: 'QA Music School',
  kind: 'MUSIC_SCHOOL',
};

export const users = {
  owner: {
    id: 'user-owner',
    email: 'owner.qa@demetra.test',
    name: 'Olena Owner',
    role: 'ORGANIZER' as const,
    organization,
  },
  organizer: {
    id: 'user-organizer',
    email: 'teacher.qa@demetra.test',
    name: 'Theo Teacher',
    role: 'ORGANIZER' as const,
    organization,
  },
  student: {
    id: 'user-student',
    email: 'student.qa@demetra.test',
    name: 'Stella Student',
    role: 'STUDENT' as const,
    organization,
  },
};

export const profiles = {
  owner: {
    displayName: users.owner.name,
    avatar: '',
    location: 'Sofia',
    bio: '',
    headline: 'Teacher',
    primaryFocus: 'Piano',
    phone: '',
    website: '',
  },
  student: {
    displayName: users.student.name,
    avatar: '',
    location: 'Sofia',
    bio: '',
    headline: 'Student',
    primaryFocus: 'Piano',
    phone: '',
    website: '',
  },
};

export const qaEvent = {
  id: 'event-qa-recital',
  title: 'QA Recital',
  description: 'A deterministic event used by Playwright QA.',
  startsAt: '2030-04-20T17:00:00.000Z',
  location: 'Sofia Music Hall',
  category: 'Concert',
  capacity: 2,
  price: 0,
  vipSeatPrice: 0,
  seatingMap: null,
  status: 'PUBLISHED' as const,
  registered: 1,
  activeSeats: [],
  organizerId: users.owner.id,
  organizer: { id: users.owner.id, name: users.owner.name },
  organization,
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
};

export const organizationPost = {
  id: 'post-welcome',
  title: 'Welcome to QA News',
  body: 'This seeded post verifies organization news rendering.',
  image: null,
  organizationId: organization.id,
  author: { id: users.owner.id, name: users.owner.name },
  createdAt: '2030-01-02T00:00:00.000Z',
  updatedAt: '2030-01-02T00:00:00.000Z',
};

export function authStorageScript(user: typeof users.owner | typeof users.organizer | typeof users.student) {
  return ({ authToken, authUser, view }: { authToken: string; authUser: unknown; view: string }) => {
    window.localStorage.setItem('demetra.authToken', authToken);
    window.localStorage.setItem('demetra.authUser', JSON.stringify(authUser));
    window.localStorage.setItem('demetra.currentView', view);
  };
}

export async function seedAuth(page: Page, user: typeof users.owner | typeof users.organizer | typeof users.student, view: string) {
  await page.addInitScript(authStorageScript(user), {
    authToken: token,
    authUser: user,
    view,
  });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function pathname(route: Route) {
  return new URL(route.request().url()).pathname;
}

export async function mockApi(page: Page, user = users.student) {
  await page.route('**/api/**', async (route) => {
    const path = pathname(route);
    const method = route.request().method();

    if (path === '/api/auth/me') {
      return json(route, { user });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      return json(route, { token, user });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const body = route.request().postDataJSON() as { name?: string; email?: string; role?: string };
      return json(route, {
        token,
        user: {
          id: 'registered-user',
          email: body.email ?? 'registered.qa@demetra.test',
          name: body.name ?? 'Registered User',
          role: body.role === 'ORGANIZER' ? 'ORGANIZER' : 'STUDENT',
          organization: body.role === 'ORGANIZER' ? null : organization,
        },
      }, 201);
    }

    if (path === '/api/organization') {
      return json(route, {
        organization,
        members: [
          {
            ...users.owner,
            profile: profiles.owner,
            membershipRole: 'ORGANIZER',
            status: 'OWNER',
            joinedAt: '2030-01-01T00:00:00.000Z',
          },
          {
            ...users.student,
            profile: profiles.student,
            membershipRole: 'STUDENT',
            status: 'ACTIVE',
            joinedAt: '2030-01-03T00:00:00.000Z',
          },
        ],
        invitations: user.id === users.student.id ? [] : [
          {
            id: 'invite-1',
            token: 'invite-token',
            email: 'new.student@demetra.test',
            role: 'STUDENT',
            createdAt: '2030-01-01T00:00:00.000Z',
            expiresAt: '2030-01-15T00:00:00.000Z',
          },
        ],
      });
    }

    if (path === '/api/events' && method === 'GET') {
      return json(route, { events: [qaEvent] });
    }

    if (path === '/api/events/my' && method === 'GET') {
      return json(route, { events: [qaEvent] });
    }

    if (path === '/api/register' && method === 'POST') {
      return json(route, {
        success: true,
        registration: {
          id: 'registration-qa',
          status: 'CONFIRMED',
          eventId: qaEvent.id,
          userId: user.id,
          waitlistPosition: null,
          seatLabel: null,
          seatType: null,
          createdAt: '2030-01-04T00:00:00.000Z',
          updatedAt: '2030-01-04T00:00:00.000Z',
          event: qaEvent,
        },
      }, 201);
    }

    if (path === '/api/registrations/my' && method === 'GET') {
      return json(route, { registrations: [] });
    }

    if (path === '/api/notifications' && method === 'GET') {
      return json(route, { notifications: [], unreadCount: 0 });
    }

    if (path === '/api/stage-layouts' && method === 'GET') {
      return json(route, { layouts: [] });
    }

    if (path === '/api/organization/posts' && method === 'GET') {
      return json(route, { posts: [organizationPost] });
    }

    if (path === '/api/organization/posts' && method === 'POST') {
      if (user.id === users.student.id) {
        return json(route, { error: 'You do not have access to this action.' }, 403);
      }

      const body = route.request().postDataJSON() as { title: string; body: string; image?: string | null };
      expect(body.image ?? '').toMatch(/^data:image\//);
      return json(route, {
        post: {
          id: 'post-created',
          title: body.title,
          body: body.body,
          image: body.image ?? null,
          organizationId: organization.id,
          author: { id: user.id, name: user.name },
          createdAt: '2030-01-05T00:00:00.000Z',
          updatedAt: '2030-01-05T00:00:00.000Z',
        },
      }, 201);
    }

    if (path === '/api/profile' && method === 'GET') {
      return json(route, { profile: user.id === users.student.id ? profiles.student : profiles.owner });
    }

    if (path === '/api/profile' && method === 'PUT') {
      const profile = route.request().postDataJSON();
      return json(route, {
        user: { ...user, name: profile.displayName || user.name },
        profile,
      });
    }

    return json(route, { error: `Unhandled QA route: ${method} ${path}` }, 404);
  });
}

export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
