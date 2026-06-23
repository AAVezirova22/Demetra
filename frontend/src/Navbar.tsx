import React from 'react';

export default function Navbar() {
  return (
    <nav className="nav-container">
      {/* Brand Logo - Styled with an elegant serif look */}
      <div className="nav-logo">DEMETRA</div>
      
      {/* Navigation Links */}
      <div className="nav-menu">
        <a href="#events" className="nav-link">Events</a>
        <a href="#instruments" className="nav-link">Instruments</a>
        <a href="#dashboard" className="nav-link">Dashboard</a>
        <a href="#get-started" className="nav-btn">Get Started</a>
      </div>
    </nav>
  );
}