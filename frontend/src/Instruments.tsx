import { useState, useEffect, useRef, useCallback } from 'react';

interface InstrumentsProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard' | 'instruments') => void;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Note { id: string; title: string; content: string; instrument: string; createdAt: string; shared: boolean; sharedWith: string[]; }
type InstrumentId = 'piano' | 'violin' | 'guitar' | 'flute' | 'drums';

// ── Instrument Definitions ────────────────────────────────────────────────────
const INSTRUMENTS: { id: InstrumentId; label: string; emoji: string; roman: string; desc: string; }[] = [
  { id: 'piano',  label: 'Piano',  emoji: '🎹', roman: 'I',   desc: 'Classical keyboard, full range' },
  { id: 'violin', label: 'Violin', emoji: '🎻', roman: 'II',  desc: 'Bowed string, soprano register' },
  { id: 'guitar', label: 'Guitar', emoji: '🎸', roman: 'III', desc: 'Plucked string, versatile' },
  { id: 'flute',  label: 'Flute',  emoji: '🪈', roman: 'IV',  desc: 'Woodwind, bright and airy' },
  { id: 'drums',  label: 'Drums',  emoji: '🥁', roman: 'V',   desc: 'Percussion, rhythm section' },
];

// ── Audio engine (Web Audio API) ─────────────────────────────────────────────
function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  const playNote = useCallback((freq: number, instrument: InstrumentId, duration = 0.8) => {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (instrument === 'piano') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle'; osc1.frequency.value = freq;
      osc2.type = 'sine'; osc2.frequency.value = freq * 2.01;
      osc1.connect(gain); osc2.connect(gain);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc1.start(now); osc2.start(now);
      osc1.stop(now + duration); osc2.stop(now + duration);
    } else if (instrument === 'violin') {
      const osc = ctx.createOscillator();
      const vibLfo = ctx.createOscillator();
      const vibGain = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = freq;
      vibLfo.type = 'sine'; vibLfo.frequency.value = 5;
      vibGain.gain.value = 3;
      vibLfo.connect(vibGain); vibGain.connect(osc.frequency);
      osc.connect(gain);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
      gain.gain.setValueAtTime(0.25, now + duration - 0.1);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      vibLfo.start(now); osc.start(now);
      vibLfo.stop(now + duration); osc.stop(now + duration);
    } else if (instrument === 'guitar') {
      const bufSize = ctx.sampleRate * duration;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      const N = Math.round(ctx.sampleRate / freq);
      for (let i = 0; i < N; i++) data[i] = (Math.random() * 2 - 1);
      for (let i = N; i < bufSize; i++) data[i] = 0.5 * (data[i - N] + data[i - N + 1]);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(gain);
      gain.gain.value = 0.6;
      src.start(now); src.stop(now + duration);
    } else if (instrument === 'flute') {
      const osc = ctx.createOscillator();
      const noise = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      noise.type = 'sine'; noise.frequency.value = freq * 1.5;
      const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.04;
      noise.connect(noiseGain); noiseGain.connect(gain); osc.connect(gain);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.start(now); noise.start(now); osc.stop(now + duration); noise.stop(now + duration);
    } else if (instrument === 'drums') {
      const bufSize = Math.round(ctx.sampleRate * 0.3);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.1));
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(gain);
      gain.gain.value = 0.5;
      src.start(now);
    }
  }, []);

  return { playNote };
}

