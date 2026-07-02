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

export type UserProfile = {
  displayName: string;
  avatar: string;
  location: string;
  bio: string;
  headline: string;
  primaryFocus: string;
  phone: string;
  website: string;
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
  organizerId?: string;
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

export type RegistrationStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED';

export type RegistrationRecord = {
  id: string;
  status: RegistrationStatus;
  eventId: string;
  userId: string;
  waitlistPosition: number | null;
  createdAt: string;
  updatedAt: string;
  event?: EventRecord;
  user?: {
    id: string;
    email: string;
    name: string;
  };
};

export type SeatStatus = 'available' | 'taken' | 'selected' | 'vip' | 'blocked';

export type StageSeat = {
  id: string;
  row: number;
  col: number;
  status: SeatStatus;
};

export type StageLayoutRecord = {
  id: string;
  name: string;
  venue: string;
  rows: number;
  cols: number;
  seats: StageSeat[];
  stageShape: 'rect' | 'arc' | 'thrust';
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMember = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  profile: UserProfile;
  membershipRole: AuthRole;
  status: 'OWNER' | 'ACTIVE';
  joinedAt: string;
};

export type OrganizationInvitation = {
  id: string;
  token: string;
  email: string | null;
  role: AuthRole;
  createdAt: string;
  expiresAt: string;
};

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'UNREAD' | 'READ';
  metadata: unknown;
  createdAt: string;
  readAt: string | null;
};

export type OrganizationPost = {
  id: string;
  title: string;
  body: string;
  organizationId: string;
  author?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type InvitationDetails = {
  token: string;
  email: string | null;
  role: AuthRole;
  expiresAt: string;
  organization: {
    id: string;
    name: string;
    kind: string;
  };
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
  invitationToken?: string;
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

export async function fetchProfile(token: string) {
  return apiRequest<{ profile: UserProfile }>('/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateProfile(token: string, input: UserProfile) {
  return apiRequest<{ user: AuthUser; profile: UserProfile }>('/profile', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
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
  return apiRequest<{ success: boolean; registration: RegistrationRecord }>('/register', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ eventId }),
  });
}

export async function listStageLayouts(token: string) {
  return apiRequest<{ layouts: StageLayoutRecord[] }>('/stage-layouts', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateEvent(token: string, eventId: string, input: {
  title: string;
  description?: string;
  category?: string;
  startsAt?: string;
  location?: string;
  capacity: number;
}) {
  return apiRequest<{ event: EventRecord }>(`/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function cancelEventRegistration(token: string, eventId: string) {
  return apiRequest<{ success: boolean; registration: RegistrationRecord; promoted: RegistrationRecord | null }>(`/events/${encodeURIComponent(eventId)}/registration`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listMyRegistrations(token: string) {
  return apiRequest<{ registrations: RegistrationRecord[] }>('/registrations/my', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listEventRegistrations(token: string, eventId: string) {
  return apiRequest<{ registrations: RegistrationRecord[]; confirmed: RegistrationRecord[]; waitlisted: RegistrationRecord[] }>(`/events/${encodeURIComponent(eventId)}/registrations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function cancelEvent(token: string, eventId: string) {
  return apiRequest<{ event: EventRecord }>(`/events/${encodeURIComponent(eventId)}/cancel`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function saveStageLayout(token: string, input: Omit<StageLayoutRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const path = input.id ? `/stage-layouts/${encodeURIComponent(input.id)}` : '/stage-layouts';

  return apiRequest<{ layout: StageLayoutRecord }>(path, {
    method: input.id ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function deleteStageLayout(token: string, layoutId: string) {
  return apiRequest<{ success: boolean }>(`/stage-layouts/${encodeURIComponent(layoutId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchOrganization(token: string) {
  return apiRequest<{
    organization: AuthUser['organization'];
    members: OrganizationMember[];
    invitations: OrganizationInvitation[];
  }>('/organization', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createOrganization(token: string, input: { name: string; kind?: string }) {
  return apiRequest<{ organization: AuthUser['organization']; user: AuthUser }>('/organization', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export async function createInvitation(token: string, input: { email?: string; role: AuthRole }) {
  return apiRequest<{ invitation: OrganizationInvitation }>('/organization/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export async function listOrganizationPosts(token: string) {
  return apiRequest<{ posts: OrganizationPost[] }>('/organization/posts', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchOrganizationPost(token: string, postId: string) {
  return apiRequest<{ post: OrganizationPost }>(`/organization/posts/${encodeURIComponent(postId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createOrganizationPost(token: string, input: { title: string; body: string }) {
  return apiRequest<{ post: OrganizationPost }>('/organization/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export async function updateOrganizationMemberRole(token: string, userId: string, role: AuthRole) {
  return apiRequest<{ success: boolean }>(`/organization/members/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role }),
  });
}

export async function removeOrganizationMember(token: string, userId: string) {
  return apiRequest<{ success: boolean }>(`/organization/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchInvitation(token: string) {
  return apiRequest<{ invitation: InvitationDetails }>(`/invitations/${encodeURIComponent(token)}`);
}

export async function acceptInvitation(authToken: string, invitationToken: string) {
  return apiRequest<{ user: AuthUser; organization: AuthUser['organization'] }>(`/invitations/${encodeURIComponent(invitationToken)}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

export async function listNotifications(token: string) {
  return apiRequest<{ notifications: NotificationRecord[]; unreadCount: number }>('/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markNotificationRead(token: string, notificationId: string) {
  return apiRequest<{ success: boolean }>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllNotificationsRead(token: string) {
  return apiRequest<{ success: boolean }>('/notifications/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
