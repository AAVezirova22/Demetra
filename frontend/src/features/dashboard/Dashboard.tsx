import { useState, useEffect, type FormEvent } from 'react';
import { Globe, Mail, MapPin, MoreHorizontal, Phone, X } from 'lucide-react';
import {
  cancelEvent,
  createEvent,
  createInvitation,
  createOrganization,
  createOrganizationPost,
  acceptInvitation,
  fetchOrganization,
  fetchOrganizationPost,
  getStoredAuth,
  deleteStageLayout,
  listEvents,
  listEventRegistrations,
  listMyEvents,
  listNotifications,
  listOrganizationPosts,
  listStageLayouts,
  markAllNotificationsRead,
  markNotificationRead,
  removeOrganizationMember,
  saveStageLayout as persistStageLayout,
  storeAuth,
  updateEvent,
  updateOrganizationMemberRole,
  type AuthRole,
  type AuthUser,
  type EventRecord,
  type NotificationRecord,
  type OrganizationPost,
  type OrganizationInvitation,
  type OrganizationMember,
  type RegistrationRecord,
  type SeatStatus,
  type StageLayoutRecord,
  type StageSeat,
  type UserProfile,
} from '../../shared/api/api';
import './Dashboard.css';

interface DashboardProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard' | 'instruments' | 'join') => void;
  currentUser: AuthUser | null;
  onOpenInvitation: (token: string) => void;
  onUserUpdated: (user: AuthUser) => void;
  openPostId?: string;
  onPostOpened?: () => void;
}

// Types
type Seat = StageSeat;
type StageLayout = StageLayoutRecord;

// Mock Data
function titleCaseEnum(value: string | undefined) {
  if (!value) return 'Organization';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return letters || 'ORG';
}

const EVENT_COLORS = ['#4f8ef7', '#7c6df0', '#38b2ac', '#e8aa2e', '#e05c5c', '#48bb78'];
const ORGANIZATION_KINDS = [
  { value: 'MUSIC_SCHOOL', label: 'Music school' },
  { value: 'CONSERVATORY', label: 'Conservatory' },
  { value: 'UNIVERSITY_DEPARTMENT', label: 'University department' },
  { value: 'CHOIR', label: 'Choir' },
  { value: 'STUDENT_CLUB', label: 'Student club' },
  { value: 'OTHER', label: 'Other' },
];

function buildSeats(rows: number, cols: number): Seat[] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ id: `${r}-${c}`, row: r, col: c, status: 'available' as SeatStatus }))
  ).flat();
}

function resizeSeats(current: Seat[], rows: number, cols: number): Seat[] {
  const currentByPosition = new Map(current.map(seat => [`${seat.row}-${seat.col}`, seat.status]));

  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      id: `${r}-${c}`,
      row: r,
      col: c,
      status: currentByPosition.get(`${r}-${c}`) ?? 'available' as SeatStatus,
    }))
  ).flat();
}

function formatEventDate(value: string | null) {
  if (!value) return 'Date TBA';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function mapDashboardEvent(event: EventRecord, index: number) {
  const registered = event.registered ?? 0;
  const capacity = Math.max(event.capacity, 1);
  const startsAt = event.startsAt ? new Date(event.startsAt) : null;
  const isPast = startsAt ? startsAt.getTime() < Date.now() : false;
  const isFull = registered >= capacity;

  return {
    id: event.id,
    title: event.title,
    date: formatEventDate(event.startsAt),
    startsAt: event.startsAt,
    registered,
    capacity,
    status: isPast ? 'past' : isFull ? 'full' : 'open',
    apiStatus: event.status,
    category: event.category ?? 'Event',
    color: EVENT_COLORS[index % EVENT_COLORS.length]!,
    organizerId: event.organizer?.id,
  };
}

// Animated Counter
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display}</>;
}

