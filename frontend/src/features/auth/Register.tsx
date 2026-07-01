import React, { useState } from 'react';
import './Auth.css';
import { Building2, GraduationCap, Eye, EyeOff } from 'lucide-react';
import { registerUser, storeAuth, type AuthUser } from '../../shared/api/api';

interface RegisterProps {
  onBackToHome: () => void;
  onNavigateToLogin: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export default function Register({ onBackToHome, onNavigateToLogin, onAuthenticated }: RegisterProps) {
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [teacherName, setTeacherName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const normalizedTeacherName = teacherName.trim();

      const auth = await registerUser({
        name: role === 'teacher' ? normalizedTeacherName : name.trim(),
        email,
        password,
        role: role === 'teacher' ? 'ORGANIZER' : 'STUDENT',
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
              {role === 'teacher'
                ? 'Create a teacher account to host recitals, lessons, and student events.'
                : 'Create your student account to discover and register for recitals.'}
            </p>
          </div>

          <div className="role-toggle-container">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`role-toggle-btn ${role === 'student' ? 'active' : ''}`}
            >
              <GraduationCap size={14} />
              Student
            </button>
            
            <button
              type="button"
              onClick={() => setRole('teacher')}
              className={`role-toggle-btn ${role === 'teacher' ? 'active' : ''}`}
            >
              <Building2 size={14} />
              Teacher
            </button>
            
          </div>

          <form onSubmit={submit} className="register-form">
            {role === 'teacher' ? (
              <>
                <div className="form-group">
                  <label htmlFor="teacherName" className="required-label">Teacher name</label>
                  <input
                    id="teacherName"
                    type="text"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="Prof. Antonov"
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="name" className="required-label">Student name</label>
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
              <label htmlFor="email" className="required-label">{role === 'teacher' ? 'Work email' : 'Email'}</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'teacher' ? 'teacher@studio.com' : 'you@school.edu'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="required-label">Password</label>
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && <div className="auth-message auth-message--error">{error}</div>}

            <button type="submit" className="register-submit-btn" disabled={isSubmitting}>
              {isSubmitting
                ? 'Creating account...'
                : role === 'teacher'
                  ? 'Create teacher account'
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