// ── Note frequencies ──────────────────────────────────────────────────────────
const PIANO_KEYS = [
  { note: 'C4', freq: 261.63, label: 'C', isBlack: false },
  { note: 'C#4', freq: 277.18, label: 'C#', isBlack: true },
  { note: 'D4', freq: 293.66, label: 'D', isBlack: false },
  { note: 'D#4', freq: 311.13, label: 'D#', isBlack: true },
  { note: 'E4', freq: 329.63, label: 'E', isBlack: false },
  { note: 'F4', freq: 349.23, label: 'F', isBlack: false },
  { note: 'F#4', freq: 369.99, label: 'F#', isBlack: true },
  { note: 'G4', freq: 392.00, label: 'G', isBlack: false },
  { note: 'G#4', freq: 415.30, label: 'G#', isBlack: true },
  { note: 'A4', freq: 440.00, label: 'A', isBlack: false },
  { note: 'A#4', freq: 466.16, label: 'A#', isBlack: true },
  { note: 'B4', freq: 493.88, label: 'B', isBlack: false },
  { note: 'C5', freq: 523.25, label: 'C', isBlack: false },
  { note: 'D5', freq: 587.33, label: 'D', isBlack: false },
  { note: 'E5', freq: 659.25, label: 'E', isBlack: false },
];

const GUITAR_STRINGS = [
  { note: 'E2', freq: 82.41, label: '6th E', color: '#e05c5c' },
  { note: 'A2', freq: 110.00, label: '5th A', color: '#e8aa2e' },
  { note: 'D3', freq: 146.83, label: '4th D', color: '#48bb78' },
  { note: 'G3', freq: 196.00, label: '3rd G', color: '#4f8ef7' },
  { note: 'B3', freq: 246.94, label: '2nd B', color: '#7c6df0' },
  { note: 'E4', freq: 329.63, label: '1st E', color: '#f687b3' },
];

const VIOLIN_STRINGS = [
  { note: 'G3', freq: 196.00, label: 'G' },
  { note: 'D4', freq: 293.66, label: 'D' },
  { note: 'A4', freq: 440.00, label: 'A' },
  { note: 'E5', freq: 659.25, label: 'E' },
];

const FLUTE_NOTES = [
  { note: 'D5', freq: 587.33, label: 'D' },
  { note: 'E5', freq: 659.25, label: 'E' },
  { note: 'F5', freq: 698.46, label: 'F' },
  { note: 'G5', freq: 783.99, label: 'G' },
  { note: 'A5', freq: 880.00, label: 'A' },
  { note: 'B5', freq: 987.77, label: 'B' },
  { note: 'C6', freq: 1046.50, label: 'C' },
];

const DRUM_PADS = [
  { label: 'Kick', freq: 60, color: '#e05c5c', key: 'q' },
  { label: 'Snare', freq: 200, color: '#e8aa2e', key: 'w' },
  { label: 'Hi-Hat', freq: 800, color: '#48bb78', key: 'e' },
  { label: 'Tom 1', freq: 120, color: '#4f8ef7', key: 'a' },
  { label: 'Tom 2', freq: 100, color: '#7c6df0', key: 's' },
  { label: 'Crash', freq: 1200, color: '#f687b3', key: 'd' },
  { label: 'Ride', freq: 600, color: '#ed8936', key: 'r' },
  { label: 'Open HH', freq: 700, color: '#38b2ac', key: 'f' },
];

// ── Fullscreen Piano (extended range, keyboard shortcuts) ─────────────────────
const MIDI_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiFreq(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m: number) { return MIDI_NOTE_NAMES[((m % 12) + 12) % 12] + Math.floor(m / 12 - 1); }

const KEY_OFFSET: Record<string, number> = { a:0, w:1, s:2, e:3, d:4, f:5, t:6, g:7, y:8, h:9, u:10, j:11, k:12 };
const WHITE_HINT: Record<number,string> = { 0:'A',2:'S',4:'D',5:'F',7:'G',9:'H',11:'J',12:'K' };
const BLACK_HINT: Record<number,string> = { 1:'W',3:'E',6:'T',8:'Y',10:'U' };
const IS_BLACK: Record<number,boolean> = { 1:true,3:true,6:true,8:true,10:true };