// Interactive Seat Map
function SeatMap({ layout, editable = false, onUpdate }: {
  layout: StageLayout;
  editable?: boolean;
  onUpdate?: (seats: Seat[]) => void;
}) {
  const [seats, setSeats] = useState<Seat[]>(layout.seats);
  const [paintMode, setPaintMode] = useState<SeatStatus>('available');
  const [isPainting, setIsPainting] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    setSeats(layout.seats);
  }, [layout.seats]);

  const toggleSeat = (id: string) => {
    if (!editable) return;
    const next = seats.map(s => s.id === id ? { ...s, status: paintMode } : s);
    setSeats(next);
    onUpdate?.(next);
  };

  const getSeatColor = (status: SeatStatus) => {
    switch (status) {
      case 'available': return { fill: 'rgba(22,42,67,0.07)', stroke: 'rgba(22,42,67,0.2)', hover: 'rgba(79,142,247,0.3)' };
      case 'taken':     return { fill: 'rgba(167,154,14,0.35)', stroke: 'rgb(167,154,14)', hover: 'rgba(167,154,14,0.5)' };
      case 'selected':  return { fill: 'rgba(79,142,247,0.35)', stroke: '#4f8ef7', hover: 'rgba(79,142,247,0.5)' };
      case 'vip':       return { fill: 'rgba(176,132,70,0.3)', stroke: '#b0844640', hover: 'rgba(176,132,70,0.5)' };
      case 'blocked':   return { fill: 'rgba(22,42,67,0.03)', stroke: 'rgba(22,42,67,0.08)', hover: '' };
    }
  };

  const rows = layout.rows;
  const cols = layout.cols;
  const seatW = 22, seatH = 18, gap = 4;
  const stageH = 54;
  const totalW = cols * (seatW + gap) + 40;
  const totalH = rows * (seatH + gap) + stageH + 60;

  const taken = seats.filter(s => s.status === 'taken').length;
  const vip = seats.filter(s => s.status === 'vip').length;
  const blocked = seats.filter(s => s.status === 'blocked').length;
  const available = seats.filter(s => s.status === 'available').length;

  return (
    <div className="seatmap-wrapper">
      {editable && (
        <div className="seatmap-toolbar">
          {(['available', 'taken', 'vip', 'blocked'] as SeatStatus[]).map(mode => (
            <button key={mode}
              className={`seatmap-tool ${paintMode === mode ? 'active' : ''}`}
              onClick={() => setPaintMode(mode)}
              style={{ '--tool-color': getSeatColor(mode).stroke } as any}
            >
              <span className="seatmap-tool-dot" style={{ background: getSeatColor(mode).fill, border: `1.5px solid ${getSeatColor(mode).stroke}` }} />
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
          <div className="seatmap-toolbar-hint">Click or drag to paint</div>
        </div>
      )}

      <div className="seatmap-scroll">
        <svg
          viewBox={`0 0 ${totalW} ${totalH}`}
          style={{ width: '100%', maxWidth: totalW, display: 'block', margin: '0 auto' }}
          onMouseLeave={() => { setIsPainting(false); setTooltip(null); }}
        >
          {/* Stage */}
          {layout.stageShape === 'arc' ? (
            <>
              <ellipse cx={totalW / 2} cy={stageH * 0.55} rx={totalW * 0.38} ry={stageH * 0.55}
                fill="rgba(167,154,14,0.12)" stroke="rgb(167,154,14)" strokeWidth="1.5" />
              <text x={totalW / 2} y={stageH * 0.62} textAnchor="middle" fill="rgb(167,154,14)"
                fontSize="11" fontFamily="Cinzel, serif" letterSpacing="3">STAGE</text>
            </>
          ) : layout.stageShape === 'thrust' ? (
            <>
              <polygon points={`${totalW * 0.3},${stageH} ${totalW * 0.7},${stageH} ${totalW * 0.6},4 ${totalW * 0.4},4`}
                fill="rgba(167,154,14,0.12)" stroke="rgb(167,154,14)" strokeWidth="1.5" />
              <text x={totalW / 2} y={stageH * 0.6} textAnchor="middle" fill="rgb(167,154,14)"
                fontSize="11" fontFamily="Cinzel, serif" letterSpacing="3">STAGE</text>
            </>
          ) : (
            <>
              <rect x={totalW * 0.2} y={4} width={totalW * 0.6} height={stageH - 8} rx="6"
                fill="rgba(167,154,14,0.12)" stroke="rgb(167,154,14)" strokeWidth="1.5" />
              <text x={totalW / 2} y={stageH * 0.58} textAnchor="middle" fill="rgb(167,154,14)"
                fontSize="11" fontFamily="Cinzel, serif" letterSpacing="3">STAGE</text>
            </>
          )}

          {/* Row labels */}
          {Array.from({ length: rows }, (_, r) => (
            <text key={r} x={16} y={stageH + r * (seatH + gap) + seatH * 0.7}
              textAnchor="middle" fill="#a0aec0" fontSize="9" fontFamily="Inter, sans-serif">
              {String.fromCharCode(65 + r)}
            </text>
          ))}

          {/* Seats */}
          {seats.map(seat => {
            const colors = getSeatColor(seat.status);
            const x = 28 + seat.col * (seatW + gap);
            const y = stageH + seat.row * (seatH + gap);
            return (
              <rect
                key={seat.id}
                x={x} y={y} width={seatW} height={seatH} rx={3}
                fill={colors.fill} stroke={colors.stroke} strokeWidth={0.8}
                style={{ cursor: editable ? 'crosshair' : 'default', transition: 'fill 0.1s ease' }}
                onMouseEnter={(e) => {
                  setTooltip({ x: e.clientX, y: e.clientY, text: `Row ${String.fromCharCode(65 + seat.row)}, Seat ${seat.col + 1} / ${seat.status}` });
                  if (isPainting && editable) toggleSeat(seat.id);
                }}
                onMouseLeave={() => setTooltip(null)}
                onMouseDown={() => { setIsPainting(true); toggleSeat(seat.id); }}
                onMouseUp={() => setIsPainting(false)}
              />
            );
          })}
        </svg>
      </div>

      {tooltip && (
        <div className="seat-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}>
          {tooltip.text}
        </div>
      )}

      <div className="seatmap-legend">
        {[
          { label: 'Available', color: 'rgba(22,42,67,0.07)', stroke: 'rgba(22,42,67,0.2)', count: available },
          { label: 'Taken', color: 'rgba(167,154,14,0.35)', stroke: 'rgb(167,154,14)', count: taken },
          { label: 'VIP', color: 'rgba(176,132,70,0.3)', stroke: '#b08446', count: vip },
          { label: 'Blocked', color: 'rgba(22,42,67,0.03)', stroke: 'rgba(22,42,67,0.08)', count: blocked },
        ].map(l => (
          <div key={l.label} className="seatmap-legend-item">
            <span style={{ width: 14, height: 12, borderRadius: 2, background: l.color, border: `1.5px solid ${l.stroke}`, display: 'inline-block', flexShrink: 0 }} />
            <span>{l.label}</span>
            <span className="legend-count">{l.count}</span>
          </div>
        ))}
        <div className="seatmap-legend-item" style={{ marginLeft: 'auto' }}>
          <span style={{ fontWeight: 700, color: '#162a43', fontSize: 12 }}>Total: {seats.length - blocked}</span>
        </div>
      </div>
    </div>
  );
}

// Stage Layout Builder Modal
function StageBuilderModal({ onClose, onSave, existing }: {
  onClose: () => void;
  onSave: (layout: StageLayout) => Promise<void> | void;
  existing?: StageLayout;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [rows, setRows] = useState(existing?.rows ?? 8);
  const [cols, setCols] = useState(existing?.cols ?? 12);
  const [shape, setShape] = useState<'rect' | 'arc' | 'thrust'>(existing?.stageShape ?? 'rect');
  const [seats, setSeats] = useState<Seat[]>(existing?.seats ?? buildSeats(8, 12));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSeats(current => {
      const next = resizeSeats(current, rows, cols);
      return next;
    });
  }, [rows, cols]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
      id: existing?.id ?? `layout-${Date.now()}`,
      name, venue, rows, cols, seats, stageShape: shape,
        createdAt: existing?.createdAt ?? new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save layout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{existing ? 'Edit Layout' : 'Create Stage Layout'}</h3>
          <button className="modal-close" onClick={onClose}>X</button>
        </div>

        <div className="builder-grid">
          <div className="builder-controls">
            <div className="form-group">
              <label>Layout Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grand Hall" />
            </div>
            <div className="form-group">
              <label>Venue</label>
              <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Main Concert Hall" />
            </div>
            <div className="form-group">
              <label>Stage Shape</label>
              <div className="shape-selector">
                {(['rect', 'arc', 'thrust'] as const).map(s => (
                  <button key={s} className={`shape-btn ${shape === s ? 'active' : ''}`} onClick={() => setShape(s)}>
                    <svg viewBox="0 0 40 24" width="40" height="24">
                      {s === 'rect' && <rect x={6} y={2} width={28} height={20} rx={2} fill={shape === s ? 'rgba(167,154,14,0.3)' : 'rgba(22,42,67,0.08)'} stroke={shape === s ? 'rgb(167,154,14)' : 'rgba(22,42,67,0.25)'} strokeWidth={1.5} />}
                      {s === 'arc' && <ellipse cx={20} cy={12} rx={16} ry={10} fill={shape === s ? 'rgba(167,154,14,0.3)' : 'rgba(22,42,67,0.08)'} stroke={shape === s ? 'rgb(167,154,14)' : 'rgba(22,42,67,0.25)'} strokeWidth={1.5} />}
                      {s === 'thrust' && <polygon points="10,22 30,22 26,2 14,2" fill={shape === s ? 'rgba(167,154,14,0.3)' : 'rgba(22,42,67,0.08)'} stroke={shape === s ? 'rgb(167,154,14)' : 'rgba(22,42,67,0.25)'} strokeWidth={1.5} />}
                    </svg>
                    <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Rows: <b>{rows}</b></label>
              <input type="range" min={2} max={20} value={rows} onChange={e => setRows(+e.target.value)} className="range-slider" />
            </div>
            <div className="form-group">
              <label>Columns: <b>{cols}</b></label>
              <input type="range" min={4} max={24} value={cols} onChange={e => setCols(+e.target.value)} className="range-slider" />
            </div>
            <div className="builder-capacity-display">
              <div className="capacity-number">{rows * cols}</div>
              <div className="capacity-label">Total seats</div>
            </div>
          </div>

          <div className="builder-preview">
            <div className="builder-preview-label">Live Preview - paint seat types</div>
            <SeatMap
              layout={{ id: 'preview', name, venue, rows, cols, seats, stageShape: shape, createdAt: '', updatedAt: '' }}
              editable
              onUpdate={setSeats}
            />
          </div>
        </div>

        {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="modal-btn-primary" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving...' : existing ? 'Save changes' : 'Save layout'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Event Modal
function CreateEventModal({ layouts, initialLayout, existingEvent, onClose, onSaved }: {
  layouts: StageLayout[];
  initialLayout: StageLayout | null;
  existingEvent?: EventRecord | null;
  onClose: () => void;
  onSaved: (event: EventRecord) => void;
}) {
  const [step, setStep] = useState(1);
  const existingStartsAt = existingEvent?.startsAt ? new Date(existingEvent.startsAt) : null;
  const [title, setTitle] = useState(existingEvent?.title ?? '');
  const [category, setCategory] = useState(existingEvent?.category ?? 'Concert');
  const [description, setDescription] = useState(existingEvent?.description ?? '');
  const [date, setDate] = useState(existingStartsAt ? existingStartsAt.toISOString().slice(0, 10) : '');
  const [time, setTime] = useState(existingStartsAt ? existingStartsAt.toTimeString().slice(0, 5) : '');
  const [location, setLocation] = useState(existingEvent?.location ?? initialLayout?.venue ?? '');
  const [selectedLayout, setSelectedLayout] = useState<StageLayout | null>(initialLayout);
  const [capacity, setCapacity] = useState(existingEvent?.capacity ?? (initialLayout ? initialLayout.seats.filter(seat => seat.status !== 'blocked').length : 120));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(existingEvent);

  const submit = async () => {
    const auth = getStoredAuth();
    if (!auth) {
      setError('Log in as an organiser to create events.');
      return;
    }
    if (!title.trim()) {
      setError('Event title is required.');
      setStep(1);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const startsAt = date ? new Date(`${date}T${time || '00:00'}`).toISOString() : undefined;
      const input = {
        title: title.trim(),
        description: description.trim(),
        category,
        startsAt,
        location: location.trim(),
        capacity,
      };
      const { event } = existingEvent
        ? await updateEvent(auth.token, existingEvent.id, input)
        : await createEvent(auth.token, input);
      onSaved(event);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event.');
    } finally {
      setSaving(false);
    }
  };

  const canPublish = title.trim().length >= 2 && capacity > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{isEditing ? 'Edit Event' : 'Create New Event'}</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="create-steps">
          {['Details', 'Venue & Seats', 'Publish'].map((s, i) => (
            <button key={s} type="button" className={`create-step ${step >= i + 1 ? 'active' : ''}`} onClick={() => setStep(i + 1)}>
              <div className="create-step-num">{i + 1}</div>
              <div className="create-step-label">{s}</div>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="create-form">
            <div className="form-group"><label>Event Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Spring Chamber Concert" /></div>
            <div className="create-form-row">
              <div className="form-group"><label>Category</label><select value={category} onChange={e => setCategory(e.target.value)}><option>Concert</option><option>Masterclass</option><option>Workshop</option><option>Lecture</option><option>Recital</option></select></div>
              <div className="form-group"><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div className="form-group"><label>Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the programme, performers, and audience information." rows={4} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="create-venue-step">
            <div className="form-group"><label>Location</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Main Concert Hall" /></div>
            <div className="form-group"><label>Capacity</label><input type="number" min={1} max={100000} value={capacity} onChange={e => setCapacity(Math.max(1, Number(e.target.value) || 1))} /></div>
            <div className="layout-selection-grid">
              {layouts.length === 0 && <div className="no-events-state">No saved stage layouts yet.</div>}
              {layouts.map(l => (
                <button key={l.id} type="button" className={`layout-select-card ${selectedLayout?.id === l.id ? 'selected' : ''}`} onClick={() => { setSelectedLayout(l); setLocation(l.venue); setCapacity(l.seats.filter(seat => seat.status !== 'blocked').length); }}>
                  <div className="layout-select-name">{l.name}</div>
                  <div className="layout-select-meta">{l.venue} / {l.seats.filter(seat => seat.status !== 'blocked').length} usable seats</div>
                  <SeatMap layout={l} editable={false} />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="publish-preview">
            <div className="preview-card">
              <div className="preview-category">{category}</div>
              <h4>{title || 'Untitled event'}</h4>
              <p>{description || 'No description yet.'}</p>
              <div className="preview-meta">{date || 'Date TBA'} {time ? `/ ${time}` : ''}</div>
              <div className="preview-meta">{location || 'Location TBA'} / {capacity} seats</div>
            </div>
          </div>
        )}

        {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          {step > 1 && <button className="modal-btn-secondary" onClick={() => setStep(step - 1)} disabled={saving}>Back</button>}
          {step < 3 ? (
            <button className="modal-btn-primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !title.trim()}>Continue</button>
          ) : (
            <button className="modal-btn-primary" onClick={submit} disabled={!canPublish || saving}>{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Publish event'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRegistrationsModal({ event, registrations, loading, error, onClose }: {
  event: EventRecord;
  registrations: RegistrationRecord[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const confirmed = registrations.filter(registration => registration.status === 'CONFIRMED');
  const waitlisted = registrations.filter(registration => registration.status === 'WAITLISTED');

  const renderRows = (rows: RegistrationRecord[], emptyText: string) => (
    <div className="pending-invites-panel" style={{ marginTop: 12 }}>
      {rows.length === 0 ? (
        <div className="no-events-state">{emptyText}</div>
      ) : rows.map((registration, index) => (
        <div key={registration.id} className="pending-invite-row">
          <span>{registration.user?.name ?? 'Participant'}</span>
          <b>{registration.status === 'WAITLISTED' ? `#${index + 1} waitlist` : 'Confirmed'}</b>
          <em>{registration.user?.email ?? ''}</em>
        </div>
      ))}
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Registrations</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="invite-label">{event.title}</div>
        {loading && <div className="no-events-state">Loading registrations...</div>}
        {error && <div className="auth-error">{error}</div>}
        {!loading && !error && (
          <>
            <div className="dash-section-header" style={{ marginTop: 18 }}>
              <h2 className="dash-section-title">Confirmed</h2>
              <span className="dash-status-chip active">{confirmed.length}</span>
            </div>
            {renderRows(confirmed, 'No confirmed participants yet.')}
            <div className="dash-section-header" style={{ marginTop: 18 }}>
              <h2 className="dash-section-title">Waitlist</h2>
              <span className="dash-status-chip">{waitlisted.length}</span>
            </div>
            {renderRows(waitlisted, 'No one is waiting.')}
          </>
        )}
        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function PostComposerModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (post: OrganizationPost) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const auth = getStoredAuth();
    if (!auth) return;
    setSaving(true);
    setError('');
    try {
      const { post } = await createOrganizationPost(auth.token, {
        title: title.trim(),
        body: body.trim(),
      });
      onCreated(post);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">New post</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="form-group">
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Post title" />
        </div>
        <div className="form-group">
          <label>Text</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Write the announcement..." />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="modal-btn-primary" onClick={submit} disabled={saving || title.trim().length < 2 || body.trim().length < 2}>
            {saving ? 'Publishing...' : 'Publish post'}
          </button>
        </div>
      </div>
    </div>
  );
}
function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (invite: OrganizationInvitation) => void }) {
  const [copied, setCopied] = useState<'link' | 'token' | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<AuthRole>('STUDENT');
  const [invite, setInvite] = useState<OrganizationInvitation | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const inviteLink = invite ? `${window.location.origin}/join?token=${encodeURIComponent(invite.token)}` : '';
  const qrUrl = inviteLink ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(inviteLink)}` : '';

  const copyValue = async (kind: 'link' | 'token', value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const createInvite = async () => {
    const auth = getStoredAuth();
    if (!auth) return;
    setCreating(true);
    setError('');
    try {
      const result = await createInvitation(auth.token, { email: emailInput.trim() || undefined, role });
      setInvite(result.invitation);
      onCreated(result.invitation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invitation.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Invite members</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="invite-section">
          <div className="invite-label">Recipient</div>
          <div className="invite-email-row">
            <input type="email" placeholder={role === 'ORGANIZER' ? 'name@teacher.edu or leave blank' : 'name@student.edu or leave blank'} value={emailInput} onChange={e => setEmailInput(e.target.value)} className="invite-email-input" />
            <select className="invite-email-input invite-role-select" value={role} onChange={(e) => setRole(e.target.value as AuthRole)}>
              <option value="STUDENT">Student</option>
              <option value="ORGANIZER">Teacher</option>
            </select>
          </div>
        </div>
        <div className="invite-section">
          <div className="invite-label">Create invitation</div>
          <button className="invite-send-btn invite-create-wide" onClick={createInvite} disabled={creating}>
            {creating ? 'Creating...' : `Create ${role === 'ORGANIZER' ? 'teacher' : 'student'} invite`}
          </button>
          {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
        {invite && (
          <div className="invite-section">
            <div className="invite-label">Invitation link</div>
            <div className="invite-copy-row">
              <div className="invite-value">{inviteLink}</div>
              <button className={`invite-copy-btn ${copied === 'link' ? 'copied' : ''}`} onClick={() => copyValue('link', inviteLink)}>
                {copied === 'link' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="invite-qr-row">
              <img className="invite-qr" src={qrUrl} alt="Invitation QR code" />
              <div className="invite-qr-copy">
                <div className="invite-label">Join code</div>
                <div className="invite-copy-row">
                  <div className="invite-value invite-code">{invite.token}</div>
                  <button className={`invite-copy-btn ${copied === 'token' ? 'copied' : ''}`} onClick={() => copyValue('token', invite.token)}>
                    {copied === 'token' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationPane({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onOpenInvitation,
  onOpenPost,
}: {
  notifications: NotificationRecord[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenInvitation: (token: string) => void;
  onOpenPost: (postId: string) => void;
}) {
  const openNotification = (notification: NotificationRecord) => {
    if (notification.status === 'UNREAD') onMarkRead(notification.id);
    if (!notification.metadata || typeof notification.metadata !== 'object') return;
    if (notification.type === 'OrganizationInvite') {
      const token = (notification.metadata as { token?: unknown }).token;
      if (typeof token === 'string') onOpenInvitation(token);
    }
    if (notification.type === 'OrganizationPostPublished') {
      const postId = (notification.metadata as { postId?: unknown }).postId;
      if (typeof postId === 'string') onOpenPost(postId);
    }
  };

  return (
    <div className="notification-pane">
      <div className="notification-pane-header">
        <div>
          <h2 className="dash-section-title">Notifications</h2>
          <div className="notification-pane-sub">{unreadCount} unread</div>
        </div>
        <button className="dash-section-action" onClick={onMarkAllRead} disabled={unreadCount === 0}>Mark all read</button>
      </div>
      <div className="notification-list">
        {notifications.length === 0 && <div className="notification-empty">No notifications yet.</div>}
        {notifications.map((notification) => (
          <button
            type="button"
            key={notification.id}
            className={`notification-item ${notification.status === 'UNREAD' ? 'unread' : ''}`}
            onClick={() => openNotification(notification)}
          >
            <span className="notification-dot" />
            <span className="notification-body">
              <span className="notification-title">{notification.title}</span>
              <span className="notification-message">{notification.message}</span>
              <span className="notification-time">{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(notification.createdAt))}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function memberRoleLabel(member: OrganizationMember) {
  if (member.status === 'OWNER' || member.membershipRole === 'ORGANIZER') return 'Organizer';
  if (member.role === 'ORGANIZER') return 'Teacher';
  return 'Student';
}

function memberInitials(member: Pick<OrganizationMember, 'name'>, profile?: UserProfile) {
  return (profile?.displayName || member.name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'D';
}

function ProfileModal({ member, onClose }: { member: OrganizationMember; onClose: () => void }) {
  const profile = member.profile ?? {
    displayName: member.name,
    avatar: '',
    location: '',
    bio: '',
    headline: memberRoleLabel(member),
    primaryFocus: '',
    phone: '',
    website: '',
  };
  const displayName = profile.displayName || member.name;
  const headline = profile.headline || memberRoleLabel(member);
  const detailRows = [
    { label: 'Location', value: profile.location, icon: <MapPin size={14} /> },
    { label: 'Primary subject', value: profile.primaryFocus, icon: null },
    { label: 'Email', value: member.email, icon: <Mail size={14} /> },
    { label: 'Phone', value: profile.phone, icon: <Phone size={14} /> },
    { label: 'Website', value: profile.website, icon: <Globe size={14} /> },
  ].filter(row => row.value);

  return (
    <div className="member-profile-modal-backdrop" onClick={onClose}>
      <div className="member-profile-modal" role="dialog" aria-modal="true" aria-label={`${displayName} profile`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="member-profile-close" onClick={onClose} aria-label="Close profile">
          <X size={16} />
        </button>
        <div className="member-profile-header">
          <div className="member-profile-photo">
            {profile.avatar ? <img src={profile.avatar} alt="" /> : <span>{memberInitials(member, profile)}</span>}
          </div>
          <div>
            <div className="member-profile-name">{displayName}</div>
            <div className="member-profile-role">{headline}</div>
            <span className="dash-status-chip active">{memberRoleLabel(member)}</span>
          </div>
        </div>

        {profile.bio && (
          <div className="member-profile-section">
            <div className="member-profile-label">Bio</div>
            <p>{profile.bio}</p>
          </div>
        )}

        <div className="member-profile-details">
          {detailRows.map(row => (
            <div key={row.label} className="member-profile-detail">
              <span className="member-profile-detail-icon">{row.icon}</span>
              <span>
                <b>{row.label}</b>
                {row.label === 'Website' ? (
                  <a href={row.value!.startsWith('http') ? row.value! : `https://${row.value}`} target="_blank" rel="noreferrer">{row.value}</a>
                ) : (
                  <em>{row.value}</em>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyOrganizationDashboard({
  currentUser,
  onUserUpdated,
}: {
  currentUser: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
}) {
  const [organizationName, setOrganizationName] = useState('');
  const [organizationKind, setOrganizationKind] = useState('MUSIC_SCHOOL');
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const normalizeJoinCode = (value: string) => {
    const trimmed = value.trim();
    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get('token') || parsed.searchParams.get('invite') || trimmed;
    } catch {
      return trimmed;
    }
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const auth = getStoredAuth();
    if (!auth) return;

    setCreating(true);
    setCreateError('');
    try {
      const result = await createOrganization(auth.token, {
        name: organizationName.trim(),
        kind: organizationKind,
      });
      storeAuth({ token: auth.token, user: result.user });
      onUserUpdated(result.user);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create organization.');
    } finally {
      setCreating(false);
    }
  };

  const submitJoin = async (event: FormEvent) => {
    event.preventDefault();
    const auth = getStoredAuth();
    if (!auth) return;

    setJoining(true);
    setJoinError('');
    try {
      const result = await acceptInvitation(auth.token, normalizeJoinCode(joinCode));
      storeAuth({ token: auth.token, user: result.user });
      onUserUpdated(result.user);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join organization.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="dash-page dash-page-empty page-transition-container">
      <main className="empty-org-main">
        <div className="empty-org-header">
          <div className="dash-breadcrumb">Dashboard / Organisation</div>
          <h1 className="dash-page-title">You do not have an organisation yet</h1>
          <p>
            Create your own organisation, or join an existing one with the join code from an invitation.
          </p>
        </div>

        <div className="empty-org-grid">
          <form className="empty-org-panel" onSubmit={submitCreate}>
            <div className="empty-org-panel-kicker">Create</div>
            <h2>Create an organisation</h2>
            <p>Start a new space for your students, events, and invitations.</p>
            <div className="form-group">
              <label htmlFor="new-organization-name">Organisation name</label>
              <input
                id="new-organization-name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                placeholder={`${currentUser.name}'s Studio`}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-organization-kind">Organisation type</label>
              <select
                id="new-organization-kind"
                value={organizationKind}
                onChange={(event) => setOrganizationKind(event.target.value)}
              >
                {ORGANIZATION_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>{kind.label}</option>
                ))}
              </select>
            </div>
            {createError && <div className="auth-error">{createError}</div>}
            <button className="dash-create-btn empty-org-action" type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create organisation'}
            </button>
          </form>

          <form className="empty-org-panel" onSubmit={submitJoin}>
            <div className="empty-org-panel-kicker">Join</div>
            <h2>Join with a code</h2>
            <p>Paste the join code shown beside the invitation QR code.</p>
            <div className="form-group">
              <label htmlFor="organization-join-code">Join code</label>
              <input
                id="organization-join-code"
                type="text"
                required
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Paste invitation code"
              />
            </div>
            {joinError && <div className="auth-error">{joinError}</div>}
            <button className="dash-create-btn empty-org-action" type="submit" disabled={joining}>
              {joining ? 'Joining...' : 'Join organisation'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

// Dashboard
export default function Dashboard({ onNavigate: _onNavigate, currentUser, onOpenInvitation, onUserUpdated, openPostId = '', onPostOpened }: DashboardProps) {
  const [section, setSection] = useState<'overview' | 'events' | 'news' | 'students' | 'stages' | 'settings'>('overview');
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingLayout, setEditingLayout] = useState<StageLayout | undefined>();
  const [layouts, setLayouts] = useState<StageLayout[]>([]);
  const [eventRecords, setEventRecords] = useState<EventRecord[]>([]);
  const [dashboardOrganization, setDashboardOrganization] = useState<AuthUser['organization']>(currentUser?.organization ?? null);
  const [registrationEvent, setRegistrationEvent] = useState<EventRecord | null>(null);
  const [eventRegistrations, setEventRegistrations] = useState<RegistrationRecord[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState('');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [posts, setPosts] = useState<OrganizationPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<OrganizationPost | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [eventsError, setEventsError] = useState('');
  const [postsError, setPostsError] = useState('');
  const [layoutsError, setLayoutsError] = useState('');
  const [initialEventLayout, setInitialEventLayout] = useState<StageLayout | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openEventCutoff] = useState(() => Date.now());
  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const currentMember = members.find(member => member.id === currentUser?.id);
  const canManageOrganization = Boolean(
    isOrganizer &&
    (currentMember?.status === 'OWNER' || currentMember?.membershipRole === 'ORGANIZER')
  );
  const currentOrganizationName = dashboardOrganization?.name ?? 'Your organization';
  const profileStorageKey = dashboardOrganization?.id ? `demetra.organizationProfile.${dashboardOrganization.id}` : '';
  const [profileOrganizationName, setProfileOrganizationName] = useState('');
  const [profileSubject, setProfileSubject] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<OrganizationMember | null>(null);

  useEffect(() => {
    if (currentUser?.organization) setDashboardOrganization(currentUser.organization);
  }, [currentUser?.organization]);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth) return;

    const eventsRequest = auth.user.role === 'ORGANIZER' ? listMyEvents(auth.token) : listEvents();
    eventsRequest
      .then(({ events }) => {
        const organizationId = auth.user.organization?.id ?? currentUser?.organization?.id;
        setEventRecords(auth.user.role === 'ORGANIZER' ? events : events.filter(event => !organizationId || event.organization?.id === organizationId));
        setEventsError('');
      })
      .catch((err) => {
        setEventsError(err instanceof Error ? err.message : 'Could not load events.');
      });

    fetchOrganization(auth.token)
      .then(({ organization, members, invitations }) => {
        setDashboardOrganization(organization);
        setMembers(members);
        setInvitations(invitations);
      })
      .catch(() => {
        setMembers([]);
        setInvitations([]);
      });

    listNotifications(auth.token)
      .then(({ notifications, unreadCount }) => {
        setNotifications(notifications);
        setUnreadCount(unreadCount);
      })
      .catch(() => {
        setNotifications([]);
        setUnreadCount(0);
      });

    listOrganizationPosts(auth.token)
      .then(({ posts }) => {
        setPosts(posts);
        setPostsError('');
      })
      .catch((err) => {
        setPosts([]);
        setPostsError(err instanceof Error ? err.message : 'Could not load news.');
      });

    listStageLayouts(auth.token)
      .then(({ layouts }) => {
        setLayouts(layouts);
        setLayoutsError('');
      })
      .catch((err) => {
        setLayouts([]);
        setLayoutsError(err instanceof Error ? err.message : 'Could not load stage layouts.');
      });
  }, [currentUser?.organization?.id]);

  useEffect(() => {
    if (!profileStorageKey) return;

    const saved = localStorage.getItem(profileStorageKey);
    if (!saved) {
      setProfileOrganizationName(currentOrganizationName);
      setProfileSubject('');
      setProfileLocation('');
      setProfileSaved(false);
      return;
    }

    try {
      const profile = JSON.parse(saved) as {
        organizationName?: string;
        subject?: string;
        location?: string;
      };
      setProfileOrganizationName(profile.organizationName || currentOrganizationName);
      setProfileSubject(profile.subject || '');
      setProfileLocation(profile.location || '');
      setProfileSaved(false);
    } catch {
      setProfileOrganizationName(currentOrganizationName);
      setProfileSubject('');
      setProfileLocation('');
      setProfileSaved(false);
    }
  }, [profileStorageKey, currentOrganizationName]);

  const refreshOrganization = () => {
    const auth = getStoredAuth();
    if (!auth) return;
    fetchOrganization(auth.token)
      .then(({ organization, members, invitations }) => {
        setDashboardOrganization(organization);
        setMembers(members);
        setInvitations(invitations);
      })
      .catch(() => undefined);
  };

  const markRead = (id: string) => {
    const auth = getStoredAuth();
    if (!auth) return;
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, status: 'READ', readAt: new Date().toISOString() } : item));
    setUnreadCount(count => Math.max(0, count - 1));
    markNotificationRead(auth.token, id).catch(() => undefined);
  };

  const markAllRead = () => {
    const auth = getStoredAuth();
    if (!auth) return;
    setNotifications(prev => prev.map(item => ({ ...item, status: 'READ', readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    markAllNotificationsRead(auth.token).catch(() => undefined);
  };

  const updateMemberRole = async (member: OrganizationMember, role: AuthRole) => {
    const auth = getStoredAuth();
    if (!auth || !canManageOrganization) return;
    try {
      await updateOrganizationMemberRole(auth.token, member.id, role);
      refreshOrganization();
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Could not update member role.');
    }
  };

  const makeOrganizer = (member: OrganizationMember) => updateMemberRole(member, 'ORGANIZER');

  const demoteOrganizer = (member: OrganizationMember) => updateMemberRole(member, 'STUDENT');

  const removeMember = async (member: OrganizationMember) => {
    const auth = getStoredAuth();
    if (!auth || !canManageOrganization || member.status === 'OWNER' || member.id === currentUser?.id) return;
    const confirmed = window.confirm(`Remove ${member.name} from ${currentOrganizationName}?`);
    if (!confirmed) return;

    const previousMembers = members;
    setMembers(prev => prev.filter(item => item.id !== member.id));

    try {
      await removeOrganizationMember(auth.token, member.id);
      refreshOrganization();
    } catch (err) {
      setMembers(previousMembers);
      setEventsError(err instanceof Error ? err.message : 'Could not remove member.');
    }
  };

  const saveLayout = async (l: StageLayout) => {
    const auth = getStoredAuth();
    if (!auth || !canManageOrganization) throw new Error('Log in as an organiser to save layouts.');

    const isExistingLayout = Boolean(editingLayout?.id);
    const { layout } = await persistStageLayout(auth.token, {
      ...(isExistingLayout ? { id: l.id } : {}),
      name: l.name,
      venue: l.venue,
      rows: l.rows,
      cols: l.cols,
      seats: l.seats,
      stageShape: l.stageShape,
    });

    setLayouts(prev => prev.find(x => x.id === layout.id) ? prev.map(x => x.id === layout.id ? layout : x) : [layout, ...prev]);
    setLayoutsError('');
    setShowBuilder(false);
    setEditingLayout(undefined);
  };

  const removeLayout = async (layoutId: string) => {
    const auth = getStoredAuth();
    if (!auth || !canManageOrganization) return;

    const previous = layouts;
    setLayouts(prev => prev.filter(x => x.id !== layoutId));
    setLayoutsError('');

    try {
      await deleteStageLayout(auth.token, layoutId);
    } catch (err) {
      setLayouts(previous);
      setLayoutsError(err instanceof Error ? err.message : 'Could not delete layout.');
    }
  };

  const openCreateEvent = (layout: StageLayout | null = null) => {
    setInitialEventLayout(layout);
    setEditingEvent(null);
    setShowCreate(true);
  };

  const closeCreateEvent = () => {
    setShowCreate(false);
    setInitialEventLayout(null);
    setEditingEvent(null);
  };

  const isEventEditable = (event: EventRecord) => {
    const startsAt = event.startsAt ? new Date(event.startsAt) : null;
    return event.status === 'PUBLISHED' && (!startsAt || startsAt.getTime() > openEventCutoff) && event.organizer?.id === currentUser?.id;
  };

  const openEditEvent = (eventId: string) => {
    const event = eventRecords.find(item => item.id === eventId);
    if (!event || !isEventEditable(event)) return;
    setInitialEventLayout(null);
    setEditingEvent(event);
    setShowCreate(true);
  };

  const handleCancelEvent = async (eventId: string) => {
    const auth = getStoredAuth();
    const event = eventRecords.find(item => item.id === eventId);
    if (!auth || !event || !isEventEditable(event)) return;
    if (!window.confirm(`Cancel "${event.title}"? Registered participants will be notified.`)) return;

    try {
      const { event: cancelled } = await cancelEvent(auth.token, eventId);
      setEventRecords(prev => prev.map(item => item.id === eventId ? cancelled : item));
      setEventsError('');
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Could not cancel event.');
    }
  };

  const openEventRegistrations = (eventId: string) => {
    const auth = getStoredAuth();
    const event = eventRecords.find(item => item.id === eventId);
    if (!auth || !event) return;

    setRegistrationEvent(event);
    setEventRegistrations([]);
    setRegistrationsError('');
    setRegistrationsLoading(true);

    listEventRegistrations(auth.token, eventId)
      .then(({ registrations }) => {
        setEventRegistrations(registrations);
        setRegistrationsError('');
      })
      .catch((err) => {
        setRegistrationsError(err instanceof Error ? err.message : 'Could not load registrations.');
      })
      .finally(() => setRegistrationsLoading(false));
  };

  const openPost = (postId: string) => {
    const existing = posts.find(post => post.id === postId);
    if (existing) {
      setSelectedPost(existing);
      setSection('news');
      return;
    }

    const auth = getStoredAuth();
    if (!auth) return;
    setSection('news');
    fetchOrganizationPost(auth.token, postId)
      .then(({ post }) => {
        setPosts(prev => prev.find(item => item.id === post.id) ? prev : [post, ...prev]);
        setSelectedPost(post);
        setPostsError('');
      })
      .catch((err) => {
        setPostsError(err instanceof Error ? err.message : 'Could not open post.');
      });
  };

  const addPost = (post: OrganizationPost) => {
    setPosts(prev => [post, ...prev.filter(item => item.id !== post.id)]);
    setSelectedPost(post);
    setSection('news');
    setPostsError('');
  };

  useEffect(() => {
    if (!openPostId) return;
    openPost(openPostId);
    onPostOpened?.();
  }, [openPostId]);

  const saveOrganizationProfile = () => {
    if (!profileStorageKey) return;

    localStorage.setItem(profileStorageKey, JSON.stringify({
      organizationName: profileOrganizationName.trim() || currentOrganizationName,
      subject: profileSubject.trim(),
      location: profileLocation.trim(),
    }));
    setProfileOrganizationName(profileOrganizationName.trim() || currentOrganizationName);
    setProfileSubject(profileSubject.trim());
    setProfileLocation(profileLocation.trim());
    setProfileSaved(true);
  };

  const dashboardEvents = eventRecords.map(mapDashboardEvent);

  const navItems = [
    { key: 'overview' as const, label: 'Overview', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
    )},
    { key: 'events' as const, label: 'My Events', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    { key: 'news' as const, label: 'News', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 6h6M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    { key: 'students' as const, label: 'Participants', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    ...(canManageOrganization ? [{ key: 'stages' as const, label: 'Stage Layouts', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5V3.5C4 2.67 4.67 2 5.5 2h5c.83 0 1.5.67 1.5 1.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )}] : []),
    { key: 'settings' as const, label: 'Settings', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
  ];

  const filteredMembers = members.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.membershipRole.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (!currentUser) {
    return null;
  }

  if (!dashboardOrganization) {
    return currentUser.role === 'ORGANIZER'
      ? <EmptyOrganizationDashboard currentUser={currentUser} onUserUpdated={onUserUpdated} />
      : null;
  }

  const organizationName = profileOrganizationName.trim() || currentOrganizationName;
  const organizationType = titleCaseEnum(dashboardOrganization?.kind);
  const organizationInitials = initials(organizationName);

  return (
    <>
      {canManageOrganization && showInvite && <InviteModal onClose={() => setShowInvite(false)} onCreated={(invite) => { setInvitations(prev => [invite, ...prev]); refreshOrganization(); }} />}
      {canManageOrganization && showPostComposer && <PostComposerModal onClose={() => setShowPostComposer(false)} onCreated={addPost} />}
      {canManageOrganization && showCreate && (
        <CreateEventModal
          layouts={layouts}
          initialLayout={initialEventLayout}
          existingEvent={editingEvent}
          onClose={closeCreateEvent}
          onSaved={(event) => setEventRecords(prev => editingEvent
            ? prev.map(item => item.id === event.id ? event : item)
            : [event, ...prev])}
        />
      )}
      {canManageOrganization && registrationEvent && (
        <EventRegistrationsModal
          event={registrationEvent}
          registrations={eventRegistrations}
          loading={registrationsLoading}
          error={registrationsError}
          onClose={() => setRegistrationEvent(null)}
        />
      )}
      {canManageOrganization && showBuilder && <StageBuilderModal onClose={() => { setShowBuilder(false); setEditingLayout(undefined); }} onSave={saveLayout} existing={editingLayout} />}

      <div className="dash-page page-transition-container">
        {/* Sidebar */}
        <aside className={`dash-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
          <div className="dash-org-card">
            <div className="dash-org-avatar">{organizationInitials}</div>
            {sidebarOpen && (
              <>
                <div className="dash-org-name">{organizationName}</div>
                <div className="dash-org-type">{organizationType}</div>
              </>
            )}
          </div>
          <nav className="dash-nav">
            {navItems.map(item => (
              <button key={item.key}
                className={`dash-nav-item ${section === item.key ? 'active' : ''}`}
                onClick={() => setSection(item.key)}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
          {canManageOrganization && sidebarOpen && (
            <button className="dash-invite-btn" onClick={() => setShowInvite(true)}>
              + Invite Members
            </button>
          )}
          <button className="dash-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d={sidebarOpen ? 'M9 2L4 7L9 12' : 'M5 2L10 7L5 12'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </aside>

        {/* Main */}
        <main className="dash-main">

          {/* Overview */}
          {section === 'overview' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div>
                  <div className="dash-breadcrumb">Dashboard / Overview</div>
                  <h1 className="dash-page-title">Welcome back, {currentUser.name}</h1>
                </div>
                {canManageOrganization && <button className="dash-create-btn" onClick={() => openCreateEvent()}>+ New Event</button>}
              </div>

              {/* Stats */}
              <div className="dash-stats-grid">
                {[
                  { icon: '🎓', value: members.length, label: 'Participants', sub: canManageOrganization ? `${invitations.filter(invite => invite.role === 'STUDENT').length} pending student invites` : 'In your organization', color: '#4f8ef7', bg: 'rgba(79,142,247,0.08)' },
                  { icon: '🎼', value: dashboardEvents.filter(event => event.status !== 'past').length, label: 'Active Events', sub: `${dashboardEvents.filter(event => event.status === 'full').length} fully booked`, color: '#e8aa2e', bg: 'rgba(232,170,46,0.08)' },
                  { icon: '🏛️', value: members.filter(member => member.status === 'OWNER' || member.membershipRole === 'ORGANIZER').length, label: 'Organizers', sub: organizationType, color: '#7c6df0', bg: 'rgba(124,109,240,0.08)' },
                  ...(canManageOrganization ? [{ icon: '✉️', value: invitations.length, label: 'Open Invites', sub: `${invitations.filter(invite => invite.email).length} email / ${invitations.filter(invite => !invite.email).length} link`, color: '#48bb78', bg: 'rgba(72,187,120,0.08)' }] : []),
                ].map(s => (
                  <div key={s.label} className="dash-stat-card" style={{ '--stat-color': s.color, '--stat-bg': s.bg } as any}>
                    <div className="dash-stat-icon-wrap">
                      <span className="dash-stat-icon">{s.icon}</span>
                    </div>
                    <div className="dash-stat-value">
                      <AnimatedNumber value={s.value} />
                    </div>
                    <div className="dash-stat-label">{s.label}</div>
                    <div className="dash-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="dash-overview-strip">
                <div>
                  <span>Organization</span>
                  <b>{organizationName}</b>
                </div>
                <div>
                  <span>Published capacity</span>
                  <b>{dashboardEvents.reduce((total, event) => total + event.capacity, 0)} seats</b>
                </div>
                <div>
                  <span>Confirmed registrations</span>
                  <b>{dashboardEvents.reduce((total, event) => total + event.registered, 0)} students</b>
                </div>
              </div>
              {/* Two-column layout below stats */}
              <div className="overview-grid">
                {/* Events card */}
                <div className="dash-content-card">
                  <div className="dash-section-header">
                    <h2 className="dash-section-title">{canManageOrganization ? 'Your Events' : 'Organization Events'}</h2>
                    <button className="dash-section-action" onClick={() => setSection('events')}>View all</button>
                  </div>
                  <div className="dash-events-list">
                    {eventsError && <div className="no-events-state">{eventsError}</div>}
                    {!eventsError && dashboardEvents.length === 0 && <div className="no-events-state">No events created yet.</div>}
                    {!eventsError && dashboardEvents.slice(0, 5).map(ev => {
                      const pct = Math.round((ev.registered / ev.capacity) * 100);
                      return (
                        <div key={ev.id} className="dash-event-row">
                          <div className="dash-event-row-left">
                            <div className="dash-event-row-dot" style={{ background: ev.color }} />
                            <div>
                              <div className="dash-event-row-title">{ev.title}</div>
                              <div className="dash-event-row-meta">{ev.category} / {ev.date}</div>
                            </div>
                          </div>
                          <div className="dash-event-row-right">
                            <div className="dash-mini-bar">
                              <div className="dash-mini-bar-fill" style={{ width: `${pct}%`, background: ev.color }} />
                            </div>
                            <div className="dash-event-row-cap">{ev.registered}/{ev.capacity}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stages card */}
                {canManageOrganization && <div className="dash-content-card">
                  <div className="dash-section-header">
                    <h2 className="dash-section-title">Stage Layouts</h2>
                    <button className="dash-section-action" onClick={() => setSection('stages')}>Manage</button>
                  </div>
                  <div className="overview-stages-list">
                    {layoutsError && <div className="no-events-state">{layoutsError}</div>}
                    {!layoutsError && layouts.length === 0 && <div className="no-events-state">No stage layouts yet.</div>}
                    {layouts.map(l => (
                      <div key={l.id} className="overview-stage-row">
                        <div className="overview-stage-thumb">
                          <svg viewBox="0 0 48 32" width="48" height="32">
                            {l.stageShape === 'arc' && <ellipse cx={24} cy={9} rx={18} ry={7} fill="rgba(167,154,14,0.2)" stroke="rgb(167,154,14)" strokeWidth={1} />}
                            {l.stageShape === 'rect' && <rect x={8} y={3} width={32} height={10} rx={1} fill="rgba(167,154,14,0.2)" stroke="rgb(167,154,14)" strokeWidth={1} />}
                            {Array.from({ length: Math.min(l.rows, 3) }, (_, r) =>
                              Array.from({ length: Math.min(l.cols, 8) }, (_, c) => (
                                <rect key={`${r}-${c}`} x={8 + c * 4} y={17 + r * 5} width={3} height={3} rx={0.5}
                                  fill="rgba(22,42,67,0.15)" />
                              ))
                            )}
                          </svg>
                        </div>
                        <div>
                          <div className="overview-stage-name">{l.name}</div>
                          <div className="overview-stage-meta">{l.rows * l.cols} seats / {l.stageShape}</div>
                        </div>
                        <div className="overview-stage-badge">{l.venue}</div>
                      </div>
                    ))}
                    {canManageOrganization && <button className="overview-stage-add" onClick={() => setShowBuilder(true)}>+ New layout</button>}
                  </div>
                </div>}

                {!canManageOrganization && (
                  <NotificationPane
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onMarkRead={markRead}
                    onMarkAllRead={markAllRead}
                    onOpenInvitation={onOpenInvitation}
                    onOpenPost={openPost}
                  />
                )}

                {/* Participants card */}
                <div className="dash-content-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="dash-section-header">
                    <h2 className="dash-section-title">Recent Participants</h2>
                    <button className="dash-section-action" onClick={() => setSection('students')}>View all</button>
                  </div>
                  <div className="dash-students-preview">
                    {members.slice(0, 6).map((s, index) => {
                      const color = EVENT_COLORS[index % EVENT_COLORS.length]!;
                      return (
                      <div key={s.id} className="dash-student-chip">
                        <div className="dash-student-avatar" style={{ background: `${color}22`, color, border: `1.5px solid ${color}44` }}>
                          {s.profile?.avatar ? <img src={s.profile.avatar} alt="" /> : memberInitials(s, s.profile)}
                        </div>
                        <div>
                          <div className="dash-student-chip-name">{s.name}</div>
                          <div className="dash-student-chip-inst">{memberRoleLabel(s)}</div>
                        </div>
                        {s.status === 'OWNER' && <div className="dash-pending-badge">Owner</div>}
                      </div>
                    );})}
                    {members.length === 0 && <div className="no-events-state">No members yet. Create an invitation to add students and teachers.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* My Events */}
          {section === 'events' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / My Events</div><h1 className="dash-page-title">My Events</h1></div>
                {canManageOrganization && <button className="dash-create-btn" onClick={() => openCreateEvent()}>+ New Event</button>}
              </div>
              <div className="dash-events-full-list">
                {eventsError && <div className="no-events-state">{eventsError}</div>}
                {!eventsError && dashboardEvents.length === 0 && <div className="no-events-state">No events created yet.</div>}
                {!eventsError && dashboardEvents.map(ev => {
                  const pct = Math.round((ev.registered / ev.capacity) * 100);
                  const originalEvent = eventRecords.find(item => item.id === ev.id);
                  const canEditEvent = originalEvent ? isEventEditable(originalEvent) : false;
                  return (
                    <div key={ev.id} className="dash-event-card-full" style={{ '--ev-color': ev.color } as any}>
                      <div className="dash-event-card-accent" style={{ background: ev.color }} />
                      <div className="dash-event-card-full-body">
                        <div className="dash-event-card-full-header">
                          <div>
                            <div className="dash-event-card-full-category" style={{ color: ev.color }}>{ev.category}</div>
                            <div className="dash-event-card-full-title">{ev.title}</div>
                            <div className="dash-event-card-full-date">{ev.date}</div>
                          </div>
                          <div className="dash-event-big-pct" style={{ color: ev.color }}>{pct}%</div>
                        </div>
                        <div className="capacity-bar-wrapper" style={{ marginTop: 16 }}>
                          <div className="capacity-bar-track">
                            <div className="capacity-bar-fill" style={{ width: `${pct}%`, background: ev.color }} />
                          </div>
                          <span className="capacity-pct-label">{ev.registered} / {ev.capacity}</span>
                        </div>
                        {canManageOrganization && <div className="dash-event-card-full-actions">
                          <button className="dash-action-btn" onClick={() => openEditEvent(ev.id)} disabled={!canEditEvent}>Edit</button>
                          <button className="dash-action-btn" onClick={() => openEventRegistrations(ev.id)}>Registrations</button>
                          <button className="dash-action-btn dash-action-btn--danger" onClick={() => handleCancelEvent(ev.id)} disabled={!canEditEvent}>Cancel</button>
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* News */}
          {section === 'news' && (
            <div className="dash-section-content">
              {selectedPost ? (
                <>
                  <div className="dash-page-header">
                    <div>
                      <div className="dash-breadcrumb">Dashboard / News</div>
                      <h1 className="dash-page-title">{selectedPost.title}</h1>
                    </div>
                    <button className="dash-create-btn" onClick={() => setSelectedPost(null)}>Back to News</button>
                  </div>
                  <div className="dash-post-detail">
                    <div className="dash-post-detail-meta">
                      Posted by {selectedPost.author?.name ?? 'Organizer'} / {new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(selectedPost.createdAt))}
                    </div>
                    <div className="dash-post-detail-body">
                      {selectedPost.body.split(/\n{2,}/).map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="dash-page-header">
                    <div><div className="dash-breadcrumb">Dashboard / News</div><h1 className="dash-page-title">News</h1></div>
                    {canManageOrganization && <button className="dash-create-btn" onClick={() => setShowPostComposer(true)}>+ New Post</button>}
                  </div>
                  <div className="dash-events-full-list">
                    {postsError && <div className="no-events-state">{postsError}</div>}
                    {!postsError && posts.length === 0 && <div className="no-events-state">No news posts yet.</div>}
                    {!postsError && posts.map((post, index) => {
                      const color = EVENT_COLORS[index % EVENT_COLORS.length]!;
                      return (
                        <button key={post.id} type="button" className="dash-event-card-full dash-post-card" onClick={() => setSelectedPost(post)} style={{ '--ev-color': color } as any}>
                          <div className="dash-event-card-accent" style={{ background: color }} />
                          <div className="dash-event-card-full-body">
                            <div className="dash-event-card-full-header">
                              <div>
                                <div className="dash-event-card-full-category" style={{ color }}>News</div>
                                <div className="dash-event-card-full-title">{post.title}</div>
                                <div className="dash-event-card-full-date">
                                  {post.author?.name ?? 'Organizer'} / {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(post.createdAt))}
                                </div>
                              </div>
                            </div>
                            <p className="dash-post-preview">{post.body}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Participants */}
          {section === 'students' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / Participants</div><h1 className="dash-page-title">Participants</h1></div>
                {canManageOrganization && <button className="dash-create-btn" onClick={() => setShowInvite(true)}>+ Invite</button>}
              </div>
              <div className="dash-content-card">
                <div className="search-box" style={{ marginBottom: 24, width: '100%', maxWidth: 360 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#a0aec0" strokeWidth="1.4"/><path d="M9.5 9.5L12 12" stroke="#a0aec0" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  <input type="text" placeholder="Search members by name, email, or role..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                </div>
                <div className="students-grid">
                  {filteredMembers.map((s, index) => {
                    const color = EVENT_COLORS[index % EVENT_COLORS.length]!;
                    return (
                    <div key={s.id} className="student-card" style={{ '--s-color': color } as any}>
                      <div className="student-card-avatar" style={{ background: `${color}18`, color, border: `2px solid ${color}33` }}>
                        {s.profile?.avatar ? <img src={s.profile.avatar} alt="" /> : memberInitials(s, s.profile)}
                      </div>
                      <button type="button" className="member-profile-menu-btn" onClick={() => setSelectedMemberProfile(s)} aria-label={`View ${s.name} profile`} title="View profile">
                        <MoreHorizontal size={16} />
                      </button>
                      <div className="student-card-info">
                        <div className="student-card-name">{s.name}</div>
                        <div className="student-card-inst">{s.email}</div>
                        <div className="student-card-year">{memberRoleLabel(s)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                        <span className={`dash-status-chip ${s.status === 'OWNER' ? 'active' : 'active'}`}>{s.status === 'OWNER' ? 'Owner' : 'Active'}</span>
                        <span className="member-joined-date">Joined {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(s.joinedAt))}</span>
                        {canManageOrganization && s.role === 'ORGANIZER' && s.membershipRole !== 'ORGANIZER' && s.status !== 'OWNER' && (
                          <button type="button" className="dash-action-btn" onClick={() => makeOrganizer(s)}>Make organizer</button>
                        )}
                        {canManageOrganization && s.membershipRole === 'ORGANIZER' && s.status !== 'OWNER' && s.id !== currentUser?.id && (
                          <button type="button" className="dash-action-btn dash-action-btn--danger" onClick={() => demoteOrganizer(s)}>Demote to teacher</button>
                        )}
                        {canManageOrganization && s.status !== 'OWNER' && s.id !== currentUser?.id && (
                          <button type="button" className="dash-action-btn dash-action-btn--danger" onClick={() => removeMember(s)}>Remove</button>
                        )}
                      </div>
                    </div>
                  );})}
                  {filteredMembers.length === 0 && <div className="no-events-state">No members found.</div>}
                </div>
                {canManageOrganization && invitations.length > 0 && (
                  <div className="pending-invites-panel">
                    <div className="invite-label">Pending invitations</div>
                    {invitations.map(invite => (
                      <div key={invite.id} className="pending-invite-row">
                        <span>{invite.email ?? 'Open link'}</span>
                        <b>{invite.role === 'ORGANIZER' ? 'Teacher' : 'Student'}</b>
                        <em>Expires {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(invite.expiresAt))}</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage Layouts */}
          {section === 'stages' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / Stage Layouts</div><h1 className="dash-page-title">Stage Layouts</h1></div>
                <button className="dash-create-btn" onClick={() => { setEditingLayout(undefined); setShowBuilder(true); }}>+ New Layout</button>
              </div>
              {layoutsError && <div className="auth-error" style={{ marginBottom: 16 }}>{layoutsError}</div>}
              <div className="stages-grid">
                {!layoutsError && layouts.length === 0 && <div className="no-events-state">No stage layouts yet. Create one to use it when publishing events.</div>}
                {layouts.map(l => (
                  <div key={l.id} className="stage-layout-card">
                    <div className="stage-layout-card-header">
                      <div>
                        <div className="stage-layout-name">{l.name}</div>
                        <div className="stage-layout-meta">{l.venue} / {l.rows * l.cols} seats / {l.stageShape} stage</div>
                      </div>
                      <div className="stage-layout-date">Added {l.createdAt}</div>
                    </div>
                    <div className="stage-layout-preview">
                      <SeatMap layout={l} editable={false} />
                    </div>
                    <div className="stage-layout-actions">
                      <button className="dash-action-btn" onClick={() => { setEditingLayout(l); setShowBuilder(true); }}>Edit layout</button>
                      <button className="dash-action-btn" onClick={() => openCreateEvent(l)}>Use in new event</button>
                      <button className="dash-action-btn dash-action-btn--danger" onClick={() => removeLayout(l.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          {section === 'settings' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / Settings</div><h1 className="dash-page-title">Organisation Settings</h1></div>
              </div>
              <div className="settings-profile-grid">
                <div className="dash-content-card">
                  <h2 className="dash-section-title" style={{ marginBottom: 16 }}>Organisation Profile</h2>
                  <div className="dash-settings-form">
                    <div className="form-group">
                      <label>Organisation Name</label>
                      <input
                        type="text"
                        value={profileOrganizationName}
                        onChange={(e) => { setProfileOrganizationName(e.target.value); setProfileSaved(false); }}
                        placeholder="Your studio or school name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Primary interest or subject</label>
                      <input
                        type="text"
                        value={profileSubject}
                        onChange={(e) => { setProfileSubject(e.target.value); setProfileSaved(false); }}
                        placeholder="Piano, music theory, choir..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Teaching location</label>
                      <input
                        type="text"
                        value={profileLocation}
                        onChange={(e) => { setProfileLocation(e.target.value); setProfileSaved(false); }}
                        placeholder="Sofia, online, school studio..."
                      />
                    </div>
                    <div className="form-group"><label>Type</label><input type="text" value={organizationType} readOnly /></div>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button className="dash-create-btn" onClick={saveOrganizationProfile}>Save organisation profile</button>
                    {profileSaved && <span className="dash-status-chip active">Saved</span>}
                  </div>
                </div>
                <div className="dash-content-card">
                  <h2 className="dash-section-title" style={{ marginBottom: 16 }}>Admin Account</h2>
                  <div className="dash-settings-form">
                    <div className="form-group"><label>Your Name</label><input type="text" defaultValue={currentUser.name} /></div>
                    <div className="form-group"><label>Email</label><input type="email" defaultValue={currentUser.email} /></div>
                  </div>
                  <div style={{ marginTop: 16 }}><button className="dash-create-btn">Save changes</button></div>
                </div>
                <NotificationPane
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkRead={markRead}
                  onMarkAllRead={markAllRead}
                  onOpenInvitation={onOpenInvitation}
                  onOpenPost={openPost}
                />
              </div>
            </div>
          )}
        </main>
      </div>
      {selectedMemberProfile && <ProfileModal member={selectedMemberProfile} onClose={() => setSelectedMemberProfile(null)} />}
    </>
  );
}





