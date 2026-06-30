﻿import { useState, useEffect } from 'react';
import { createEvent, getStoredAuth, listMyEvents, type AuthUser, type EventRecord } from './api';

interface DashboardProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard' | 'instruments') => void;
  currentUser: AuthUser | null;
}

// в”Ђв”Ђ Types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
type SeatStatus = 'available' | 'taken' | 'selected' | 'vip' | 'blocked';
interface Seat { id: string; row: number; col: number; status: SeatStatus; }
interface StageLayout { id: string; name: string; venue: string; rows: number; cols: number; seats: Seat[]; stageShape: 'rect' | 'arc' | 'thrust'; createdAt: string; }

// в”Ђв”Ђ Mock Data в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

const MOCK_STUDENTS = [
  { id: 1, name: 'Anna Kostadinova', instrument: 'Violin', year: 3, email: 'anna.k@students.nma.bg', status: 'active', color: '#4f8ef7' },
  { id: 2, name: 'Hristo Nikolov', instrument: 'Voice (Baritone)', year: 4, email: 'h.nikolov@students.nma.bg', status: 'active', color: '#7c6df0' },
  { id: 3, name: 'Galina Todorova', instrument: 'Piano', year: 2, email: 'g.todorova@students.nma.bg', status: 'active', color: '#38b2ac' },
  { id: 4, name: 'Dimitar Petrov', instrument: 'Piano', year: 3, email: 'd.petrov@students.nma.bg', status: 'active', color: '#e8aa2e' },
  { id: 5, name: 'Maria Georgieva', instrument: 'Piano', year: 1, email: 'm.georgieva@students.nma.bg', status: 'pending', color: '#e05c5c' },
  { id: 6, name: 'Teodora Ivanova', instrument: 'Piano', year: 2, email: 't.ivanova@students.nma.bg', status: 'active', color: '#48bb78' },
  { id: 7, name: 'Stefan Dimitrov', instrument: 'Cello', year: 4, email: 's.dimitrov@students.nma.bg', status: 'active', color: '#ed8936' },
  { id: 8, name: 'Nikoleta Popova', instrument: 'Flute', year: 1, email: 'n.popova@students.nma.bg', status: 'pending', color: '#b794f4' },
];

const INITIAL_LAYOUTS: StageLayout[] = [
  {
    id: 'layout-1', name: 'Grand Hall', venue: 'Main Concert Hall', rows: 10, cols: 16,
    stageShape: 'arc', createdAt: '2026-01-15',
    seats: Array.from({ length: 10 }, (_, r) => Array.from({ length: 16 }, (_, c) => ({
      id: `${r}-${c}`, row: r, col: c,
      status: (r < 3 && (c < 2 || c > 13)) ? 'blocked' : (r === 0 && c >= 4 && c <= 11) ? 'vip' : 'available'
    } as Seat))).flat()
  },
  {
    id: 'layout-2', name: 'Studio B', venue: 'Intimate Studio', rows: 4, cols: 8,
    stageShape: 'rect', createdAt: '2026-02-20',
    seats: Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) => ({
      id: `${r}-${c}`, row: r, col: c, status: 'available'
    } as Seat))).flat()
  },
];

function buildSeats(rows: number, cols: number): Seat[] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ id: `${r}-${c}`, row: r, col: c, status: 'available' as SeatStatus }))
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
    registered,
    capacity,
    status: isPast ? 'past' : isFull ? 'full' : 'open',
    category: event.category ?? 'Event',
    color: EVENT_COLORS[index % EVENT_COLORS.length]!,
  };
}

// в”Ђв”Ђ Animated Counter в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

// в”Ђв”Ђ Interactive Seat Map в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function SeatMap({ layout, editable = false, onUpdate }: {
  layout: StageLayout;
  editable?: boolean;
  onUpdate?: (seats: Seat[]) => void;
}) {
  const [seats, setSeats] = useState<Seat[]>(layout.seats);
  const [paintMode, setPaintMode] = useState<SeatStatus>('available');
  const [isPainting, setIsPainting] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

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
                  setTooltip({ x: e.clientX, y: e.clientY, text: `Row ${String.fromCharCode(65 + seat.row)}, Seat ${seat.col + 1} В· ${seat.status}` });
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

// в”Ђв”Ђ Stage Layout Builder Modal в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function StageBuilderModal({ onClose, onSave, existing }: {
  onClose: () => void;
  onSave: (layout: StageLayout) => void;
  existing?: StageLayout;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [rows, setRows] = useState(existing?.rows ?? 8);
  const [cols, setCols] = useState(existing?.cols ?? 12);
  const [shape, setShape] = useState<'rect' | 'arc' | 'thrust'>(existing?.stageShape ?? 'rect');
  const [seats, setSeats] = useState<Seat[]>(existing?.seats ?? buildSeats(8, 12));

  useEffect(() => {
    setSeats(buildSeats(rows, cols));
  }, [rows, cols]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: existing?.id ?? `layout-${Date.now()}`,
      name, venue, rows, cols, seats, stageShape: shape,
      createdAt: existing?.createdAt ?? new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{existing ? 'Edit Layout' : 'Create Stage Layout'}</h3>
          <button className="modal-close" onClick={onClose}>вњ•</button>
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
            <div className="builder-preview-label">Live Preview вЂ” paint seat types</div>
            <SeatMap
              layout={{ id: 'preview', name, venue, rows, cols, seats, stageShape: shape, createdAt: '' }}
              editable
              onUpdate={setSeats}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {existing ? 'Save changes' : 'Save layout'}
          </button>
        </div>
      </div>
    </div>
  );
}

