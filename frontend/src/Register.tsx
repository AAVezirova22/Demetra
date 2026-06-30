import React, { useState } from 'react';
import './Register.css';
import { Building2, GraduationCap } from 'lucide-react';
import { registerUser, storeAuth, type AuthUser } from './api';

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
  onNavigateToLogin: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export default function Register({ onBackToHome, onNavigateToLogin, onAuthenticated }: RegisterProps) {
  const [role, setRole] = useState<'organizer' | 'student'>('organizer');
  const [orgName, setOrgName] = useState('');
  const [kind, setKind] = useState(orgKinds[0]);
  const [organizerName, setOrganizerName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const auth = await registerUser({
        name: role === 'organizer' ? organizerName.trim() : name.trim(),
        email,
        password,
        role: role === 'organizer' ? 'ORGANIZER' : 'STUDENT',
        organizationName: role === 'organizer' ? orgName.trim() : undefined,
        organizationKind: role === 'organizer' ? kind : undefined,
      });
      storeAuth(auth);
      onAuthenticated(auth.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-form-side">
        <header className="register-brand" onClick={onBackToHome}>
          <span className="brand-icon">D</span>
          <span className="brand-name">Demetra</span>
        </header>

        <div className="register-card">
          <div className="register-header">
            <h2 className="register-title">Join the gathering</h2>
            <p className="register-subtitle">
              {role === 'organizer'
                ? 'Register an organization to host events, or join as a student.'
                : 'Create your student account to discover and register for recitals.'}
            </p>
          </div>

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
                    placeholder="PGKPI"
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
                  <label htmlFor="organizerName">Your name</label>
                  <input
                    id="organizerName"
                    type="text"
                    required
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    placeholder="Prof. Antonov"
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
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {error && <div className="auth-message auth-message--error">{error}</div>}

            <button type="submit" className="register-submit-btn" disabled={isSubmitting}>
              {isSubmitting
                ? 'Creating account...'
                : role === 'organizer'
                  ? 'Create organization'
                  : 'Create student account'}
            </button>
          </form>

          <div className="register-footer">
            <span className="footer-text">Already have an account? </span>
            <button
              type="button"
              className="signin-link"
              onClick={onNavigateToLogin}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>

      <div className="register-art-side">
        <div className="art-overlay">
          <div className="quote-container">
            <blockquote className="quote-text">
              "For every harvest there is a hall, and for every hall a song."
            </blockquote>
            <cite className="quote-author">THE DEMETRA CREED</cite>
          </div>
        </div>
      </div>
    </div>
  );
}