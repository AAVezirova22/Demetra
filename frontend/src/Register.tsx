import React, { useState } from 'react';
import './register.css';
import { Building2, GraduationCap } from 'lucide-react';

const orgKinds = [
  'Music School',
  'Conservatory',
  'University Department',
  'Choir',
  'Student Club',
  'Other',
];

interface RegisterProps {
  onBackToHome: () => void;
}

export default function Register({ onBackToHome }: RegisterProps) {
  const [role, setRole] = useState<'organizer' | 'student'>('organizer');

  // Fields State
  const [orgName, setOrgName] = useState('');
  const [kind, setKind] = useState(orgKinds[0]);
  const [organizerName, setOrganizerName] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'organizer') {
      console.log('Registering Org:', { orgName, kind, organizerName, username, email });
      alert('Welcome to Demetra. Your organization registration was captured.');
    } else {
      console.log('Registering Student:', { name, username, email });
      alert('Account created. Welcome to the recital hall.');
    }
  };

  return (
    <div className="register-container">
      {/* Left Column: Form Section */}
      <div className="register-form-side">
        <header className="register-brand" onClick={onBackToHome}>
          <span className="brand-icon">🌲</span>
          <span className="brand-name">Demetra</span>
        </header>

        <div className="register-card">
          {/* Header */}
          <div className="register-header">
            <h2 className="register-title">Join the gathering</h2>
            <p className="register-subtitle">
              {role === 'organizer' 
                ? 'Register an organization to host events, or join as a student.' 
                : 'Create your student account to discover and register for recitals.'}
            </p>
          </div>

          {/* Custom Classical Switcher Toggle */}
          <div className="role-toggle-container">
            <button
              type="button"
              onClick={() => setRole('organizer')}
              className={`role-toggle-btn ${role === 'organizer' ? 'active' : ''}`}
            >
              <Building2 size={14} />
              Organization
            </button>
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`role-toggle-btn ${role === 'student' ? 'active' : ''}`}
            >
              <GraduationCap size={14} />
              Student
            </button>
          </div>

          {/* Dynamic Fields */}
          <form onSubmit={submit} className="register-form">
            {role === 'organizer' ? (
              <>
                <div className="form-group">
                  <label htmlFor="orgName">Organization name</label>
                  <input
                    id="orgName"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Orpheus Conservatory"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="kind">Type of organization</label>
                  <select
                    id="kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {orgKinds.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="organizerName">Your name (organizer)</label>
                  <input
                    id="organizerName"
                    type="text"
                    required
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    placeholder="Prof. Demetra Stavrou"
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ivan Ivanov"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="lyra"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="type"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
              />
            </div>

            <button type="submit" className="register-submit-btn">
              {role === 'organizer' ? 'Create organization' : 'Create student account'}
            </button>
          </form>

          <div className="register-footer">
            <span className="footer-text">Already have an account? </span>
            <button type="button" className="signin-link">
              Sign in
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Art Side */}
      <div className="register-art-side">
        <div className="art-overlay">
          <div className="quote-container">
            <blockquote className="quote-text">
              “For every harvest there is a hall, and for every hall a song.”
            </blockquote>
            <cite className="quote-author">THE DEMETRA CREED</cite>
          </div>
        </div>
      </div>
    </div>
  );
}