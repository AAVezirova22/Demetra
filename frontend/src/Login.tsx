import React, { useState } from 'react';
import './Auth.css';
import { loginUser, storeAuth, type AuthUser } from './api';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onBackToHome: () => void;
  onNavigateToRegister: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

export default function Login({ onBackToHome, onNavigateToRegister, onAuthenticated }: LoginProps) {
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
      const auth = await loginUser({ email, password });
      storeAuth(auth);
      onAuthenticated(auth.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
            <h2 className="register-title">Welcome back</h2>
            <p className="register-subtitle">
              Sign in with your email and password to return.
            </p>
          </div>

          <form onSubmit={submit} className="register-form">
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
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="current-password"
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
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="register-footer">
            <span className="footer-text">Don't have an account yet? </span>
            <button
              type="button"
              className="signin-link"
              onClick={onNavigateToRegister}
            >
              Register here
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