import { useState } from 'react';

interface EventsProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard') => void;
}

interface Event {
  id: number;
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

const MOCK_EVENTS: Event[] = [
  {
    id: 1,
    title: 'Spring Symphony Concert',
    category: 'Concert',
    date: 'July 12, 2026',
    time: '19:00',
    location: 'Grand Hall, Sofia',
    venue: 'National Music Academy',
    description: 'An evening of Romantic-era masterworks performed by the Academy\'s Symphony Orchestra.',
    longDescription: 'Join us for an unforgettable evening as the National Music Academy Symphony Orchestra presents a programme of late Romantic masterworks. Under the baton of Maestro Petrov, the ensemble will perform Brahms\' Symphony No. 4 alongside Rachmaninoff\'s Piano Concerto No. 2, featuring soloist Elena Vassileva. This concert marks the culmination of the academy\'s spring semester and celebrates the exceptional talent of our students and faculty.',
    capacity: 320,
    registered: 289,
    price: '€12',
    status: 'almost-full',
    gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 60%, #162a43 100%)',
    emoji: '🎻',
    organizer: 'National Music Academy',
    organizerType: 'Music School',
    program: [
      { time: '19:00', piece: 'Brahms – Academic Festival Overture', performer: 'Symphony Orchestra' },
      { time: '19:25', piece: 'Rachmaninoff – Piano Concerto No. 2', performer: 'Elena Vassileva, piano' },
      { time: '20:20', piece: 'Intermission', performer: '' },
      { time: '20:40', piece: 'Brahms – Symphony No. 4', performer: 'Symphony Orchestra' },
    ],
    venueLayout: 'concert-hall',
    tags: ['Orchestra', 'Classical', 'Brahms', 'Rachmaninoff'],
  },
  {
    id: 2,
    title: 'Jazz Under the Stars',
    category: 'Workshop',
    date: 'July 19, 2026',
    time: '20:30',
    location: 'Borisova Gradina, Sofia',
    venue: 'Open-air Amphitheater',
    description: 'An outdoor jazz night featuring student ensembles and a masterclass from guest artist Marco Ricci.',
    longDescription: 'Spend a summer evening under the open sky with some of the most exciting jazz talent from the Demetra community. Four student ensembles will take the stage, each performing original compositions alongside jazz standards reimagined through a classical lens. Italian saxophonist Marco Ricci will close the evening with a special performance, followed by an open Q&A session for aspiring musicians.',
    capacity: 150,
    registered: 61,
    price: 'Free',
    status: 'open',
    gradient: 'linear-gradient(135deg, #1c2b1a 0%, #2d4a2a 60%, #1a3a18 100%)',
    emoji: '🎷',
    organizer: 'Sofia Jazz Collective',
    organizerType: 'Music Club',
    program: [
      { time: '20:30', piece: 'Student Quartet I – Original Compositions', performer: 'Ensemble Aurum' },
      { time: '21:00', piece: 'Student Quartet II – Standards Set', performer: 'Blue Note Trio +1' },
      { time: '21:30', piece: 'Special Performance & Masterclass', performer: 'Marco Ricci, saxophone' },
    ],
    venueLayout: 'outdoor',
    tags: ['Jazz', 'Outdoor', 'Masterclass', 'Free'],
  },
  {
    id: 3,
    title: 'Piano Masterclass: Chopin Études',
    category: 'Masterclass',
    date: 'July 24, 2026',
    time: '10:00',
    location: 'Studio B, Conservatory',
    venue: 'Plovdiv Conservatory',
    description: 'Intensive half-day session with Prof. Karolina Nowak, focusing on the technical and expressive demands of Chopin\'s Études.',
    longDescription: 'This intimate masterclass offers a rare opportunity to study directly with Professor Karolina Nowak of the Warsaw Chopin Institute. Four selected students will perform études from Op. 10 and Op. 25, receiving detailed feedback in front of an audience of observers. The session concludes with a 45-minute open discussion on practise methodology, finger technique, and musical storytelling. Observer seats are limited — register early.',
    capacity: 40,
    registered: 40,
    price: '€8',
    status: 'full',
    gradient: 'linear-gradient(135deg, #2a1a1a 0%, #4a2020 60%, #3a1010 100%)',
    emoji: '🎹',
    organizer: 'Plovdiv Conservatory',
    organizerType: 'Music School',
    program: [
      { time: '10:00', piece: 'Chopin – Étude Op. 10 No. 1', performer: 'Student: Dimitar Petrov' },
      { time: '10:45', piece: 'Chopin – Étude Op. 10 No. 4', performer: 'Student: Maria Georgieva' },
      { time: '11:30', piece: 'Chopin – Étude Op. 25 No. 11 "Winter Wind"', performer: 'Student: Teodora Ivanova' },
      { time: '12:15', piece: 'Open Discussion & Q&A', performer: 'Prof. Karolina Nowak' },
    ],
    venueLayout: 'classroom',
    tags: ['Piano', 'Chopin', 'Masterclass', 'Intensive'],
  },
  {
    id: 4,
    title: 'Baroque Ensemble Workshop',
    category: 'Workshop',
    date: 'August 3, 2026',
    time: '14:00',
    location: 'Varna Palace of Culture',
    venue: 'Chamber Hall',
    description: 'A collaborative afternoon workshop exploring historically informed performance of Baroque chamber music.',
    longDescription: 'Dive into the world of Baroque performance practice in this hands-on ensemble workshop. Participants will work through movements from Vivaldi\'s concerti grossi and Bach\'s Brandenburg Concertos, exploring ornamentation, basso continuo realisation, and period-appropriate articulation. The session is led by harpsichordist Dr. Nadia Stefanova and is open to players of any Baroque instrument. Bring your instrument and your curiosity.',
    capacity: 25,
    registered: 14,
    price: '€6',
    status: 'open',
    gradient: 'linear-gradient(135deg, #1a1a2a 0%, #2a2050 60%, #1a1540 100%)',
    emoji: '🎼',
    organizer: 'Varna Early Music Society',
    organizerType: 'Music Club',
    program: [
      { time: '14:00', piece: 'Vivaldi – Concerto Grosso Op. 3 No. 8', performer: 'Ensemble participants' },
      { time: '15:15', piece: 'Bach – Brandenburg Concerto No. 3', performer: 'Ensemble participants' },
      { time: '16:30', piece: 'Ornamentation & continuo practise', performer: 'Dr. Nadia Stefanova, hpsd' },
    ],
    venueLayout: 'concert-hall',
    tags: ['Baroque', 'Chamber', 'Workshop', 'Early Music'],
  },
  {
    id: 5,
    title: 'Student Recital Night',
    category: 'Recital',
    date: 'June 14, 2026',
    time: '18:00',
    location: 'Main Hall, Academy',
    venue: 'National Music Academy',
    description: 'End-of-year student recital showcasing the finest performers from this academic year.',
    longDescription: 'The annual end-of-year student recital brings together the top graduates and advancing students from across the academy\'s departments. From violin to voice, piano to percussion, this evening showcases the depth of talent nurtured through the year. Families, friends, and music lovers are warmly invited.',
    capacity: 200,
    registered: 200,
    price: 'Free',
    status: 'past',
    gradient: 'linear-gradient(135deg, #2a2a2a 0%, #404040 60%, #1a1a1a 100%)',
    emoji: '🎵',
    organizer: 'National Music Academy',
    organizerType: 'Music School',
    program: [
      { time: '18:00', piece: 'Violin: Mendelssohn Concerto, Mvt. I', performer: 'Anna Kostadinova' },
      { time: '18:25', piece: 'Voice: Schubert Lieder Selection', performer: 'Hristo Nikolov, baritone' },
      { time: '18:55', piece: 'Piano: Beethoven Sonata Op. 57 "Appassionata"', performer: 'Galina Todorova' },
    ],
    venueLayout: 'concert-hall',
    tags: ['Recital', 'Students', 'Graduation', 'Mixed'],
  },
  {
    id: 6,
    title: 'Music Theory Symposium',
    category: 'Lecture',
    date: 'August 15, 2026',
    time: '09:30',
    location: 'Lecture Hall 3, Conservatory',
    venue: 'Sofia Conservatory',
    description: 'A one-day academic symposium on post-tonal theory, with presentations from scholars across Eastern Europe.',
    longDescription: 'The annual Music Theory Symposium gathers scholars, students, and practitioners to discuss developments in contemporary music theory. This year\'s theme is "Voice Leading Beyond Tonality," with presentations covering Messiaen\'s modes, spectral music analysis, and algorithmic composition. The day includes three keynote talks, four short paper sessions, and an evening panel discussion.',
    capacity: 80,
    registered: 45,
    price: '€15',
    status: 'open',
    gradient: 'linear-gradient(135deg, #1a2020 0%, #203030 60%, #102020 100%)',
    emoji: '📜',
    organizer: 'Sofia Conservatory',
    organizerType: 'Music School',
    program: [
      { time: '09:30', piece: 'Keynote: "Spectral Harmony in Practice"', performer: 'Prof. Ioan Ciobanu' },
      { time: '11:00', piece: 'Short Papers Session I', performer: 'Multiple presenters' },
      { time: '14:00', piece: 'Keynote: "Algorithmic Composition Today"', performer: 'Dr. Petra Horak' },
      { time: '17:00', piece: 'Panel Discussion', performer: 'All speakers' },
    ],
    venueLayout: 'classroom',
    tags: ['Theory', 'Academic', 'Lecture', 'Symposium'],
  },
];

// ── Venue layout SVG renderers ──────────────────────────────────────────────

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

// ── Event Detail Page ────────────────────────────────────────────────────────

function EventDetail({ event, onBack }: { event: Event; onBack: () => void }) {
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'waitlist'>('idle');
  const isFull = event.registered >= event.capacity;
  const isPast = event.status === 'past';
  const pct = Math.round((event.registered / event.capacity) * 100);

  const handleJoin = () => {
    setJoinState('joining');
    setTimeout(() => {
      setJoinState(isFull ? 'waitlist' : 'joined');
    }, 1200);
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
      {/* Hero */}
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
            <span>📅 {event.date} · {event.time}</span>
            <span>📍 {event.location}</span>
            <span>🏛️ {event.venue}</span>
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
                  <div key={i} className="programme-intermission">— Intermission —</div>
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
                <span>✓</span> You're registered!
              </div>
            ) : joinState === 'waitlist' ? (
              <div className="join-success join-success--waitlist">
                <span>⏳</span> Added to waitlist
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

// ── Events List Page ─────────────────────────────────────────────────────────

export default function Events({ onNavigate: _onNavigate }: EventsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const categories = ['All', 'Concert', 'Workshop', 'Masterclass', 'Lecture', 'Recital'];

  const filtered = MOCK_EVENTS.filter((ev) => {
    if (activeTab === 'upcoming' && ev.status === 'past') return false;
    if (activeTab === 'past' && ev.status !== 'past') return false;
    if (categoryFilter !== 'All' && ev.category !== categoryFilter) return false;
    if (search && !ev.title.toLowerCase().includes(search.toLowerCase()) &&
        !ev.organizer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upcomingCount = MOCK_EVENTS.filter(e => e.status !== 'past').length;
  const pastCount = MOCK_EVENTS.filter(e => e.status === 'past').length;

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} />;
  }

  return (
    <div className="events-page-container page-transition-container">
      <div className="events-content-wrapper">
        {/* Header */}
        <header className="events-header">
          <div className="events-breadcrumbs">Demetra · Events</div>
          <h1 className="events-main-title">Musical Events</h1>
        </header>

        {/* Controls */}
        <div className="events-controls-row">
          <div className="events-tabs">
            {([['all', 'All', MOCK_EVENTS.length], ['upcoming', 'Upcoming', upcomingCount], ['past', 'Past', pastCount]] as const).map(
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
                placeholder="Search events…"
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
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
              No events match your search.
            </div>
          ) : (
            filtered.map(ev => {
              const pct = Math.round((ev.registered / ev.capacity) * 100);
              return (
                <article
                  key={ev.id}
                  className={`event-card ${ev.status === 'past' ? 'event-card--past' : ''}`}
                  onClick={() => setSelectedEvent(ev)}
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
                    <div className="event-date">{ev.date} · {ev.time}</div>
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