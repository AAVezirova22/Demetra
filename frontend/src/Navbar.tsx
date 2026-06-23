import { useState, useEffect } from 'react';

interface NavbarProps {
  onNavigate: (view: 'home' | 'register') => void;
  currentView: 'home' | 'register';
}

export default function Navbar({ onNavigate, currentView }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`nav-container ${isScrolled || currentView === 'register' ? 'scrolled' : ''}`}>
      {/* Left Zone */}
      <div className="nav-left">
        <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
          DEMETRA
        </div>
      </div>
      
      {/* Center Zone */}
      <div className="nav-center">
        <a href="#events" className="nav-link">Events</a>
        <a href="#instruments" className="nav-link">Instruments</a>
        <a href="#dashboard" className="nav-link">Dashboard</a>
      </div>

      {/* Right Zone */}
      <div className="nav-right">
        {currentView !== 'register' ? (
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