function buildFullKeyboard(pressed: Record<string,boolean>, oct: number, playNote: (f:number, i:InstrumentId)=>void, releaseKey:(id:string)=>void) {
  const whites: any[] = [], blacks: any[] = [];
  let w = 0;
  for (let m = 36; m <= 84; m++) {
    const pc = ((m % 12) + 12) % 12;
    const id = 'n' + m;
    const rel = m - 12 * (oct + 1);
    const press = () => { playNote(midiFreq(m), 'piano'); };
    const release = () => releaseKey(id);
    if (IS_BLACK[pc]) {
      blacks.push({ id, pressed: !!pressed[id], press, release, _w: w, hint: BLACK_HINT[rel] || '' });
    } else {
      whites.push({ id, pressed: !!pressed[id], press, release, name: midiName(m), hint: WHITE_HINT[rel] || '' });
      w++;
    }
  }
  const N = whites.length;
  const bwPct = 0.62 * (100 / N);
  blacks.forEach(b => { b.leftPct = (b._w / N) * 100; b.widthPct = bwPct; });
  return { whites, blacks };
}

function FullscreenPiano({ playNote, onClose }: { playNote: (f:number, i:InstrumentId)=>void; onClose: ()=>void }) {
  const [oct, setOct] = useState(4);
  const [pressed, setPressed] = useState<Record<string,boolean>>({});
  const [lastNote, setLastNote] = useState('READY');
  const downRef = useRef<Record<string, string>>({});
  const closingRef = useRef(false);

  const pressKey = useCallback((id: string, freq: number, name: string) => {
    if (pressed[id]) return;
    playNote(freq, 'piano');
    setLastNote(name.toUpperCase());
    setPressed(p => ({ ...p, [id]: true }));
  }, [pressed, playNote]);

  const releaseKey = useCallback((id: string) => {
    setPressed(p => { const n = {...p}; delete n[id]; return n; });
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'z') { e.preventDefault(); setOct(o => Math.max(2, o - 1)); return; }
      if (e.key === 'ArrowRight' || e.key === 'x') { e.preventDefault(); setOct(o => Math.min(5, o + 1)); return; }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const off = KEY_OFFSET[k];
      if (off === undefined) return;
      e.preventDefault();
      const midi = 12 * (oct + 1) + off;
      const id = 'n' + midi;
      downRef.current[k] = id;
      pressKey(id, midiFreq(midi), midiName(midi));
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const id = downRef.current[k];
      if (id) { delete downRef.current[k]; releaseKey(id); }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [oct, pressKey, releaseKey, onClose]);

  const { whites, blacks } = buildFullKeyboard(pressed, oct, (f) => {
    playNote(f, 'piano');
    const midi = Math.round(69 + 12 * Math.log2(f / 440));
    setLastNote(midiName(midi).toUpperCase());
  }, releaseKey);

  return (
    <div className="ins-fs-overlay">
      {/* Atmospheric clouds */}
      <div className="ins-fs-cloud ins-fs-cloud--a" />
      <div className="ins-fs-cloud ins-fs-cloud--b" />
      <div className="ins-fs-cloud ins-fs-cloud--c" />

      <div className="ins-fs-inner">
        {/* Top bar */}
        <div className="ins-fs-topbar">
          <div className="ins-fs-topbar-left">
            <span className="ins-fs-logo">DEMETRA</span>
            <span className="ins-fs-studio-label">Piano Studio</span>
          </div>
          <div className="ins-fs-topbar-right">
            <span className="ins-fs-readout">{lastNote}</span>
            <button className="ins-fs-exit-btn" onClick={onClose}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5H5V1"/><path d="M13 5H9V1"/><path d="M1 9H5V13"/><path d="M13 9H9V13"/></svg>
              Exit
            </button>
          </div>
        </div>

        {/* Octave controls */}
        <div className="ins-fs-octave-row">
          <button className="ins-fs-oct-btn" onClick={() => setOct(o => Math.max(2, o - 1))}>◀</button>
          <div className="ins-fs-oct-display">
            <div className="ins-fs-oct-label">Octave</div>
            <div className="ins-fs-oct-name">C{oct}</div>
          </div>
          <button className="ins-fs-oct-btn" onClick={() => setOct(o => Math.min(5, o + 1))}>▶</button>
        </div>

        {/* Piano keyboard */}
        <div className="ins-fs-piano-wrap">
          {/* Pilaster left */}
          <div className="ins-piano-pilaster" />

          <div className="ins-fs-keys-area">
            {/* White keys */}
            <div className="ins-fs-whites">
              {whites.map((k, i) => (
                <div key={k.id}
                  className={`ins-fs-white-key ${k.pressed ? 'pressed' : ''}`}
                  onPointerDown={() => { pressKey(k.id, midiFreq(parseInt(k.id.slice(1))), k.name); }}
                  onPointerUp={() => releaseKey(k.id)}
                  onPointerLeave={() => releaseKey(k.id)}
                >
                  {k.pressed && <div className="ins-fs-white-key-glow" />}
                  {k.hint && <span className="ins-fs-key-hint">{k.hint}</span>}
                  <span className="ins-fs-key-name">{k.name}</span>
                </div>
              ))}
            </div>
            {/* Black keys */}
            {blacks.map(b => (
              <div key={b.id}
                className={`ins-fs-black-key ${b.pressed ? 'pressed' : ''}`}
                style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                onPointerDown={() => { pressKey(b.id, midiFreq(parseInt(b.id.slice(1))), midiName(parseInt(b.id.slice(1)))); }}
                onPointerUp={() => releaseKey(b.id)}
                onPointerLeave={() => releaseKey(b.id)}
              >
                {b.pressed && <div className="ins-fs-black-key-glow" />}
                {b.hint && <span className="ins-fs-black-hint">{b.hint}</span>}
              </div>
            ))}
          </div>

          {/* Pilaster right */}
          <div className="ins-piano-pilaster" />
        </div>

        <p className="ins-fs-hint">
          Type <strong>A–K</strong> to play · <strong>W E T Y U</strong> for sharps · <strong>Z / X</strong> or <strong>← →</strong> to shift octave · <strong>Esc</strong> to exit
        </p>
      </div>
    </div>
  );
}

