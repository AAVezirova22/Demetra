import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  cancelEventRegistration,
  getStoredAuth,
  listEvents,
  listMyRegistrations,
  registerForEvent,
  type EventRecord,
  type RegistrationRecord,
  type RegistrationStatus,
  type StageSeat,
} from '../../shared/api/api';
import './Events.css';

interface EventsProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard') => void;
  openEventId?: string;
  onEventOpened?: () => void;
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
  priceAmount: number;
  vipSeatPrice: number;
  activeSeats: { seatLabel: string | null; seatType: string | null }[];
  seatingMap: EventRecord['seatingMap'];
  status: 'open' | 'almost-full' | 'full' | 'past';
  gradient: string;
  emoji: string;
  organizer: string;
  organizerType: string;
  program: { time: string; piece: string; performer: string }[];
  venueLayout: 'concert-hall' | 'amphitheater' | 'classroom' | 'outdoor';
  tags: string[];
}

type SelectableSeat = {
  label: string;
  type: 'STANDARD' | 'VIP';
  taken: boolean;
  seat: StageSeat;
};

const EVENT_VISUALS = [
  { gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 60%, #162a43 100%)', emoji: 'EV', layout: 'concert-hall' as const },
  { gradient: 'linear-gradient(135deg, #1c2b1a 0%, #2d4a2a 60%, #1a3a18 100%)', emoji: 'ST', layout: 'outdoor' as const },
  { gradient: 'linear-gradient(135deg, #2a1a1a 0%, #4a2020 60%, #3a1010 100%)', emoji: 'CL', layout: 'classroom' as const },
  { gradient: 'linear-gradient(135deg, #1a1a2a 0%, #2a2050 60%, #1a1540 100%)', emoji: 'MU', layout: 'concert-hall' as const },
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

function formatMoney(value: number) {
  return value > 0 ? `$${value.toFixed(2)}` : 'Free';
}

function mapApiEvent(event: EventRecord, index: number): Event {
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
    price: formatMoney(event.price ?? 0),
    priceAmount: event.price ?? 0,
    vipSeatPrice: event.vipSeatPrice ?? event.price ?? 0,
    activeSeats: event.activeSeats ?? [],
    seatingMap: event.seatingMap ?? null,
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
    <svg viewBox="0 0 440 420" style={{ width: '100%', maxWidth: 440 }} className="venue-chart-svg">
      {/* Stage */}
      <ellipse cx="220" cy="36" rx="100" ry="26" fill="rgb(167,154,14)" opacity="0.15" />
      <ellipse cx="220" cy="36" rx="100" ry="26" fill="none" stroke="rgb(167,154,14)" strokeWidth="1.5" />
      <text x="220" y="40" textAnchor="middle" fill="rgb(167,154,14)" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="800" letterSpacing="0">STAGE</text>

      {rows.map((row) => {
        const startX = 220 - (row.seats * 20) / 2 + 10;
        return row.seats > 0 ? (
          <g key={row.id}>
            <text x="18" y={row.y + 5} textAnchor="middle" fill="#5c6e85" fontSize="7" fontFamily="Inter, sans-serif">{row.id}</text>
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
      <text x="136" y="392" fill="#5c6e85" fontSize="8" fontFamily="Inter, sans-serif">Registered</text>
      <rect x="210" y="384" width="12" height="10" rx="2" fill="rgba(22,42,67,0.07)" stroke="rgba(22,42,67,0.18)" strokeWidth="0.8" />
      <text x="226" y="392" fill="#5c6e85" fontSize="8" fontFamily="Inter, sans-serif">Available</text>
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
    <svg viewBox="0 0 440 400" style={{ width: '100%', maxWidth: 440 }} className="venue-chart-svg">
      {/* Stage */}
      <rect x="140" y="30" width="160" height="60" rx="8" fill="rgb(167,154,14)" opacity="0.15" />
      <rect x="140" y="30" width="160" height="60" rx="8" fill="none" stroke="rgb(167,154,14)" strokeWidth="1.5" />
      <text x="220" y="64" textAnchor="middle" fill="rgb(167,154,14)" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="800" letterSpacing="0">STAGE</text>

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
            <text x={sec.x + sec.w / 2} y={sec.y + sec.h / 2 - 5} textAnchor="middle"
              fill="#162a43" fontSize="7" fontFamily="Inter, sans-serif" fontWeight="700">{sec.label}</text>
            <text x={sec.x + sec.w / 2} y={sec.y + sec.h / 2 + 7} textAnchor="middle"
              fill="#5c6e85" fontSize="7" fontFamily="Inter, sans-serif">{secTaken}/{sec.seats}</text>
          </g>
        );
      })}

      {/* Back area */}
      <rect x="120" y="280" width="200" height="60" rx="6"
        fill="rgba(22,42,67,0.04)" stroke="rgba(22,42,67,0.12)" strokeWidth="1" strokeDasharray="4 3" />
      <text x="220" y="314" textAnchor="middle" fill="#a0aec0" fontSize="7" fontFamily="Inter, sans-serif">Standing area</text>
    </svg>
  );
}

function ClassroomLayout({ capacity, registered }: { capacity: number; registered: number }) {
  const rows = 5;
  const cols = 12;
  const visualSeats = rows * cols;
  const takenFrac = registered / capacity;
  const takenCount = Math.round(visualSeats * takenFrac);

  return (
    <svg viewBox="0 0 440 360" style={{ width: '100%', maxWidth: 440 }} className="venue-chart-svg">
      {/* Board */}
      <rect x="80" y="28" width="280" height="44" rx="4" fill="rgba(22,42,67,0.08)" stroke="rgba(22,42,67,0.2)" strokeWidth="1.5" />
      <text x="220" y="54" textAnchor="middle" fill="#162a43" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="800" letterSpacing="0">PRESENTER</text>

      {/* Seats */}
      {Array.from({ length: rows }).map((_, ri) => (
        Array.from({ length: cols }).map((_, ci) => {
          const seatIdx = ri * cols + ci;
          const taken = seatIdx < takenCount;
          const x = 50 + ci * 28;
          const y = 104 + ri * 42;
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={x} y={y} width="18" height="15" rx="2"
                fill={taken ? 'rgba(167,154,14,0.3)' : 'rgba(22,42,67,0.06)'}
                stroke={taken ? 'rgb(167,154,14)' : 'rgba(22,42,67,0.18)'} strokeWidth="0.8" />
              <rect x={x + 3} y={y + 15} width="12" height="7" rx="1.5"
                fill={taken ? 'rgba(167,154,14,0.2)' : 'rgba(22,42,67,0.04)'}
                stroke={taken ? 'rgba(167,154,14,0.5)' : 'rgba(22,42,67,0.12)'} strokeWidth="0.6" />
            </g>
          );
        })
      ))}
    </svg>
  );
}

