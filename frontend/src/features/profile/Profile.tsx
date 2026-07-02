import { useEffect, useState, type ChangeEvent } from 'react';
import { CalendarDays, Camera, ChevronLeft, ChevronRight, Download, Globe, MapPin, Save, Trash2, UserRound } from 'lucide-react';
import {
  fetchProfile,
  getStoredAuth,
  listMyRegistrations,
  storeAuth,
  updateProfile,
  type AuthUser,
  type RegistrationRecord,
  type UserProfile,
} from '../../shared/api/api';
import './Profile.css';

const AVATAR_MAX_DIMENSION = 512;
const AVATAR_TARGET_BYTES = 350 * 1024;
const AVATAR_MAX_DATA_URL_LENGTH = 900_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ProfileProps {
  currentUser: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onOpenEvent: (eventId: string) => void;
}

function fallbackProfile(user: AuthUser): UserProfile {
  return {
    displayName: user.name,
    avatar: '',
    location: '',
    bio: '',
    headline: user.role === 'ORGANIZER' ? 'Teacher' : 'Student',
    primaryFocus: '',
    phone: '',
    website: '',
  };
}

function dataUrlSize(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not process profile picture.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Could not read compressed profile picture.'));
      reader.readAsDataURL(blob);
    }, type, quality);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    image.src = url;
  });
}

async function compressAvatar(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for your profile picture.');
  }

  const image = await loadImage(file);
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process profile picture.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const mimeType = 'image/webp';
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
  let smallest = '';

  for (const quality of qualities) {
    const candidate = await canvasToDataUrl(canvas, mimeType, quality);
    if (!smallest || dataUrlSize(candidate) < dataUrlSize(smallest)) {
      smallest = candidate;
    }
    if (dataUrlSize(candidate) <= AVATAR_TARGET_BYTES) return candidate;
  }

  if (smallest.length <= AVATAR_MAX_DATA_URL_LENGTH) return smallest;
  throw new Error('That image is too large to use as a profile picture.');
}

function localDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toCalendarDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeCalendarText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export default function Profile({ currentUser, onUserUpdated, onOpenEvent }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile>(() => fallbackProfile(currentUser));
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => localDateKey(new Date()));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [compressingAvatar, setCompressingAvatar] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    let cancelled = false;

    setProfile(fallbackProfile(currentUser));
    setSaved(false);
    setError('');

    if (!auth) return;

    fetchProfile(auth.token)
      .then(({ profile: savedProfile }) => {
        if (!cancelled) setProfile(savedProfile);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load profile.');
      });

    listMyRegistrations(auth.token)
      .then(({ registrations }) => {
        if (!cancelled) setRegistrations(registrations.filter(registration => registration.status !== 'CANCELLED'));
      })
      .catch(() => {
        if (!cancelled) setRegistrations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const updateField = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setError('');
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCompressingAvatar(true);
    setError('');

    try {
      updateField('avatar', await compressAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process profile picture.');
    } finally {
      setCompressingAvatar(false);
      event.target.value = '';
    }
  };

  const saveProfile = async () => {
    const normalizedProfile = {
      ...profile,
      displayName: profile.displayName.trim() || currentUser.name,
      location: profile.location.trim(),
      headline: profile.headline.trim(),
      primaryFocus: profile.primaryFocus.trim(),
      phone: profile.phone.trim(),
      website: profile.website.trim(),
    };

    const auth = getStoredAuth();
    if (!auth) return;

    try {
      const result = await updateProfile(auth.token, normalizedProfile);
      storeAuth({ token: auth.token, user: result.user });
      setProfile(result.profile);
      onUserUpdated(result.user);
      setSaved(true);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    }
  };

  const roleLabel = currentUser.role === 'ORGANIZER' ? 'Teacher account' : 'Student account';
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'D';
  const formatEventDate = (value: string | null | undefined) => {
    if (!value) return 'Date TBA';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  };
  const formatEventTime = (value: string | null | undefined) => {
    if (!value) return 'Time TBA';
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  };
  const calendarRegistrations = registrations.filter(registration => registration.event?.startsAt);
  const eventsByDate = calendarRegistrations.reduce((map, registration) => {
    const key = localDateKey(registration.event?.startsAt ?? '');
    if (!key) return map;
    const items = map.get(key) ?? [];
    items.push(registration);
    map.set(key, items);
    return map;
  }, new Map<string, RegistrationRecord[]>());
  const monthYearLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(calendarMonth);
  const firstMonthDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstMonthDay.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1)),
  ];
  const todayKey = localDateKey(new Date());
  const selectedDayEvents = selectedCalendarDate ? eventsByDate.get(selectedCalendarDate) ?? [] : [];
  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  const exportRegisteredEvents = () => {
    if (calendarRegistrations.length === 0) return;

    const timestamp = toCalendarDate(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Demetra//Registered Events//EN',
      'CALSCALE:GREGORIAN',
    ];

    calendarRegistrations.forEach((registration) => {
      const startsAt = registration.event?.startsAt;
      if (!startsAt) return;
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) return;
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      lines.push(
        'BEGIN:VEVENT',
        `UID:${registration.id}@demetra-events`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${toCalendarDate(start)}`,
        `DTEND:${toCalendarDate(end)}`,
        `SUMMARY:${escapeCalendarText(registration.event?.title ?? 'Demetra event')}`,
        `LOCATION:${escapeCalendarText(registration.event?.location ?? '')}`,
        `DESCRIPTION:${escapeCalendarText(registration.event?.description ?? '')}`,
        'END:VEVENT',
      );
    });

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'demetra-registered-events.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="profile-page page-transition-container">
      <section className="profile-hero">
        <div className="profile-hero-copy">
          <div className="profile-spark">✦</div>
          <div className="profile-eyebrow">Demetra Profile</div>
          <h1 className="profile-title">Edit your profile</h1>
          <p className="profile-subtitle">
            Keep the details other members see around your events, notes, and organization activity.
          </p>
        </div>

        <div className="profile-preview">
          <div className="profile-avatar profile-avatar--large">
            {profile.avatar ? <img src={profile.avatar} alt="" /> : <span>{initials}</span>}
          </div>
          <div>
            <div className="profile-preview-name">{profile.displayName || currentUser.name}</div>
            <div className="profile-preview-role">{roleLabel}</div>
            {profile.location && <div className="profile-preview-meta"><MapPin size={13} /> {profile.location}</div>}
          </div>
        </div>
      </section>

      <main className="profile-content">
        <section className="profile-card profile-card--media">
          <div className="profile-card-heading">
            <h2>Profile Picture</h2>
            <p>Use a clear portrait or a studio mark.</p>
          </div>
          <div className="profile-photo-row">
            <div className="profile-avatar profile-avatar--edit">
              {profile.avatar ? <img src={profile.avatar} alt="" /> : <UserRound size={42} />}
            </div>
            <div className="profile-photo-actions">
              <label className="profile-file-btn">
                <Camera size={16} />
                {compressingAvatar ? 'Processing...' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={uploadAvatar} disabled={compressingAvatar} />
              </label>
              {profile.avatar && (
                <button type="button" className="profile-secondary-btn" onClick={() => updateField('avatar', '')}>
                  <Trash2 size={15} />
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="profile-calendar">
            <div className="profile-calendar-header">
              <div className="profile-calendar-title">
                <CalendarDays size={17} />
                <span>{monthYearLabel}</span>
              </div>
              <div className="profile-calendar-actions">
                <button type="button" className="profile-icon-btn" onClick={() => moveCalendarMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="profile-icon-btn" onClick={() => moveCalendarMonth(1)} aria-label="Next month">
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="profile-icon-btn"
                  onClick={exportRegisteredEvents}
                  disabled={calendarRegistrations.length === 0}
                  aria-label="Export calendar"
                  title="Export calendar"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="profile-calendar-grid">
              {WEEKDAYS.map(day => (
                <div className="profile-calendar-weekday" key={day}>{day}</div>
              ))}
              {calendarCells.map((day, index) => {
                if (!day) return <div className="profile-calendar-empty" key={`empty-${index}`} />;
                const key = localDateKey(day);
                const hasEvents = eventsByDate.has(key);
                const isSelected = selectedCalendarDate === key;
                return (
                  <button
                    type="button"
                    className={`profile-calendar-day ${hasEvents ? 'has-events' : ''} ${isSelected ? 'selected' : ''} ${todayKey === key ? 'today' : ''}`}
                    key={key}
                    onClick={() => setSelectedCalendarDate(key)}
                  >
                    <span>{day.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div className="profile-calendar-events">
              {selectedDayEvents.length === 0 && <div className="profile-calendar-empty-state">No events on selected date.</div>}
              {selectedDayEvents.map(registration => (
                <button
                  type="button"
                  className="profile-calendar-event"
                  key={registration.id}
                  onClick={() => onOpenEvent(registration.eventId)}
                >
                  <span>{formatEventTime(registration.event?.startsAt)}</span>
                  <strong>{registration.event?.title ?? 'Event'}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-card-heading">
            <h2>Basic Information</h2>
            <p>Name is shown in the navbar and inside your account.</p>
          </div>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>Display name</label>
              <input value={profile.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
            </div>
            <div className="profile-field">
              <label>Headline</label>
              <input value={profile.headline} onChange={(e) => updateField('headline', e.target.value)} placeholder="Teacher, pianist, student..." />
            </div>
            <div className="profile-field">
              <label>Location</label>
              <input value={profile.location} onChange={(e) => updateField('location', e.target.value)} placeholder="Sofia, online, school studio..." />
            </div>
            <div className="profile-field">
              <label>{currentUser.role === 'ORGANIZER' ? 'Primary subject' : 'Primary interest'}</label>
              <input value={profile.primaryFocus} onChange={(e) => updateField('primaryFocus', e.target.value)} placeholder="Piano, choir, music theory..." />
            </div>
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-card-heading">
            <h2>About</h2>
            <p>Optional, but helpful for students, teachers, and event guests.</p>
          </div>
          <div className="profile-field">
            <label>Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => updateField('bio', e.target.value)}
              placeholder="Write a short introduction..."
              rows={6}
            />
          </div>
        </section>

        <section className="profile-card profile-card--contact">
          <div className="profile-card-heading">
            <h2>Contact</h2>
            <p>These fields are optional.</p>
          </div>
          <div className="profile-form-grid">
            <div className="profile-field">
              <label>Phone</label>
              <input value={profile.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+359..." />
            </div>
            <div className="profile-field">
              <label>Website</label>
              <div className="profile-input-icon">
                <Globe size={15} />
                <input value={profile.website} onChange={(e) => updateField('website', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>
        </section>

        <section className="profile-card profile-card--events">
          <div className="profile-card-heading">
            <h2>My Events</h2>
            <p>Your confirmed places and active waitlist entries.</p>
          </div>
          <div className="profile-event-list">
            {registrations.length === 0 && <div className="profile-event-empty">No active event registrations.</div>}
            {registrations.map((registration) => (
              <button
                type="button"
                className="profile-event-row"
                key={registration.id}
                onClick={() => onOpenEvent(registration.eventId)}
              >
                <div>
                  <div className="profile-event-title">{registration.event?.title ?? 'Event'}</div>
                  <div className="profile-event-meta">
                    {formatEventDate(registration.event?.startsAt)}
                    {registration.event?.location ? ` / ${registration.event.location}` : ''}
                  </div>
                </div>
                <div className={`profile-event-status ${registration.status === 'WAITLISTED' ? 'waitlisted' : ''}`}>
                  {registration.status === 'WAITLISTED'
                    ? `Waitlist #${registration.waitlistPosition ?? '-'}`
                    : 'Confirmed'}
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="profile-save-bar">
          <button type="button" className="profile-save-btn" onClick={saveProfile}>
            <Save size={16} />
            Save profile
          </button>
          {saved && <span className="profile-saved">Saved</span>}
          {error && <span className="profile-error">{error}</span>}
        </div>
      </main>
    </div>
  );
}
