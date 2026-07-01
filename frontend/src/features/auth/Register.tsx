import React, { useState } from 'react';
import './Auth.css';
import { Building2, GraduationCap, Eye, EyeOff } from 'lucide-react';
import { registerUser, storeAuth, type AuthUser } from '../../shared/api/api';

interface RegisterProps {
  onBackToHome: () => void;
  onNavigateToLogin: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

const PASSWORD_REQUIREMENTS = [
  '8 to 128 characters',
  'One uppercase letter',
  'One lowercase letter',
];

function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) return 'Password must be between 8 and 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  return '';
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

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

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
              <label htmlFor="email" className="required-label">{role === 'teacher' ? 'Teacher email' : 'Student email'}</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'teacher' ? 'name@teacher.edu' : 'name@student.edu'}
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
                  maxLength={128}
                  pattern="(?=.*[a-z])(?=.*[A-Z]).{8,128}"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ chars, Aa, 0-9"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <ul className="password-requirements">
                {PASSWORD_REQUIREMENTS.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
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
