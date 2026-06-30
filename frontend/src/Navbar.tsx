import { useState, useEffect } from 'react';
import type { AuthUser } from './api';

type AppView = 'home' | 'register' | 'login' | 'events' | 'dashboard' | 'instruments';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
}

export default function Navbar({ onNavigate, currentView, currentUser, onLogout }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isFormView = currentView === 'register' || currentView === 'login';

  return (
    <nav className={`nav-container ${isScrolled || isFormView ? 'scrolled' : ''}`}>
      {/* Left */}
      <div className="nav-left">
        <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
          DEMETRA
        </div>
      </div>

      {/* Center */}
      <div className="nav-center">
        <a
          href="#events"
          className="nav-link"
          onClick={(e) => { e.preventDefault(); onNavigate('events'); }}
        >
          Events
        </a>
        <a href="#instruments" className="nav-link" onClick={(e) => { e.preventDefault(); onNavigate('instruments'); }}>Instruments</a>
        {currentUser?.role === 'ORGANIZER' && (
          <a
            href="#dashboard"
            className="nav-link"
            onClick={(e) => { e.preventDefault(); onNavigate('dashboard'); }}
          >
            Dashboard
          </a>
        )}
      </div>

      {/* Right */}
      <div className="nav-right">
        {currentUser ? (
          <>
            <span className="nav-user">{currentUser.name}</span>
            <button
              type="button"
              onClick={onLogout}
              className="nav-btn"
            >
              Sign out
            </button>
          </>
        ) : !isFormView ? (
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="nav-btn"
          >
            Get Started
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="nav-btn"
          >
            Back Home
          </button>
        )}
      </div>
    </nav>
  );
}