// в”Ђв”Ђ Create Event Modal в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function CreateEventModal({ layouts, initialLayout, onClose, onCreated }: {
  layouts: StageLayout[];
  initialLayout: StageLayout | null;
  onClose: () => void;
  onCreated: (event: EventRecord) => void;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Concert');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState(initialLayout?.venue ?? '');
  const [selectedLayout, setSelectedLayout] = useState<StageLayout | null>(initialLayout);
  const [capacity, setCapacity] = useState(initialLayout ? initialLayout.seats.filter(seat => seat.status !== 'blocked').length : 120);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
      const { event } = await createEvent(auth.token, {
        title: title.trim(),
        description: description.trim(),
        category,
        startsAt,
        location: location.trim(),
        capacity,
      });
      onCreated(event);
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
          <h3 className="modal-title">Create New Event</h3>
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
              {layouts.map(l => (
                <button key={l.id} type="button" className={`layout-select-card ${selectedLayout?.id === l.id ? 'selected' : ''}`} onClick={() => { setSelectedLayout(l); setLocation(l.venue); setCapacity(l.seats.filter(seat => seat.status !== 'blocked').length); }}>
                  <div className="layout-select-name">{l.name}</div>
                  <div className="layout-select-meta">{l.venue} · {l.seats.filter(seat => seat.status !== 'blocked').length} usable seats</div>
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
              <div className="preview-meta">{date || 'Date TBA'} {time ? `· ${time}` : ''}</div>
              <div className="preview-meta">{location || 'Location TBA'} · {capacity} seats</div>
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
            <button className="modal-btn-primary" onClick={submit} disabled={!canPublish || saving}>{saving ? 'Publishing...' : 'Publish event'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
function InviteModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Invite Students</h3>
          <button className="modal-close" onClick={onClose}>вњ•</button>
        </div>
        <div className="invite-section">
          <div className="invite-label">Invitation link</div>
          <div className="invite-copy-row">
            <div className="invite-value">https://demetra.music/join/nma_sofia_2026</div>
            <button className={`invite-copy-btn ${copied === 'link' ? 'copied' : ''}`} onClick={() => { setCopied('link'); setTimeout(() => setCopied(null), 2000); }}>
              {copied === 'link' ? 'вњ“ Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="invite-section">
          <div className="invite-label">Invitation code</div>
          <div className="invite-copy-row">
            <div className="invite-value invite-code">NMA-2026-XK7</div>
            <button className={`invite-copy-btn ${copied === 'code' ? 'copied' : ''}`} onClick={() => { setCopied('code'); setTimeout(() => setCopied(null), 2000); }}>
              {copied === 'code' ? 'вњ“ Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="invite-section">
          <div className="invite-label">Send by email</div>
          <div className="invite-email-row">
            <input type="email" placeholder="student@school.edu" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="invite-email-input" onKeyDown={e => { if (e.key === 'Enter' && emailInput.trim()) { setSent(true); setEmailInput(''); setTimeout(() => setSent(false), 2500); }}} />
            <button className="invite-send-btn" onClick={() => { if (emailInput.trim()) { setSent(true); setEmailInput(''); setTimeout(() => setSent(false), 2500); }}}>
              {sent ? 'вњ“ Sent' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// в”Ђв”Ђ Dashboard в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
export default function Dashboard({ onNavigate: _onNavigate, currentUser }: DashboardProps) {
  const [section, setSection] = useState<'overview' | 'events' | 'students' | 'stages' | 'settings'>('overview');
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingLayout, setEditingLayout] = useState<StageLayout | undefined>();
  const [layouts, setLayouts] = useState<StageLayout[]>(INITIAL_LAYOUTS);
  const [eventRecords, setEventRecords] = useState<EventRecord[]>([]);
  const [eventsError, setEventsError] = useState('');
  const [initialEventLayout, setInitialEventLayout] = useState<StageLayout | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth || auth.user.role !== 'ORGANIZER') return;

    listMyEvents(auth.token)
      .then(({ events }) => {
        setEventRecords(events);
        setEventsError('');
      })
      .catch((err) => {
        setEventsError(err instanceof Error ? err.message : 'Could not load events.');
      });
  }, []);

  const saveLayout = (l: StageLayout) => {
    setLayouts(prev => prev.find(x => x.id === l.id) ? prev.map(x => x.id === l.id ? l : x) : [...prev, l]);
    setShowBuilder(false);
    setEditingLayout(undefined);
  };

  const openCreateEvent = (layout: StageLayout | null = null) => {
    setInitialEventLayout(layout);
    setShowCreate(true);
  };

  const closeCreateEvent = () => {
    setShowCreate(false);
    setInitialEventLayout(null);
  };

  const dashboardEvents = eventRecords.map(mapDashboardEvent);

  const navItems = [
    { key: 'overview' as const, label: 'Overview', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
    )},
    { key: 'events' as const, label: 'My Events', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    { key: 'students' as const, label: 'Students', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    { key: 'stages' as const, label: 'Stage Layouts', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5V3.5C4 2.67 4.67 2 5.5 2h5c.83 0 1.5.67 1.5 1.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
    { key: 'settings' as const, label: 'Settings', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    )},
  ];

  const filteredStudents = MOCK_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.instrument.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (!currentUser || currentUser.role !== 'ORGANIZER') {
    return null;
  }

  const organizationName = currentUser.organization?.name ?? 'Your organization';
  const organizationType = titleCaseEnum(currentUser.organization?.kind);
  const organizationInitials = initials(organizationName);

  return (
    <>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {showCreate && (
        <CreateEventModal
          layouts={layouts}
          initialLayout={initialEventLayout}
          onClose={closeCreateEvent}
          onCreated={(event) => setEventRecords(prev => [event, ...prev])}
        />
      )}
      {showBuilder && <StageBuilderModal onClose={() => { setShowBuilder(false); setEditingLayout(undefined); }} onSave={saveLayout} existing={editingLayout} />}

      <div className="dash-page page-transition-container">
        {/* в”Ђв”Ђ Sidebar в”Ђв”Ђ */}
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
          {sidebarOpen && (
            <button className="dash-invite-btn" onClick={() => setShowInvite(true)}>
              + Invite Students
            </button>
          )}
          <button className="dash-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d={sidebarOpen ? 'M9 2L4 7L9 12' : 'M5 2L10 7L5 12'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </aside>

        {/* в”Ђв”Ђ Main в”Ђв”Ђ */}
        <main className="dash-main">

          {/* в•ђв•ђв•ђ OVERVIEW в•ђв•ђв•ђ */}
          {section === 'overview' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div>
                  <div className="dash-breadcrumb">Dashboard / Overview</div>
                  <h1 className="dash-page-title">Welcome back, {currentUser.name}</h1>
                </div>
                <button className="dash-create-btn" onClick={() => openCreateEvent()}>+ New Event</button>
              </div>

              {/* Stats */}
              <div className="dash-stats-grid">
                {[
                  { icon: '🎓', value: 47, label: 'Students', sub: '3 pending invites', color: '#4f8ef7', bg: 'rgba(79,142,247,0.08)' },
                  { icon: '🎼', value: dashboardEvents.filter(event => event.status !== 'past').length, label: 'Active Events', sub: `${dashboardEvents.filter(event => event.status === 'full').length} fully booked`, color: '#e8aa2e', bg: 'rgba(232,170,46,0.08)' },
                  { icon: '🏛️', value: 1, label: 'Organization', sub: organizationType, color: '#7c6df0', bg: 'rgba(124,109,240,0.08)' },
                  { icon: '✉️', value: 3, label: 'Open Invites', sub: '2 email · 1 link', color: '#48bb78', bg: 'rgba(72,187,120,0.08)' },
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

              {/* Two-column layout below stats */}
              <div className="overview-grid">
                {/* Events card */}
                <div className="dash-content-card">
                  <div className="dash-section-header">
                    <h2 className="dash-section-title">Your Events</h2>
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
                <div className="dash-content-card">
                  <div className="dash-section-header">
                    <h2 className="dash-section-title">Stage Layouts</h2>
                    <button className="dash-section-action" onClick={() => setSection('stages')}>Manage</button>
                  </div>
                  <div className="overview-stages-list">
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
                    <button className="overview-stage-add" onClick={() => setShowBuilder(true)}>+ New layout</button>
                  </div>
                </div>

                {/* Students card */}
                <div className="dash-content-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="dash-section-header">
                    <h2 className="dash-section-title">Recent Students</h2>
                    <button className="dash-section-action" onClick={() => setSection('students')}>View all</button>
                  </div>
                  <div className="dash-students-preview">
                    {MOCK_STUDENTS.slice(0, 6).map(s => (
                      <div key={s.id} className="dash-student-chip">
                        <div className="dash-student-avatar" style={{ background: `${s.color}22`, color: s.color, border: `1.5px solid ${s.color}44` }}>
                          {s.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="dash-student-chip-name">{s.name}</div>
                          <div className="dash-student-chip-inst">{s.instrument}</div>
                        </div>
                        {s.status === 'pending' && <div className="dash-pending-badge">Pending</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* в•ђв•ђв•ђ MY EVENTS в•ђв•ђв•ђ */}
          {section === 'events' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / My Events</div><h1 className="dash-page-title">My Events</h1></div>
                <button className="dash-create-btn" onClick={() => openCreateEvent()}>+ New Event</button>
              </div>
              <div className="dash-events-full-list">
                {eventsError && <div className="no-events-state">{eventsError}</div>}
                {!eventsError && dashboardEvents.length === 0 && <div className="no-events-state">No events created yet.</div>}
                {!eventsError && dashboardEvents.map(ev => {
                  const pct = Math.round((ev.registered / ev.capacity) * 100);
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
                        <div className="dash-event-card-full-actions">
                          <button className="dash-action-btn">Edit</button>
                          <button className="dash-action-btn">Registrations</button>
                          <button className="dash-action-btn dash-action-btn--danger">{ev.status === 'past' ? 'Archive' : 'Cancel'}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* в•ђв•ђв•ђ STUDENTS в•ђв•ђв•ђ */}
          {section === 'students' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / Students</div><h1 className="dash-page-title">Students</h1></div>
                <button className="dash-create-btn" onClick={() => setShowInvite(true)}>+ Invite</button>
              </div>
              <div className="dash-content-card">
                <div className="search-box" style={{ marginBottom: 24, width: '100%', maxWidth: 360 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#a0aec0" strokeWidth="1.4"/><path d="M9.5 9.5L12 12" stroke="#a0aec0" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  <input type="text" placeholder="Search students or instruments..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                </div>
                <div className="students-grid">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="student-card" style={{ '--s-color': s.color } as any}>
                      <div className="student-card-avatar" style={{ background: `${s.color}18`, color: s.color, border: `2px solid ${s.color}33` }}>
                        {s.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="student-card-info">
                        <div className="student-card-name">{s.name}</div>
                        <div className="student-card-inst">{s.instrument}</div>
                        <div className="student-card-year">Year {s.year}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                        <span className={`dash-status-chip ${s.status}`}>{s.status === 'pending' ? 'Pending' : 'Active'}</span>
                        <button className="dash-action-btn" style={{ padding: '3px 10px', fontSize: 11, marginLeft: 'auto' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* в•ђв•ђв•ђ STAGE LAYOUTS в•ђв•ђв•ђ */}
          {section === 'stages' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / Stage Layouts</div><h1 className="dash-page-title">Stage Layouts</h1></div>
                <button className="dash-create-btn" onClick={() => { setEditingLayout(undefined); setShowBuilder(true); }}>+ New Layout</button>
              </div>
              <div className="stages-grid">
                {layouts.map(l => (
                  <div key={l.id} className="stage-layout-card">
                    <div className="stage-layout-card-header">
                      <div>
                        <div className="stage-layout-name">{l.name}</div>
                        <div className="stage-layout-meta">{l.venue} В· {l.rows * l.cols} seats / {l.stageShape} stage</div>
                      </div>
                      <div className="stage-layout-date">Added {l.createdAt}</div>
                    </div>
                    <div className="stage-layout-preview">
                      <SeatMap layout={l} editable={false} />
                    </div>
                    <div className="stage-layout-actions">
                      <button className="dash-action-btn" onClick={() => { setEditingLayout(l); setShowBuilder(true); }}>Edit layout</button>
                      <button className="dash-action-btn" onClick={() => openCreateEvent(l)}>Use in new event</button>
                      <button className="dash-action-btn dash-action-btn--danger" onClick={() => setLayouts(prev => prev.filter(x => x.id !== l.id))}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* в•ђв•ђв•ђ SETTINGS в•ђв•ђв•ђ */}
          {section === 'settings' && (
            <div className="dash-section-content">
              <div className="dash-page-header">
                <div><div className="dash-breadcrumb">Dashboard / Settings</div><h1 className="dash-page-title">Organisation Settings</h1></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="dash-content-card">
                  <h2 className="dash-section-title" style={{ marginBottom: 16 }}>Organisation Profile</h2>
                  <div className="dash-settings-form">
                    <div className="form-group"><label>Organisation Name</label><input type="text" defaultValue={organizationName} /></div>
                    <div className="form-group"><label>Type</label><input type="text" defaultValue={organizationType} /></div>
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
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}