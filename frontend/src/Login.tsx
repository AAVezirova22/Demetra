import React, { useState } from 'react';
import './register.css'; 

interface LoginProps {
  onBackToHome: () => void;
  onNavigateToRegister: () => void; 
}

export default function Login({ onBackToHome, onNavigateToRegister }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Logging in user:', { username, password });
    alert(`Attempting login for: ${username}`);
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
            <h2 className="register-title">Welcome back</h2>
            <p className="register-subtitle">
              Sign in with your credentials to return.
            </p>
          </div>

          {/* Form Fields */}
          <form onSubmit={submit} className="register-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ivan"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="register-submit-btn">
              Sign In
            </button>
          </form>

          {/* Footer Navigation Toggle */}
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