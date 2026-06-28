export type AuthRole = 'STUDENT' | 'ORGANIZER';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  organization: {
    id: string;
    name: string;
    kind: string;
  } | null;
};

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  location: string | null;
  category: string | null;
  capacity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'CLOSED';
  registered: number;
  organizer?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
    kind: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'demetra.authToken';
const USER_KEY = 'demetra.authUser';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
  }

  return data as T;
}

export function getStoredAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;

  try {
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function storeAuth(auth: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
  organizationName?: string;
  organizationKind?: string;
}) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<{ user: AuthUser }>('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listEvents() {
  return apiRequest<{ events: EventRecord[] }>('/events');
}

export async function listMyEvents(token: string) {
  return apiRequest<{ events: EventRecord[] }>('/events/my', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createEvent(token: string, input: {
  title: string;
  description?: string;
  category?: string;
  startsAt?: string;
  location?: string;
  capacity: number;
}) {
  return apiRequest<{ event: EventRecord }>('/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function registerForEvent(token: string, eventId: string) {
  return apiRequest<{ success: boolean; registration: { id: string; status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' } }>('/register', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ eventId }),
  });
}
