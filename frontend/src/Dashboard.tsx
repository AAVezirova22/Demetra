import { useState } from 'react';

interface DashboardProps {
  onNavigate: (view: 'home' | 'register' | 'login' | 'events' | 'dashboard') => void;
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const ORG = {
  name: 'National Music Academy',
  type: 'Music School',
  admin: 'Prof. Antonov',
  username: 'nma_sofia',
  email: 'admin@nma.bg',
  founded: '1921',
  students: 47,
  events: 3,
  city: 'Sofia, Bulgaria',
  description: 'One of the oldest music academies in Eastern Europe, dedicated to fostering exceptional musical talent across all disciplines.',
  initials: 'NMA',
};

const MOCK_ORG_EVENTS = [
  { id: 1, title: 'Spring Symphony Concert', date: 'Jul 12, 2026', registered: 289, capacity: 320, status: 'open', category: 'Concert' },
  { id: 2, title: 'Student Recital Night', date: 'Jun 14, 2026', registered: 200, capacity: 200, status: 'past', category: 'Recital' },
  { id: 3, title: 'Piano Masterclass: Chopin', date: 'Jul 24, 2026', registered: 40, capacity: 40, status: 'full', category: 'Masterclass' },
];

const MOCK_STUDENTS = [
  { id: 1, name: 'Anna Kostadinova', instrument: 'Violin', year: 3, email: 'anna.k@students.nma.bg', status: 'active' },
  { id: 2, name: 'Hristo Nikolov', instrument: 'Voice (Baritone)', year: 4, email: 'h.nikolov@students.nma.bg', status: 'active' },
  { id: 3, name: 'Galina Todorova', instrument: 'Piano', year: 2, email: 'g.todorova@students.nma.bg', status: 'active' },
  { id: 4, name: 'Dimitar Petrov', instrument: 'Piano', year: 3, email: 'd.petrov@students.nma.bg', status: 'active' },
  { id: 5, name: 'Maria Georgieva', instrument: 'Piano', year: 1, email: 'm.georgieva@students.nma.bg', status: 'pending' },
  { id: 6, name: 'Teodora Ivanova', instrument: 'Piano', year: 2, email: 't.ivanova@students.nma.bg', status: 'active' },
  { id: 7, name: 'Stefan Dimitrov', instrument: 'Cello', year: 4, email: 's.dimitrov@students.nma.bg', status: 'active' },
  { id: 8, name: 'Nikoleta Popova', instrument: 'Flute', year: 1, email: 'n.popova@students.nma.bg', status: 'pending' },
];

const INVITE_LINK = 'https://demetra.music/join/nma_sofia_2026';
const INVITE_CODE = 'NMA-2026-XK7';

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, sub }: { icon: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="dash-section-header">
      <h2 className="dash-section-title">{title}</h2>
      {action && (
        <button className="dash-section-action" onClick={onAction}>{action}</button>
      )}
    </div>
  );
}

// ── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [sent, setSent] = useState(false);

  const copy = (type: 'link' | 'code') => {
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendEmail = () => {
    if (!emailInput.trim()) return;
    setSent(true);
    setEmailInput('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Invite Students</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="modal-desc">
          Share any of the options below to invite students to join your organisation on Demetra.
        </p>

        {/* Invite link */}
        <div className="invite-section">
          <div className="invite-label">Invitation link</div>
          <div className="invite-copy-row">
            <div className="invite-value">{INVITE_LINK}</div>
            <button className={`invite-copy-btn ${copied === 'link' ? 'copied' : ''}`} onClick={() => copy('link')}>
              {copied === 'link' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Code */}
        <div className="invite-section">
          <div className="invite-label">Invitation code</div>
          <div className="invite-copy-row">
            <div className="invite-value invite-code">{INVITE_CODE}</div>
            <button className={`invite-copy-btn ${copied === 'code' ? 'copied' : ''}`} onClick={() => copy('code')}>
              {copied === 'code' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* QR Code */}
        <div className="invite-section">
          <div className="invite-label">QR code</div>
          <div className="qr-wrapper">
            <svg viewBox="0 0 120 120" width="120" height="120" style={{ display: 'block' }}>
              {/* Simple decorative QR stand-in */}
              <rect width="120" height="120" fill="#fff" rx="8" />
              {[0,1,2,3,4,5,6].map(r => [0,1,2,3,4,5,6].map(c => {
                const on = ((r + c) % 2 === 0) || (r < 2 && c < 2) || (r > 4 && c < 2) || (r < 2 && c > 4);
                return on ? <rect key={`${r}-${c}`} x={10 + c * 15} y={10 + r * 15} width="12" height="12" rx="2" fill="#162a43" /> : null;
              }))}
              <text x="60" y="115" textAnchor="middle" fontSize="7" fill="#5c6e85" fontFamily="Inter, sans-serif">Scan to join</text>
            </svg>
          </div>
        </div>

        {/* Email */}
        <div className="invite-section">
          <div className="invite-label">Send by email</div>
          <div className="invite-email-row">
            <input
              type="email"
              placeholder="student@school.edu"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              className="invite-email-input"
              onKeyDown={e => e.key === 'Enter' && sendEmail()}
            />
            <button className="invite-send-btn" onClick={sendEmail}>
              {sent ? '✓ Sent' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create New Event</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div className="create-steps">
          {['Details', 'Venue', 'Capacity'].map((s, i) => (
            <div key={s} className={`create-step ${step >= i + 1 ? 'active' : ''}`} onClick={() => setStep(i + 1)}>
              <div className="create-step-num">{i + 1}</div>
              <div className="create-step-label">{s}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="create-form">
            <div className="form-group">
              <label>Event Title</label>
              <input type="text" placeholder="e.g. Spring Chamber Concert" />
            </div>
            <div className="create-form-row">
              <div className="form-group">
                <label>Category</label>
                <select>
                  <option>Concert</option>
                  <option>Masterclass</option>
                  <option>Workshop</option>
                  <option>Lecture</option>
                  <option>Recital</option>
                </select>
              </div>
              <div className="form-group">
                <label>Admission</label>
                <input type="text" placeholder="e.g. €12 or Free" />
              </div>
            </div>
            <div className="create-form-row">
              <div className="form-group">
                <label>Date</label>
                <input type="date" />
              </div>
              <div className="form-group">
                <label>Start time</label>
                <input type="time" />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea placeholder="Describe the event…" rows={4} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(22,42,67,0.18)', borderRadius: 6, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#162a43', resize: 'vertical', outline: 'none' }} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="create-form">
            <div className="form-group">
              <label>Venue Name</label>
              <input type="text" placeholder="e.g. Grand Hall, Sofia" />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" placeholder="Full address" />
            </div>
            <div className="form-group">
              <label>Layout Type</label>
              <select>
                <option>Concert Hall</option>
                <option>Outdoor Amphitheater</option>
                <option>Classroom / Studio</option>
                <option>Black Box Theatre</option>
              </select>
            </div>
            {/* Mini venue preview */}
            <div className="venue-preview-box">
              <div className="venue-preview-label">Layout preview</div>
              <svg viewBox="0 0 300 160" style={{ width: '100%', maxWidth: 300, margin: '0 auto', display: 'block' }}>
                <ellipse cx="150" cy="24" rx="70" ry="18" fill="rgba(167,154,14,0.15)" stroke="rgb(167,154,14)" strokeWidth="1.2" />
                <text x="150" y="28" textAnchor="middle" fill="rgb(167,154,14)" fontSize="9" fontFamily="Cinzel, serif" letterSpacing="2">STAGE</text>
                {[0,1,2,3,4].map(r => Array.from({length: 12 - r}).map((_, c) => (
                  <rect key={`${r}-${c}`}
                    x={76 + r * 7 + c * 14} y={52 + r * 20} width="10" height="9" rx="2"
                    fill="rgba(22,42,67,0.08)" stroke="rgba(22,42,67,0.2)" strokeWidth="0.6" />
                )))}
              </svg>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="create-form">
            <div className="form-group">
              <label>Total Capacity</label>
              <input type="number" placeholder="e.g. 120" min={1} />
            </div>
            <div className="form-group">
              <label>Registration deadline</label>
              <input type="date" />
            </div>
            <div className="form-group">
              <label>Waitlist</label>
              <select>
                <option>Enabled (auto-notify on cancellations)</option>
                <option>Disabled</option>
              </select>
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <select>
                <option>Public – visible to all Demetra users</option>
                <option>Organisation only – invite-only</option>
              </select>
            </div>
          </div>
        )}

        <div className="modal-footer">
          {step > 1 && (
            <button className="modal-btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          {step < 3 ? (
            <button className="modal-btn-primary" onClick={() => setStep(s => s + 1)}>Continue</button>
          ) : (
            <button className="modal-btn-primary" onClick={onClose}>Publish event</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Page ───────────────────────────────────────────────────────────

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'events' | 'students' | 'settings'>('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const filteredStudents = MOCK_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.instrument.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const navItems: { key: typeof activeSection; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '⊞' },
    { key: 'events', label: 'My Events', icon: '🎼' },
    { key: 'students', label: 'Students', icon: '🎓' },
    { key: 'settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <>
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
      {showCreateModal && <CreateEventModal onClose={() => setShowCreateModal(false)} />}

      <div className="dash-page page-transition-container">
        {/* Sidebar */}
        <aside className="dash-sidebar">
          <div className="dash-org-card">
            <div className="dash-org-avatar">{ORG.initials}</div>
            <div className="dash-org-name">{ORG.name}</div>
            <div className="dash-org-type">{ORG.type} · {ORG.city}</div>
          </div>

          <nav className="dash-nav">
            {navItems.map(item => (
              <button
                key={item.key}
                className={`dash-nav-item ${activeSection === item.key ? 'active' : ''}`}
                onClick={() => setActiveSection(item.key)}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <button className="dash-invite-btn" onClick={() => setShowInviteModal(true)}>
            + Invite Students
          </button>
        </aside>

        {/* Main content */}
        <main className="dash-main">

          {/* ── Overview ── */}
          {activeSection === 'overview' && (
            <div>
              <div className="dash-page-header">
                <div>
                  <div className="dash-breadcrumb">Dashboard · Overview</div>
                  <h1 className="dash-page-title">Welcome back, {ORG.admin.split(' ')[1]}</h1>
                </div>
                <button className="dash-create-btn" onClick={() => setShowCreateModal(true)}>
                  + New Event
                </button>
              </div>

              {/* Stats */}
              <div className="dash-stats-grid">
                <StatCard icon="🎓" value={ORG.students} label="Students" sub="3 pending invites" />
                <StatCard icon="🎼" value={ORG.events} label="Active Events" sub="1 fully booked" />
                <StatCard icon="🏛️" value="1921" label="Founded" sub={ORG.city} />
                <StatCard icon="✉️" value="3" label="Open Invites" sub="2 email · 1 link" />
              </div>

              {/* Recent events */}
              <div className="dash-content-card" style={{ marginTop: 32 }}>
                <SectionHeader title="Your Events" action="View all" onAction={() => setActiveSection('events')} />
                <div className="dash-events-list">
                  {MOCK_ORG_EVENTS.map(ev => {
                    const pct = Math.round((ev.registered / ev.capacity) * 100);
                    return (
                      <div key={ev.id} className="dash-event-row">
                        <div className="dash-event-row-left">
                          <div className="dash-event-row-dot" style={{
                            background: ev.status === 'past' ? '#a0aec0' : ev.status === 'full' ? '#e53e3e' : 'rgb(167,154,14)'
                          }} />
                          <div>
                            <div className="dash-event-row-title">{ev.title}</div>
                            <div className="dash-event-row-meta">{ev.category} · {ev.date}</div>
                          </div>
                        </div>
                        <div className="dash-event-row-right">
                          <div className="dash-mini-bar">
                            <div className="dash-mini-bar-fill" style={{
                              width: `${pct}%`,
                              background: pct === 100 ? '#e53e3e' : 'rgb(167,154,14)'
                            }} />
                          </div>
                          <div className="dash-event-row-cap">{ev.registered}/{ev.capacity}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Students preview */}
              <div className="dash-content-card" style={{ marginTop: 24 }}>
                <SectionHeader title="Recent Students" action="View all" onAction={() => setActiveSection('students')} />
                <div className="dash-students-preview">
                  {MOCK_STUDENTS.slice(0, 4).map(s => (
                    <div key={s.id} className="dash-student-chip">
                      <div className="dash-student-avatar">{s.name.split(' ').map(n => n[0]).join('')}</div>
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
          )}

          {/* ── My Events ── */}
          {activeSection === 'events' && (
            <div>
              <div className="dash-page-header">
                <div>
                  <div className="dash-breadcrumb">Dashboard · My Events</div>
                  <h1 className="dash-page-title">My Events</h1>
                </div>
                <button className="dash-create-btn" onClick={() => setShowCreateModal(true)}>
                  + New Event
                </button>
              </div>

              <div className="dash-events-full-list">
                {MOCK_ORG_EVENTS.map(ev => {
                  const pct = Math.round((ev.registered / ev.capacity) * 100);
                  const statusColor = ev.status === 'past' ? '#a0aec0' : ev.status === 'full' ? '#e53e3e' : 'rgb(167,154,14)';
                  return (
                    <div key={ev.id} className="dash-event-card-full">
                      <div className="dash-event-card-full-header">
                        <div>
                          <div className="dash-event-card-full-category" style={{ color: statusColor }}>{ev.category}</div>
                          <div className="dash-event-card-full-title">{ev.title}</div>
                          <div className="dash-event-card-full-date">{ev.date}</div>
                        </div>
                        <div className="dash-event-status-badge" style={{
                          background: ev.status === 'past' ? 'rgba(160,174,192,0.15)' : ev.status === 'full' ? 'rgba(229,62,62,0.1)' : 'rgba(167,154,14,0.12)',
                          color: statusColor
                        }}>
                          {ev.status === 'past' ? 'Past' : ev.status === 'full' ? 'Fully Booked' : 'Open'}
                        </div>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5c6e85', marginBottom: 6 }}>
                          <span>Registration</span>
                          <span>{ev.registered} / {ev.capacity} ({pct}%)</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: statusColor }} />
                        </div>
                      </div>
                      <div className="dash-event-card-full-actions">
                        <button className="dash-action-btn">Edit</button>
                        <button className="dash-action-btn">View registrations</button>
                        <button className="dash-action-btn dash-action-btn--danger">
                          {ev.status === 'past' ? 'Archive' : 'Cancel event'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Students ── */}
          {activeSection === 'students' && (
            <div>
              <div className="dash-page-header">
                <div>
                  <div className="dash-breadcrumb">Dashboard · Students</div>
                  <h1 className="dash-page-title">Students</h1>
                </div>
                <button className="dash-create-btn" onClick={() => setShowInviteModal(true)}>
                  + Invite
                </button>
              </div>

              <div className="dash-content-card">
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <div className="search-box" style={{ flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="6" cy="6" r="4.5" stroke="#a0aec0" strokeWidth="1.4" />
                      <path d="M9.5 9.5L12 12" stroke="#a0aec0" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search students or instruments…"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                    />
                  </div>
                </div>

                <table className="dash-students-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Instrument</th>
                      <th>Year</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="dash-student-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                              {s.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span style={{ fontWeight: 600, color: '#162a43', fontSize: 13 }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ color: '#5c6e85', fontSize: 13 }}>{s.instrument}</td>
                        <td style={{ color: '#5c6e85', fontSize: 13 }}>Year {s.year}</td>
                        <td style={{ color: '#5c6e85', fontSize: 12 }}>{s.email}</td>
                        <td>
                          <span className={`dash-status-chip ${s.status}`}>
                            {s.status === 'pending' ? 'Pending' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <button className="dash-action-btn" style={{ padding: '4px 12px', fontSize: 11 }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Settings ── */}
          {activeSection === 'settings' && (
            <div>
              <div className="dash-page-header">
                <div>
                  <div className="dash-breadcrumb">Dashboard · Settings</div>
                  <h1 className="dash-page-title">Organisation Settings</h1>
                </div>
              </div>

              <div className="dash-content-card" style={{ maxWidth: 600 }}>
                <SectionHeader title="Organisation Profile" />
                <div className="dash-settings-form">
                  <div className="form-group">
                    <label>Organisation Name</label>
                    <input type="text" defaultValue={ORG.name} />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select defaultValue={ORG.type}>
                      <option>Music School</option>
                      <option>Music Club</option>
                      <option>Conservatory</option>
                      <option>Private Studio</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" defaultValue={ORG.city} />
                  </div>
                  <div className="form-group">
                    <label>About</label>
                    <textarea defaultValue={ORG.description} rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(22,42,67,0.18)', borderRadius: 6, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#162a43', resize: 'vertical', outline: 'none' }} />
                  </div>
                </div>
              </div>

              <div className="dash-content-card" style={{ maxWidth: 600, marginTop: 24 }}>
                <SectionHeader title="Admin Account" />
                <div className="dash-settings-form">
                  <div className="form-group">
                    <label>Your Name</label>
                    <input type="text" defaultValue={ORG.admin} />
                  </div>
                  <div className="form-group">
                    <label>Username</label>
                    <input type="text" defaultValue={ORG.username} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" defaultValue={ORG.email} />
                  </div>
                </div>
                <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(22,42,67,0.06)' }}>
                  <button className="register-submit-btn" style={{ width: 'auto', padding: '0 32px' }}>Save changes</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}