// Event Detail Page

function EventDetail({ event, registration, onBack, onNavigate, onRegistered, onCancelled }: {
  event: Event;
  registration: RegistrationRecord | null;
  onBack: () => void;
  onNavigate: EventsProps['onNavigate'];
  onRegistered: (eventId: string, registration: RegistrationRecord) => void;
  onCancelled: (eventId: string, previousStatus: RegistrationStatus, promoted: boolean, registration: RegistrationRecord | null) => void;
}) {
  const registrationStatus = registration?.status ?? null;
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'waitlist' | 'cancelling'>(
    registrationStatus === 'CONFIRMED' ? 'joined' : registrationStatus === 'WAITLISTED' ? 'waitlist' : 'idle'
  );
  const [joinError, setJoinError] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('');
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const isFull = event.registered >= event.capacity;
  const isPast = event.status === 'past';
  const pct = Math.round((event.registered / event.capacity) * 100);
  const takenSeats = new Set(event.activeSeats.map(seat => seat.seatLabel).filter(Boolean) as string[]);
  const selectableSeats: SelectableSeat[] = event.seatingMap
    ? event.seatingMap.seats
        .filter(seat => seat.status !== 'blocked')
        .map(seat => {
          const label = `${String.fromCharCode(65 + seat.row)}${seat.col + 1}`;
          return {
            label,
            type: seat.status === 'vip' ? 'VIP' : 'STANDARD',
            taken: takenSeats.has(label),
            seat,
          };
        })
    : [];
  const selectedSeatType = selectableSeats.find(seat => seat.label === selectedSeat)?.type ?? 'STANDARD';
  const selectedSeatPrice = selectedSeatType === 'VIP' ? event.vipSeatPrice : event.priceAmount;
  const seatMapWidth = event.seatingMap ? event.seatingMap.cols * 30 + 58 : 0;
  const seatMapHeight = event.seatingMap ? event.seatingMap.rows * 28 + 42 : 0;

  useEffect(() => {
    if (joinState === 'joining' || joinState === 'cancelling') return;
    setJoinState(registrationStatus === 'CONFIRMED' ? 'joined' : registrationStatus === 'WAITLISTED' ? 'waitlist' : 'idle');
  }, [registrationStatus]);

  useEffect(() => {
    if (registration?.seatLabel) setSelectedSeat(registration.seatLabel);
  }, [registration?.seatLabel]);

  const handleJoin = async () => {
    const auth = getStoredAuth();
    if (!auth) {
      onNavigate('login');
      return;
    }
    if (!isFull && event.seatingMap && !selectedSeat) {
      setJoinError('Choose a seat before registering.');
      return;
    }

    setJoinState('joining');
    setJoinError('');
    try {
      const { registration } = await registerForEvent(auth.token, event.id, selectedSeat || undefined);
      setJoinState(registration.status === 'WAITLISTED' ? 'waitlist' : 'joined');
      onRegistered(event.id, registration);
      setSeatModalOpen(false);
    } catch (err) {
      setJoinState('idle');
      setJoinError(err instanceof Error ? err.message : 'Could not register for this event.');
    }
  };

  const openSeatModal = () => {
    const auth = getStoredAuth();
    if (!auth) {
      onNavigate('login');
      return;
    }
    setJoinError('');
    setSeatModalOpen(true);
  };

  const handleCancel = async () => {
    const auth = getStoredAuth();
    if (!auth || !registrationStatus) return;

    setJoinState('cancelling');
    setJoinError('');
    try {
      const { promoted } = await cancelEventRegistration(auth.token, event.id);
      onCancelled(event.id, registrationStatus, Boolean(promoted), registration);
      setJoinState('idle');
    } catch (err) {
      setJoinState(registrationStatus === 'CONFIRMED' ? 'joined' : 'waitlist');
      setJoinError(err instanceof Error ? err.message : 'Could not cancel your registration.');
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
            {event.vipSeatPrice !== event.priceAmount && (
              <div className="sidebar-price-sub">VIP {formatMoney(event.vipSeatPrice)}</div>
            )}

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
              <>
                <div className="join-success">
                  <span>Done</span> {registration?.seatLabel ? `Seat ${registration.seatLabel}` : "You're registered!"}
                </div>
                <button className="join-btn join-btn--waitlist" onClick={handleCancel} style={{ marginTop: 10 }}>Cancel registration</button>
              </>
            ) : joinState === 'waitlist' ? (
              <>
                <div className="join-success join-success--waitlist">
                  <span>Waitlist</span> Position #{registration?.waitlistPosition ?? '-'}
                </div>
                <p className="join-waitlist-note">Your position updates automatically when places open.</p>
                <button className="join-btn join-btn--waitlist" onClick={handleCancel} style={{ marginTop: 10 }}>Leave waitlist</button>
              </>
            ) : joinState === 'cancelling' ? (
              <button className="join-btn join-btn--loading" disabled><span className="spinner" /> Cancelling...</button>
            ) : (
              <button
                className={`join-btn ${isFull ? 'join-btn--waitlist' : ''} ${joinState === 'joining' ? 'join-btn--loading' : ''}`}
                onClick={event.seatingMap && !isFull ? openSeatModal : handleJoin}
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

      {seatModalOpen && event.seatingMap && (
        <div className="seat-modal-backdrop" onClick={() => setSeatModalOpen(false)}>
          <div className="seat-modal" role="dialog" aria-modal="true" aria-label="Choose a seat" onClick={(modalEvent) => modalEvent.stopPropagation()}>
            <div className="seat-modal-header">
              <div>
                <div className="sidebar-card-label">Choose seat</div>
                <h2>{event.title}</h2>
              </div>
              <button type="button" className="modal-close seat-modal-close" onClick={() => setSeatModalOpen(false)}>x</button>
            </div>
            <div className="seat-modal-summary">
              <span>{selectedSeat ? `Selected ${selectedSeat}` : 'Select an available seat'}</span>
              <b>{selectedSeat ? formatMoney(selectedSeatPrice) : event.price}</b>
            </div>
            <div className="seat-modal-map-wrap">
              <svg className="seat-picker-map seat-picker-map--modal" viewBox={`0 0 ${seatMapWidth} ${seatMapHeight}`}>
                {event.seatingMap && Array.from({ length: event.seatingMap.cols }, (_, col) => (
                  <text key={`col-${col}`} className="seat-map-axis-label" x={50 + col * 30} y="16" textAnchor="middle">{col + 1}</text>
                ))}
                {event.seatingMap && Array.from({ length: event.seatingMap.rows }, (_, row) => (
                  <text key={`row-${row}`} className="seat-map-axis-label" x="18" y={39 + row * 28} textAnchor="middle">{String.fromCharCode(65 + row)}</text>
                ))}
                {selectableSeats.map((seat) => (
                  <g key={seat.label}>
                    <rect
                      x={39 + seat.seat.col * 30}
                      y={26 + seat.seat.row * 28}
                      width="22"
                      height="18"
                      rx="4"
                      className={`seat-map-rect ${seat.type === 'VIP' ? 'vip' : ''} ${seat.taken ? 'taken' : ''} ${selectedSeat === seat.label ? 'selected' : ''}`}
                      onClick={() => {
                        if (!seat.taken) {
                          setSelectedSeat(seat.label);
                        }
                      }}
                    />
                  </g>
                ))}
              </svg>
            </div>
            <div className="seat-modal-legend">
              <span><i className="seat-legend-box" /> Standard</span>
              <span><i className="seat-legend-box vip" /> VIP</span>
              <span><i className="seat-legend-box taken" /> Taken</span>
            </div>
            {joinError && <p className="join-waitlist-note" style={{ color: '#e53e3e' }}>{joinError}</p>}
            <div className="seat-modal-actions">
              <button type="button" className="join-btn join-btn--waitlist" onClick={() => setSeatModalOpen(false)}>Cancel</button>
              <button type="button" className="join-btn" onClick={handleJoin} disabled={!selectedSeat || joinState === 'joining'}>
                {joinState === 'joining' ? <span className="spinner" /> : `Register ${selectedSeat ? `for ${selectedSeat}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Events List Page

export default function Events({ onNavigate, openEventId = '', onEventOpened }: EventsProps) {
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
      priceAmount: 0,
      vipSeatPrice: 0,
      activeSeats: [],
      seatingMap: null,
      status: 'open',
      gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 60%, #162a43 100%)',
      emoji: '?',
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
  const [registrationsByEvent, setRegistrationsByEvent] = useState<Record<string, RegistrationRecord>>({});
  const registrationsByEventRef = useRef<Record<string, RegistrationRecord>>({});

  useEffect(() => {
    registrationsByEventRef.current = registrationsByEvent;
  }, [registrationsByEvent]);

  const refreshRegistrations = useCallback(() => {
    const auth = getStoredAuth();
    if (!auth) {
      setRegistrationsByEvent({});
      return;
    }

    listMyRegistrations(auth.token)
      .then(({ registrations }) => {
        const activeRegistrations = registrations.filter(registration => registration.status !== 'CANCELLED');
        setRegistrationsByEvent(Object.fromEntries(activeRegistrations.map(registration => [registration.eventId, registration])));
      })
      .catch(() => {
        setRegistrationsByEvent({});
      });
  }, []);

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

    refreshRegistrations();

    return () => {
      cancelled = true;
    };
  }, [refreshRegistrations]);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    const refreshIfRelevant = (payload: { eventId?: unknown }) => {
      if (typeof payload.eventId !== 'string') return;
      if (selectedEventId === payload.eventId || registrationsByEventRef.current[payload.eventId]) {
        refreshRegistrations();
      }
    };

    socket.on('RegistrationCancelled', refreshIfRelevant);
    socket.on('WaitlistPromoted', refreshIfRelevant);
    socket.on('RegistrationWaitlisted', refreshIfRelevant);

    return () => {
      socket.off('RegistrationCancelled', refreshIfRelevant);
      socket.off('WaitlistPromoted', refreshIfRelevant);
      socket.off('RegistrationWaitlisted', refreshIfRelevant);
      socket.disconnect();
    };
  }, [refreshRegistrations, selectedEventId]);

  useEffect(() => {
    if (!openEventId || !events.some(event => event.id === openEventId)) return;
    setSelectedEventId(openEventId);
    onEventOpened?.();
  }, [openEventId, events, onEventOpened]);

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

  const handleRegistered = (eventId: string, registration: RegistrationRecord) => {
    setRegistrationsByEvent(prev => ({ ...prev, [eventId]: registration }));
    if (registration.status !== 'CONFIRMED') return;
    setEvents(prev => prev.map(event => event.id === eventId ? {
      ...event,
      registered: Math.min(event.capacity, event.registered + 1),
      activeSeats: registration.seatLabel && !event.activeSeats.some(seat => seat.seatLabel === registration.seatLabel)
        ? [...event.activeSeats, { seatLabel: registration.seatLabel, seatType: registration.seatType }]
        : event.activeSeats,
    } : event));
  };

  const handleCancelled = (eventId: string, previousStatus: RegistrationStatus, promoted: boolean, registration: RegistrationRecord | null) => {
    setRegistrationsByEvent(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    if (previousStatus !== 'CONFIRMED' || promoted) return;
    setEvents(prev => prev.map(event => event.id === eventId ? {
      ...event,
      registered: Math.max(0, event.registered - 1),
      activeSeats: registration?.seatLabel
        ? event.activeSeats.filter(seat => seat.seatLabel !== registration.seatLabel)
        : event.activeSeats,
    } : event));
  };

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        registration={registrationsByEvent[selectedEvent.id] ?? null}
        onBack={() => setSelectedEventId(null)}
        onNavigate={onNavigate}
        onRegistered={handleRegistered}
        onCancelled={handleCancelled}
      />
    );
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