// ── Instrument Players ───────────────────────────────────────────────────────
function PianoPlayer({ playNote }: { playNote: (f: number, i: InstrumentId) => void }) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const whites = PIANO_KEYS.filter(k => !k.isBlack);
  const keyW = 52, keyH = 160, blackW = 32, blackH = 100;

  const press = (k: typeof PIANO_KEYS[0]) => {
    playNote(k.freq, 'piano');
    setActive(s => new Set([...s, k.note]));
    setTimeout(() => setActive(s => { const n = new Set(s); n.delete(k.note); return n; }), 300);
  };

  return (
    <div className="instrument-player">
      <div className="piano-scroll">
        <svg viewBox={`0 0 ${whites.length * keyW + 2} ${keyH + 20}`} style={{ width: '100%', maxWidth: whites.length * keyW + 2, display: 'block', margin: '0 auto' }}>
          {whites.map((k, i) => (
            <g key={k.note} onMouseDown={() => press(k)} style={{ cursor: 'pointer' }}>
              <rect x={i * keyW + 1} y={0} width={keyW - 2} height={keyH} rx={4}
                fill={active.has(k.note) ? 'rgba(201,162,39,0.25)' : '#ffffff'}
                stroke={active.has(k.note) ? 'rgb(154,123,28)' : 'rgba(22,42,67,0.18)'}
                strokeWidth={1.5}
                style={{ transition: 'fill 0.08s ease' }}
              />
              <text x={i * keyW + keyW / 2} y={keyH - 10} textAnchor="middle"
                fill={active.has(k.note) ? 'rgb(154,123,28)' : 'rgba(22,42,67,0.35)'}
                fontSize="11" fontFamily="Cinzel, serif" fontWeight="600">{k.label}</text>
            </g>
          ))}
          {PIANO_KEYS.filter(k => k.isBlack).map(k => {
            const leftWhiteIdx = whites.indexOf(whites.find(w => {
              return whites.filter(ww => ww.freq < k.freq).sort((a,b) => b.freq - a.freq)[0]?.note === w.note;
            }) as any);
            const bx = (leftWhiteIdx + 1) * keyW - blackW / 2;
            if (bx < 0) return null;
            return (
              <g key={k.note} onMouseDown={() => press(k)} style={{ cursor: 'pointer' }}>
                <rect x={bx} y={0} width={blackW} height={blackH} rx={3}
                  fill={active.has(k.note) ? 'rgb(201,162,39)' : '#3a2f12'}
                  style={{ transition: 'fill 0.08s ease' }}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="instrument-hint">Click keys to play · Try different octaves above</p>
    </div>
  );
}

function GuitarPlayer({ playNote }: { playNote: (f: number, i: InstrumentId) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const frets = 12;
  const stringH = 48;
  const fretW = 52;
  const totalW = frets * fretW + 60;
  const totalH = GUITAR_STRINGS.length * stringH + 20;

  const strum = (s: typeof GUITAR_STRINGS[0], fret: number) => {
    const freq = s.freq * Math.pow(2, fret / 12);
    playNote(freq, 'guitar');
    setActive(`${s.note}-${fret}`);
    setTimeout(() => setActive(null), 400);
  };

  return (
    <div className="instrument-player">
      <div className="guitar-scroll">
        <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ width: '100%', maxWidth: totalW, display: 'block', margin: '0 auto' }}>
          {Array.from({ length: frets + 1 }, (_, fi) => (
            <line key={fi} x1={50 + fi * fretW} y1={10} x2={50 + fi * fretW} y2={totalH - 10}
              stroke={fi === 0 ? '#3a2f12' : 'rgba(58,47,18,0.2)'} strokeWidth={fi === 0 ? 3 : 1} />
          ))}
          {[3, 5, 7, 9, 12].map(fi => (
            <circle key={fi} cx={50 + (fi - 0.5) * fretW} cy={totalH / 2}
              r={5} fill="rgba(58,47,18,0.1)" />
          ))}
          {GUITAR_STRINGS.map((s, si) => {
            const y = 10 + si * stringH + stringH / 2;
            return (
              <g key={s.note}>
                <line x1={50} y1={y} x2={totalW} y2={y} stroke={s.color} strokeWidth={2.5 - si * 0.2} opacity={0.7} />
                <circle cx={28} cy={y} r={14} fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseDown={() => strum(s, 0)} />
                <text x={28} y={y + 4} textAnchor="middle" fill={s.color} fontSize="9" fontFamily="Cinzel, serif" fontWeight="700">{s.label}</text>
                {Array.from({ length: frets }, (_, fi) => {
                  const isActive = active === `${s.note}-${fi + 1}`;
                  return (
                    <g key={fi} onMouseDown={() => strum(s, fi + 1)} style={{ cursor: 'pointer' }}>
                      <rect x={50 + fi * fretW + 2} y={y - stringH / 2 + 4} width={fretW - 4} height={stringH - 8} rx={3}
                        fill={isActive ? `${s.color}40` : 'transparent'} style={{ transition: 'fill 0.1s' }} />
                      {isActive && <circle cx={50 + fi * fretW + fretW / 2} cy={y} r={9} fill={s.color} opacity={0.8} />}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="instrument-hint">Click a string to play open · Click on frets to change pitch</p>
    </div>
  );
}

function ViolinPlayer({ playNote }: { playNote: (f: number, i: InstrumentId) => void }) {
  const [bowing, setBowing] = useState<string | null>(null);
  return (
    <div className="instrument-player violin-player">
      <div className="violin-bow-area">
        {VIOLIN_STRINGS.map((s, i) => {
          const color = ['#e05c5c', '#e8aa2e', '#4f8ef7', '#7c6df0'][i];
          return (
            <div key={s.note} className="violin-string-row">
              <div className="violin-string-label" style={{ color }}>{s.label}</div>
              <div
                className={`violin-string-track ${bowing === s.note ? 'bowing' : ''}`}
                style={{ '--v-color': color } as any}
                onMouseDown={() => { playNote(s.freq, 'violin'); setBowing(s.note); }}
                onMouseUp={() => setBowing(null)}
                onMouseLeave={() => setBowing(null)}
                onTouchStart={() => { playNote(s.freq, 'violin'); setBowing(s.note); }}
                onTouchEnd={() => setBowing(null)}
              >
                <div className="violin-string-line" />
                <div className={`violin-bow ${bowing === s.note ? 'active' : ''}`} />
              </div>
              <div className="violin-string-freq">{s.freq.toFixed(0)} Hz</div>
            </div>
          );
        })}
      </div>
      <p className="instrument-hint">Hold a string to bow it continuously</p>
    </div>
  );
}

function FlutePlayer({ playNote }: { playNote: (f: number, i: InstrumentId) => void }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="instrument-player flute-player">
      <div className="flute-keys-row">
        {FLUTE_NOTES.map((n, i) => {
          const colors = ['#7c6df0', '#4f8ef7', '#38b2ac', '#48bb78', '#e8aa2e', '#e05c5c', '#f687b3'];
          const c = colors[i];
          return (
            <div key={n.note}
              className={`flute-key ${active === n.note ? 'active' : ''}`}
              style={{ '--fk-color': c } as any}
              onMouseDown={() => { playNote(n.freq, 'flute'); setActive(n.note); }}
              onMouseUp={() => setActive(null)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="flute-key-hole" />
              <div className="flute-key-label">{n.label}</div>
              <div className="flute-key-note">{n.note}</div>
            </div>
          );
        })}
      </div>
      <p className="instrument-hint">Hold keys to play sustained notes</p>
    </div>
  );
}

function DrumKit({ playNote }: { playNote: (f: number, i: InstrumentId) => void }) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const press = (pad: typeof DRUM_PADS[0]) => {
    playNote(pad.freq, 'drums');
    setActive(s => new Set([...s, pad.label]));
    setTimeout(() => setActive(s => { const n = new Set(s); n.delete(pad.label); return n; }), 150);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const pad = DRUM_PADS.find(p => p.key === e.key.toLowerCase());
      if (pad) press(pad);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <div className="instrument-player">
      <div className="drum-grid">
        {DRUM_PADS.map(pad => (
          <button key={pad.label}
            className={`drum-pad ${active.has(pad.label) ? 'active' : ''}`}
            style={{ '--pad-color': pad.color } as any}
            onMouseDown={() => press(pad)}
          >
            <div className="drum-pad-label">{pad.label}</div>
            <div className="drum-pad-key">[{pad.key.toUpperCase()}]</div>
          </button>
        ))}
      </div>
      <p className="instrument-hint">Click pads or press keyboard shortcuts [Q W E A S D R F]</p>
    </div>
  );
}

// ── Notes Panel ───────────────────────────────────────────────────────────────
const INITIAL_NOTES: Note[] = [
  { id: '1', title: 'Chopin Étude fingering notes', content: 'RH: 1-2-3-1-2-3-4-5 for the opening passage\nPractice LH octaves slowly at ♩=60 first\nWatch the thumb crossing on the chromatic run in bar 4', instrument: 'piano', createdAt: '2026-06-10', shared: false, sharedWith: [] },
  { id: '2', title: 'Vibrato exercise', content: 'Slow bow with wrist vibrato\nStart on open A, build speed gradually\nKeep the elbow relaxed — tension is the enemy', instrument: 'violin', createdAt: '2026-06-20', shared: true, sharedWith: ['Anna Kostadinova', 'Hristo Nikolov'] },
];

function NotesPanel({ instrument }: { instrument: InstrumentId }) {
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [editing, setEditing] = useState<Note | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showShare, setShowShare] = useState<Note | null>(null);
  const [shareInput, setShareInput] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  const filtered = notes.filter(n => n.instrument === instrument);
  const allNotes = notes;

  const startNew = () => {
    const n: Note = { id: Date.now().toString(), title: '', content: '', instrument, createdAt: new Date().toISOString().split('T')[0], shared: false, sharedWith: [] };
    setEditing(n); setIsNew(true);
  };

  const save = () => {
    if (!editing) return;
    if (isNew) setNotes(prev => [...prev, editing]);
    else setNotes(prev => prev.map(n => n.id === editing.id ? editing : n));
    setEditing(null); setIsNew(false);
  };

  const del = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));

  const shareNote = () => {
    if (!showShare || !shareInput.trim()) return;
    const name = shareInput.trim();
    setNotes(prev => prev.map(n => n.id === showShare.id
      ? { ...n, shared: true, sharedWith: [...new Set([...n.sharedWith, name])] }
      : n
    ));
    setShareMsg(`Shared with ${name}`);
    setShareInput('');
    setTimeout(() => setShareMsg(''), 2000);
  };

  return (
    <div className="notes-panel">
      <div className="notes-panel-header">
        <div className="notes-panel-title">My Notes</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="notes-filter-label">{filtered.length.toString().padStart(2,'0')} saved</span>
          <button className="notes-new-btn" onClick={startNew}>+ New</button>
        </div>
      </div>

      {/* Gold rule */}
      <div className="notes-gold-rule" />

      {editing && (
        <div className="note-editor">
          <input className="note-editor-title" placeholder="Note title…" value={editing.title}
            onChange={e => setEditing({ ...editing, title: e.target.value })} />
          <textarea className="note-editor-body" placeholder="Write your notes, fingerings, practice reminders…"
            rows={5} value={editing.content}
            onChange={e => setEditing({ ...editing, content: e.target.value })} />
          <div className="note-editor-actions">
            <button className="note-btn-secondary" onClick={() => { setEditing(null); setIsNew(false); }}>Cancel</button>
            <button className="note-btn-primary" onClick={save}>Save note</button>
          </div>
        </div>
      )}

      {showShare && (
        <div className="note-share-panel">
          <div className="note-share-title">Share "{showShare.title}"</div>
          {showShare.sharedWith.length > 0 && (
            <div className="note-share-with">
              {showShare.sharedWith.map(s => (
                <span key={s} className="share-chip">{s}</span>
              ))}
            </div>
          )}
          <div className="invite-email-row" style={{ marginTop: 8 }}>
            <input className="invite-email-input" placeholder="Student name or email" value={shareInput}
              onChange={e => setShareInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && shareNote()} />
            <button className="invite-send-btn" onClick={shareNote}>Share</button>
          </div>
          {shareMsg && <div className="share-success">{shareMsg}</div>}
          <button className="note-btn-secondary" style={{ marginTop: 8, width: '100%' }} onClick={() => { setShowShare(null); setShareMsg(''); }}>Done</button>
        </div>
      )}

      <div className="notes-list">
        {filtered.length === 0 && !editing && (
          <div className="notes-empty">
            <div className="notes-empty-icon">📝</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, color: '#5c6e85', marginBottom: 4 }}>Nothing captured yet</div>
            <div style={{ fontSize: 13, color: '#a0aec0', marginBottom: 12 }}>Play a phrase, then note what you hear.</div>
            <button className="notes-new-btn" onClick={startNew}>Write your first note</button>
          </div>
        )}
        {filtered.map(n => (
          <div key={n.id} className="note-card">
            <div className="note-card-header">
              <div className="note-card-title">{n.title || 'Untitled'}</div>
              <div className="note-card-date">{n.createdAt}</div>
            </div>
            <div className="note-card-body">{n.content}</div>
            <div className="note-card-footer">
              {n.shared && (
                <div className="note-shared-badge">Shared with {n.sharedWith.join(', ')}</div>
              )}
              <div className="note-card-actions">
                <button className="note-action-btn" onClick={() => { setEditing(n); setIsNew(false); }}>Edit</button>
                <div className="note-action-divider" />
                <button className="note-action-btn" onClick={() => setShowShare(n)}>Share</button>
                <div className="note-action-divider" />
                <button className="note-action-btn note-action-del" onClick={() => del(n.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && allNotes.length > filtered.length && (
        <div className="notes-other-hint">
          You have {allNotes.length - filtered.length} note{allNotes.length - filtered.length > 1 ? 's' : ''} for other instruments.
        </div>
      )}
    </div>
  );
}

// ── Main Instruments Page ─────────────────────────────────────────────────────
export default function Instruments({ onNavigate: _onNavigate }: InstrumentsProps) {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentId>('piano');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const { playNote } = useAudioEngine();
  const inst = INSTRUMENTS.find(i => i.id === selectedInstrument)!;

  const renderPlayer = () => {
    switch (selectedInstrument) {
      case 'piano':  return <PianoPlayer playNote={playNote} />;
      case 'violin': return <ViolinPlayer playNote={playNote} />;
      case 'guitar': return <GuitarPlayer playNote={playNote} />;
      case 'flute':  return <FlutePlayer playNote={playNote} />;
      case 'drums':  return <DrumKit playNote={playNote} />;
    }
  };

  return (
    <div className="instruments-page page-transition-container">
      {/* Drifting clouds */}
      <div className="ins-cloud ins-cloud--a" />
      <div className="ins-cloud ins-cloud--b" />
      <div className="ins-cloud ins-cloud--c" />

      <div className="ins-content">
        {/* Hero */}
        <header className="ins-hero">
          {/* Gold ornament */}
          <div className="ins-ornament">
            <div className="ins-ornament-vline" />
            <div className="ins-ornament-hline" />
            <div className="ins-ornament-diamond" />
          </div>
          <div className="ins-eyebrow">Demetra · Instruments</div>
          <h1 className="ins-hero-title">{inst.label}</h1>
          <p className="ins-hero-desc">{inst.desc}</p>
        </header>

        {/* Gold rule with diamond */}
        <div className="ins-gold-rule">
          <div className="ins-gold-rule-diamond" />
          <div className="ins-gold-rule-line" />
        </div>

        {/* Instrument picker tabs */}
        <div className="ins-picker-bar">
          {INSTRUMENTS.map(i => (
            <button
              key={i.id}
              className={`ins-picker-btn ${selectedInstrument === i.id ? 'active' : ''}`}
              onClick={() => setSelectedInstrument(i.id)}
            >
              <span className={`ins-picker-roman ${selectedInstrument === i.id ? 'active' : ''}`}>{i.roman}</span>
              <span className="ins-picker-label">{i.label}</span>
            </button>
          ))}
        </div>

        {/* Main two-column body */}
        <main className="ins-body">
          {/* Player column */}
          <section className="ins-player-col">
            <div className="ins-player-topbar">
              <span className="ins-player-title">The {inst.label}</span>
              {selectedInstrument === 'piano' && (
                <button className="ins-fullscreen-btn" onClick={() => setShowFullscreen(true)}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 1H1V5"/><path d="M9 1H13V5"/>
                    <path d="M5 13H1V9"/><path d="M9 13H13V9"/>
                  </svg>
                  Fullscreen
                </button>
              )}
            </div>

            {/* Ivory piano casing card */}
            <div className="ins-player-card">
              <div className="ins-player-card-grain" />
              <div className="ins-player-card-top-bar" />
              <div className="ins-player-card-inner">
                <div className="ins-player-pilasters">
                  <div className="ins-piano-pilaster" />
                  <div className="ins-player-keys-wrap">
                    {renderPlayer()}
                  </div>
                  <div className="ins-piano-pilaster" />
                </div>
              </div>
            </div>
          </section>

          {/* Notes column */}
          <aside className="ins-notes-col">
            <div className="ins-notes-card">
              <div className="ins-notes-card-grain" />
              <NotesPanel instrument={selectedInstrument} />
            </div>
          </aside>
        </main>
      </div>

      {/* Fullscreen overlay */}
      {showFullscreen && (
        <FullscreenPiano playNote={playNote} onClose={() => setShowFullscreen(false)} />
      )}
    </div>
  );
}