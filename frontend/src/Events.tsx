﻿import { useEffect, useState } from 'react';
import { getStoredAuth, listEvents, registerForEvent } from './api';

interface EventsProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard') => void;
}

interface Event {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  venue: string;
  description: string;
  longDescription: string;
  capacity: number;
  registered: number;
  price: string;
  status: 'open' | 'almost-full' | 'full' | 'past';
  gradient: string;
  emoji: string;
  organizer: string;
  organizerType: string;
  program: { time: string; piece: string; performer: string }[];
  venueLayout: 'concert-hall' | 'amphitheater' | 'classroom' | 'outdoor';
  tags: string[];
}

const EVENT_VISUALS = [
  { gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 60%, #162a43 100%)', emoji: '♪', layout: 'concert-hall' as const },
  { gradient: 'linear-gradient(135deg, #1c2b1a 0%, #2d4a2a 60%, #1a3a18 100%)', emoji: '♬', layout: 'outdoor' as const },
  { gradient: 'linear-gradient(135deg, #2a1a1a 0%, #4a2020 60%, #3a1010 100%)', emoji: '♩', layout: 'classroom' as const },
  { gradient: 'linear-gradient(135deg, #1a1a2a 0%, #2a2050 60%, #1a1540 100%)', emoji: '♫', layout: 'concert-hall' as const },
];

function titleCaseEnum(value: string | undefined) {
  if (!value) return 'Organizer';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  if (!value) return 'Date TBA';
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return 'Time TBA';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function mapApiEvent(event: import('./api').EventRecord, index: number): Event {
  const visual = EVENT_VISUALS[index % EVENT_VISUALS.length]!;
  const registered = event.registered ?? 0;
  const capacity = Math.max(event.capacity, 1);
  const startsAt = event.startsAt ? new Date(event.startsAt) : null;
  const isPast = startsAt ? startsAt.getTime() < Date.now() : false;
  const isFull = registered >= capacity;
  const fill = registered / capacity;
  const category = event.category ?? 'Event';
  const organizer = event.organization?.name ?? event.organizer?.name ?? 'Demetra Organizer';
  const description = event.description || 'Event details will be announced soon.';

  return {
    id: event.id,
    title: event.title,
    category,
    date: formatDate(event.startsAt),
    time: formatTime(event.startsAt),
    location: event.location ?? 'Location TBA',
    venue: event.organization?.name ?? event.location ?? 'Venue TBA',
    description,
    longDescription: description,
    capacity,
    registered,
    price: 'Free',
    status: isPast ? 'past' : isFull ? 'full' : fill > 0.85 ? 'almost-full' : 'open',
    gradient: visual.gradient,
    emoji: visual.emoji,
    organizer,
    organizerType: titleCaseEnum(event.organization?.kind),
    program: [],
    venueLayout: visual.layout,
    tags: [category, event.status],
  };
}

// Event venue layout SVG renderers
function ConcertHallLayout({ capacity, registered }: { capacity: number; registered: number }) {
  const rows = [
    { id: 'A', seats: 12, y: 80 },
    { id: 'B', seats: 14, y: 118 },
    { id: 'C', seats: 16, y: 156 },
    { id: 'D', seats: 18, y: 194 },
    { id: 'E', seats: 20, y: 232 },
    { id: 'F', seats: 20, y: 270 },
    { id: 'G', seats: 22, y: 308 },
    { id: 'H', seats: 22, y: 346 },
  ];
  const totalSeats = rows.reduce((s, r) => s + r.seats, 0);
  const takenFraction = registered / capacity;
  const takenSeats = Math.round(totalSeats * takenFraction);
  let seatCounter = 0;

  return (
    <svg viewBox="0 0 440 420" style={{ width: '100%', maxWidth: 440 }}>
      {/* Stage */}
      <ellipse cx="220" cy="36" rx="100" ry="26" fill="rgb(167,154,14)" opacity="0.15" />
      <ellipse cx="220" cy="36" rx="100" ry="26" fill="none" stroke="rgb(167,154,14)" strokeWidth="1.5" />
      <text x="220" y="40" textAnchor="middle" fill="rgb(167,154,14)" fontSize="11" fontFamily="Cinzel, serif" letterSpacing="2">STAGE</text>

      {rows.map((row) => {
        const startX = 220 - (row.seats * 20) / 2 + 10;
        return row.seats > 0 ? (
          <g key={row.id}>
            <text x="18" y={row.y + 6} textAnchor="middle" fill="#5c6e85" fontSize="9" fontFamily="Inter, sans-serif">{row.id}</text>
            {Array.from({ length: row.seats }).map((_, si) => {
              const taken = seatCounter++ < takenSeats;
              return (
                <rect
                  key={si}
                  x={startX + si * 20}
                  y={row.y - 7}
                  width={14}
                  height={12}
                  rx={2}
                  fill={taken ? 'rgba(167,154,14,0.35)' : 'rgba(22,42,67,0.07)'}
                  stroke={taken ? 'rgb(167,154,14)' : 'rgba(22,42,67,0.18)'}
                  strokeWidth={0.8}
                />
              );
            })}
          </g>
        ) : null;
      })}

      {/* Legend */}
      <rect x="120" y="384" width="12" height="10" rx="2" fill="rgba(167,154,14,0.35)" stroke="rgb(167,154,14)" strokeWidth="0.8" />
      <text x="136" y="393" fill="#5c6e85" fontSize="10" fontFamily="Inter, sans-serif">Registered</text>
      <rect x="210" y="384" width="12" height="10" rx="2" fill="rgba(22,42,67,0.07)" stroke="rgba(22,42,67,0.18)" strokeWidth="0.8" />
      <text x="226" y="393" fill="#5c6e85" fontSize="10" fontFamily="Inter, sans-serif">Available</text>
    </svg>
  );
}

function OutdoorLayout({ capacity, registered }: { capacity: number; registered: number }) {
  const sections = [
    { label: 'Front Lawn', seats: 40, x: 160, y: 120, w: 120, h: 60 },
    { label: 'Left Wing', seats: 30, x: 60, y: 180, w: 90, h: 80 },
    { label: 'Center', seats: 50, x: 160, y: 190, w: 120, h: 80 },
    { label: 'Right Wing', seats: 30, x: 290, y: 180, w: 90, h: 80 },
    { label: 'Back Lawn', seats: 0, x: 120, y: 280, w: 200, h: 60 },
  ];
  const takenFrac = registered / capacity;

  return (
    <svg viewBox="0 0 440 400" style={{ width: '100%', maxWidth: 440 }}>
      {/* Stage */}
      <rect x="140" y="30" width="160" height="60" rx="8" fill="rgb(167,154,14)" opacity="0.15" />
      <rect x="140" y="30" width="160" height="60" rx="8" fill="none" stroke="rgb(167,154,14)" strokeWidth="1.5" />
      <text x="220" y="64" textAnchor="middle" fill="rgb(167,154,14)" fontSize="11" fontFamily="Cinzel, serif" letterSpacing="2">STAGE</text>

      {/* Trees decoration */}
      {[40, 380].map((tx) => (
        <g key={tx}>
          <circle cx={tx} cy={120} r={18} fill="rgba(45,74,42,0.3)" />
          <circle cx={tx} cy={100} r={14} fill="rgba(45,74,42,0.2)" />
          <rect x={tx - 3} y={130} width={6} height={16} fill="rgba(80,50,30,0.3)" />
        </g>
      ))}

      {sections.map((sec) => {
        if (sec.seats === 0) return null;
        const secTaken = Math.round(sec.seats * takenFrac);
        const pct = (secTaken / sec.seats) * 100;
        return (
          <g key={sec.label}>
            <rect x={sec.x} y={sec.y} width={sec.w} height={sec.h} rx="6"
              fill="rgba(22,42,67,0.04)" stroke="rgba(22,42,67,0.15)" strokeWidth="1" />
            <rect x={sec.x} y={sec.y} width={sec.w * (pct / 100)} height={sec.h} rx="6"
              fill="rgba(167,154,14,0.18)" />
            <text x={sec.x + sec.w / 2} y={sec.y + sec.h / 2 - 6} textAnchor="middle"
              fill="#162a43" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="600">{sec.label}</text>
            <text x={sec.x + sec.w / 2} y={sec.y + sec.h / 2 + 8} textAnchor="middle"
              fill="#5c6e85" fontSize="9" fontFamily="Inter, sans-serif">{secTaken}/{sec.seats}</text>
          </g>
        );
      })}

      {/* Back area */}
      <rect x="120" y="280" width="200" height="60" rx="6"
        fill="rgba(22,42,67,0.04)" stroke="rgba(22,42,67,0.12)" strokeWidth="1" strokeDasharray="4 3" />
      <text x="220" y="315" textAnchor="middle" fill="#a0aec0" fontSize="10" fontFamily="Inter, sans-serif">Standing Area (free)</text>
    </svg>
  );
}

function ClassroomLayout({ capacity, registered }: { capacity: number; registered: number }) {
  const rows = 4;
  const cols = Math.ceil(capacity / rows);
  const takenFrac = registered / capacity;
  const takenCount = Math.round(capacity * takenFrac);

  return (
    <svg viewBox="0 0 440 360" style={{ width: '100%', maxWidth: 440 }}>
      {/* Board */}
      <rect x="80" y="28" width="280" height="44" rx="4" fill="rgba(22,42,67,0.08)" stroke="rgba(22,42,67,0.2)" strokeWidth="1.5" />
      <text x="220" y="55" textAnchor="middle" fill="#162a43" fontSize="11" fontFamily="Cinzel, serif" letterSpacing="1">PRESENTER</text>

      {/* Seats */}
      {Array.from({ length: rows }).map((_, ri) => (
        Array.from({ length: cols }).map((_, ci) => {
          const seatIdx = ri * cols + ci;
          const taken = seatIdx < takenCount;
          const x = 60 + ci * (320 / cols);
          const y = 110 + ri * 56;
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={x} y={y} width="28" height="22" rx="3"
                fill={taken ? 'rgba(167,154,14,0.3)' : 'rgba(22,42,67,0.06)'}
                stroke={taken ? 'rgb(167,154,14)' : 'rgba(22,42,67,0.18)'} strokeWidth="0.8" />
              <rect x={x + 4} y={y + 22} width="20" height="10" rx="2"
                fill={taken ? 'rgba(167,154,14,0.2)' : 'rgba(22,42,67,0.04)'}
                stroke={taken ? 'rgba(167,154,14,0.5)' : 'rgba(22,42,67,0.12)'} strokeWidth="0.6" />
            </g>
          );
        })
      ))}
    </svg>
  );
}

// в”Ђв”Ђ Event Detail Page в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function EventDetail({ event, onBack, onNavigate, onRegistered }: { event: Event; onBack: () => void; onNavigate: EventsProps['onNavigate']; onRegistered: (eventId: string, status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED') => void }) {
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'waitlist'>('idle');
  const [joinError, setJoinError] = useState('');
  const isFull = event.registered >= event.capacity;
  const isPast = event.status === 'past';
  const pct = Math.round((event.registered / event.capacity) * 100);

  const handleJoin = async () => {
    const auth = getStoredAuth();
    if (!auth) {
      onNavigate('login');
      return;
    }

    setJoinState('joining');
    setJoinError('');
    try {
      const { registration } = await registerForEvent(auth.token, event.id);
      setJoinState(registration.status === 'WAITLISTED' ? 'waitlist' : 'joined');
      onRegistered(event.id, registration.status);
    } catch (err) {
      setJoinState('idle');
      setJoinError(err instanceof Error ? err.message : 'Could not register for this event.');
    }
  };
  const renderLayout = () => {
    switch (event.venueLayout) {
      case 'concert-hall': return <ConcertHallLayout capacity={event.capacity} registered={event.registered} />;
      case 'outdoor': return <OutdoorLayout capacity={event.capacity} registered={event.registered} />;
      case 'classroom': return <ClassroomLayout capacity={event.capacity} registered={event.registered} />;
      default: return <ConcertHallLayout capacity={event.capacity} registered={event.registered} />;
    }
  };

  return (
    <div className="event-detail-page page-transition-container">
      <div className="event-detail-hero" style={{ background: event.gradient }}>
        <button className="detail-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All events
        </button>
        <div className="event-detail-hero-content">
          <div className="event-detail-tag">{event.category}</div>
          <h1 className="event-detail-title">{event.title}</h1>
          <div className="event-detail-meta-row">
            <span>Date: {event.date} / {event.time}</span>
            <span>Location: {event.location}</span>
            <span>Venue: {event.venue}</span>
          </div>
        </div>
        <div className="event-detail-hero-emoji">{event.emoji}</div>
      </div>

      {/* Body */}
      <div className="event-detail-body">
        <div className="event-detail-main">

          {/* Description */}
          <section className="event-detail-section">
            <h2 className="event-section-title">About this event</h2>
            <p className="event-detail-desc">{event.longDescription}</p>
            <div className="event-tags-row">
              {event.tags.map(t => (
                <span key={t} className="event-tag-pill">{t}</span>
              ))}
            </div>
          </section>

          {/* Programme */}
          <section className="event-detail-section">
            <h2 className="event-section-title">Programme</h2>
            <div className="programme-list">
              {event.program.map((item, i) => (
                item.performer === '' ? (
                  <div key={i} className="programme-intermission">Intermission</div>
                ) : (
                  <div key={i} className="programme-item">
                    <div className="programme-time">{item.time}</div>
                    <div className="programme-details">
                      <div className="programme-piece">{item.piece}</div>
                      {item.performer && <div className="programme-performer">{item.performer}</div>}
                    </div>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* Venue Layout */}
          <section className="event-detail-section">
            <h2 className="event-section-title">Venue & Seating</h2>
            <div className="venue-layout-card">
              <div className="venue-layout-header">
                <div>
                  <div className="venue-name">{event.venue}</div>
                  <div className="venue-address">{event.location}</div>
                </div>
                <div className="venue-capacity-badge">
                  {event.registered} / {event.capacity} seats
                </div>
              </div>
              <div className="venue-svg-wrapper">
                {renderLayout()}
              </div>
              <div className="capacity-bar-wrapper">
                <div className="capacity-bar-track">
                  <div
                    className="capacity-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct > 90 ? '#e53e3e' : pct > 70 ? 'rgb(167,154,14)' : '#38a169'
                    }}
                  />
                </div>
                <span className="capacity-pct-label">{pct}% filled</span>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="event-detail-sidebar">
          {/* Organizer card */}
          <div className="sidebar-card">
            <div className="sidebar-card-label">Organizer</div>
            <div className="sidebar-organizer-name">{event.organizer}</div>
            <div className="sidebar-organizer-type">{event.organizerType}</div>
          </div>

          {/* Ticket card */}
          <div className="sidebar-card sidebar-ticket-card">
            <div className="sidebar-card-label">Admission</div>
            <div className="sidebar-price">{event.price}</div>

            <div className="sidebar-capacity-info">
              <div className="sidebar-cap-row">
                <span>Registered</span>
                <span className="sidebar-cap-num">{event.registered}</span>
              </div>
              <div className="sidebar-cap-row">
                <span>Capacity</span>
                <span className="sidebar-cap-num">{event.capacity}</span>
              </div>
              <div className="sidebar-cap-row">
                <span>Available</span>
                <span className="sidebar-cap-num" style={{ color: isFull ? '#e53e3e' : '#38a169' }}>
                  {isFull ? 0 : event.capacity - event.registered}
                </span>
              </div>
            </div>

            {isPast ? (
              <button className="join-btn join-btn--past" disabled>Event has passed</button>
            ) : joinState === 'joined' ? (
              <div className="join-success">
                <span>Done</span> You're registered!
              </div>
            ) : joinState === 'waitlist' ? (
              <div className="join-success join-success--waitlist">
                <span>Waitlist</span> Added to waitlist
              </div>
            ) : (
              <button
                className={`join-btn ${isFull ? 'join-btn--waitlist' : ''} ${joinState === 'joining' ? 'join-btn--loading' : ''}`}
                onClick={handleJoin}
                disabled={joinState === 'joining'}
              >
                {joinState === 'joining' ? (
                  <span className="spinner" />
                ) : isFull ? (
                  'Join Waitlist'
                ) : (
                  'Register for Event'
                )}
              </button>
            )}

            {joinError && <p className="join-waitlist-note" style={{ color: '#e53e3e' }}>{joinError}</p>}

            {isFull && joinState === 'idle' && (
              <p className="join-waitlist-note">This event is full. You'll be notified if a spot opens.</p>
            )}
          </div>

          {/* Date card */}
          <div className="sidebar-card">
            <div className="sidebar-card-label">Date & Time</div>
            <div className="sidebar-date-big">{event.date}</div>
            <div className="sidebar-time">{event.time}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// в”Ђв”Ђ Events List Page в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

export default function Events({ onNavigate }: EventsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [events, setEvents] = useState<Event[]>([
    {
      id: 'mockup-event',
      title: 'Mockup Event',
      category: 'Mockup',
      date: '2024-01-01',
      time: '12:00',
      location: 'Mockup Location',
      venue: 'Mockup Venue',
      description: 'This is a mockup event.',
      longDescription: 'This is a long description of the mockup event.',
      capacity: 100,
      registered: 50,
      price: 'Free',
      status: 'open',
      gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 60%, #162a43 100%)',
      emoji: '♪',
      organizer: 'Mockup Organizer',
      organizerType: 'Mockup',
      program: [],
      venueLayout: 'concert-hall',
      tags: ['Mockup'],
    },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEvents()
      .then(({ events }) => {
        if (cancelled) return;
        setEvents(events.map(mapApiEvent));
        setEventsError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setEventsError(err instanceof Error ? err.message : 'Could not load events.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = ['All', ...Array.from(new Set(events.map(event => event.category))).sort()];

  const filtered = events.filter((ev) => {
    if (activeTab === 'upcoming' && ev.status === 'past') return false;
    if (activeTab === 'past' && ev.status !== 'past') return false;
    if (categoryFilter !== 'All' && ev.category !== categoryFilter) return false;
    if (search && !ev.title.toLowerCase().includes(search.toLowerCase()) &&
        !ev.organizer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upcomingCount = events.filter(e => e.status !== 'past').length;
  const pastCount = events.filter(e => e.status === 'past').length;
  const selectedEvent = selectedEventId ? events.find(event => event.id === selectedEventId) ?? null : null;

  const handleRegistered = (eventId: string, status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED') => {
    if (status !== 'CONFIRMED') return;
    setEvents(prev => prev.map(event => event.id === eventId ? { ...event, registered: Math.min(event.capacity, event.registered + 1) } : event));
  };

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={() => setSelectedEventId(null)} onNavigate={onNavigate} onRegistered={handleRegistered} />;
  }
  return (
    <div className="events-page-container page-transition-container">
      <div className="events-content-wrapper">
        {/* Header */}
        <header className="events-header">
          <div className="events-breadcrumbs">Demetra / Events</div>
          <h1 className="events-main-title">Musical Events</h1>
        </header>

        {/* Controls */}
        <div className="events-controls-row">
          <div className="events-tabs">
            {([['all', 'All', events.length], ['upcoming', 'Upcoming', upcomingCount], ['past', 'Past', pastCount]] as const).map(
              ([key, label, count]) => (
                <button
                  key={key}
                  className={`event-tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                  <span className="tab-count">{count}</span>
                </button>
              )
            )}
          </div>

          <div className="events-filters">
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="#a0aec0" strokeWidth="1.4" />
                <path d="M9.5 9.5L12 12" stroke="#a0aec0" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="events-grid">
          {filtered.length === 0 ? (
            <div className="no-events-state">
              <div className="no-events-mark">No results</div>
              {isLoading ? 'Loading events...' : eventsError || 'No events match your search.'}
            </div>
          ) : (
            filtered.map(ev => {
              const pct = Math.round((ev.registered / ev.capacity) * 100);
              return (
                <article
                  key={ev.id}
                  className={`event-card ${ev.status === 'past' ? 'event-card--past' : ''}`}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    className="event-card-image"
                    style={{ background: ev.gradient }}
                  >
                    <span className="event-category-tag">{ev.category}</span>
                    <span className={`event-status-tag`}>
                      <span className={`status-dot ${ev.status === 'past' ? 'past' : ev.status === 'full' ? 'past' : ev.status === 'almost-full' ? '' : ''}`} />
                      {ev.status === 'open' ? 'Open'
                        : ev.status === 'almost-full' ? 'Almost full'
                        : ev.status === 'full' ? 'Full'
                        : 'Past'}
                    </span>
                    <div className="event-card-emoji">{ev.emoji}</div>
                  </div>
                  <div className="event-card-body">
                    <div className="event-date">{ev.date} / {ev.time}</div>
                    <h3 className="event-title">{ev.title}</h3>
                    <div className="event-location">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1C4.34 1 3 2.34 3 4c0 2.25 3 7 3 7s3-4.75 3-7c0-1.66-1.34-3-3-3Z" fill="#5c6e85" />
                        <circle cx="6" cy="4" r="1" fill="#fdfbf7" />
                      </svg>
                      {ev.location}
                    </div>
                    <div className="event-card-footer">
                      <div className="event-progress-wrapper">
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${pct}%`,
                              background: pct > 90 ? '#e53e3e' : 'rgb(167,154,14)'
                            }}
                          />
                        </div>
                        <div className="progress-text">{ev.registered} / {ev.capacity} registered</div>
                      </div>
                      <div className="event-price">{ev.price}</div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
