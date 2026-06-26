import React, { useState } from 'react';

// Mock Data for the dashboard
const MOCK_EVENTS = [
  {
    id: 1,
    title: 'Autumn Code Expo',
    date: 'Oct 15, 2026 - 10:00 AM',
    location: 'ПГКПИ Innovation Hall, Burgas',
    category: 'Technology',
    status: 'active',
    price: 0,
    progress: 85,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 2,
    title: 'Symphony Under the Stars',
    date: 'Aug 20, 2026 - 7:00 PM',
    location: 'Sea Casino Terrace, Burgas',
    category: 'Music',
    status: 'active',
    price: 45,
    progress: 60,
    image: 'https://images.unsplash.com/photo-1469041797191-50ace28483c3?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 3,
    title: 'Global Wellness Summit',
    date: 'Sep 05, 2026 - 9:00 AM',
    location: 'Flora Expo Center',
    category: 'Health',
    status: 'active',
    price: 120,
    progress: 40,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 4,
    title: 'Culinary Delights Festival',
    date: 'Jul 25, 2026 - 11:00 AM',
    location: 'Burgas Port Area',
    category: 'Food',
    status: 'active',
    price: 25,
    progress: 95,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 5,
    title: 'Draft: Winter Gala',
    date: 'Dec 12, 2026 - 8:00 PM',
    location: 'TBD',
    category: 'Art & Design',
    status: 'draft',
    price: 60,
    progress: 0,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 6,
    title: 'Past: Spring Hackathon',
    date: 'Mar 10, 2026 - 9:00 AM',
    location: 'ПГКПИ Labs',
    category: 'Technology',
    status: 'past',
    price: 0,
    progress: 100,
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=800'
  }
];

interface EventsProps {
  onNavigate: (view: 'home' | 'login' | 'register' | 'events') => void;
}

export default function Events({ onNavigate }: EventsProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'draft' | 'past'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter logic based on tab and search
  const filteredEvents = MOCK_EVENTS.filter(event => 
    event.status === activeTab && 
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="events-page-container">
      <div className="events-content-wrapper">
        
        {/* Header Section */}
        <div className="events-header">
          <div className="events-breadcrumbs">Dashboard / Events</div>
          <h1 className="events-main-title">Events</h1>
        </div>

        {/* Controls Row (Tabs + Search/Filters) */}
        <div className="events-controls-row">
          
          <div className="events-tabs">
            <button 
              className={`event-tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active <span className="tab-count">4</span>
            </button>
            <button 
              className={`event-tab ${activeTab === 'draft' ? 'active' : ''}`}
              onClick={() => setActiveTab('draft')}
            >
              Draft <span className="tab-count">1</span>
            </button>
            <button 
              className={`event-tab ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => setActiveTab('past')}
            >
              Past <span className="tab-count">1</span>
            </button>
          </div>

          <div className="events-filters">
            <div className="search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Search event, location..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select className="filter-select">
              <option>All Category</option>
              <option>Technology</option>
              <option>Music</option>
              <option>Art</option>
            </select>

            <select className="filter-select">
              <option>This Month</option>
              <option>Next Month</option>
              <option>This Year</option>
            </select>
          </div>
        </div>

        {/* Events Grid */}
        <div className="events-grid">
          {filteredEvents.map(event => (
            <div key={event.id} className="event-card">
              
              {/* Card Image Header */}
              <div className="event-card-image" style={{ backgroundImage: `url(${event.image})` }}>
                <div className="event-category-tag">{event.category}</div>
                <div className="event-status-tag">
                  <span className={`status-dot ${event.status}`}></span>
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </div>
              </div>

              {/* Card Body */}
              <div className="event-card-body">
                <div className="event-date">{event.date}</div>
                <h3 className="event-title">{event.title}</h3>
                <div className="event-location">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {event.location}
                </div>
                
                {/* Progress & Price Footer */}
                <div className="event-card-footer">
                  <div className="event-progress-wrapper">
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${event.progress}%` }}></div>
                    </div>
                    <span className="progress-text">{event.progress}% Capacity</span>
                  </div>
                  <div className="event-price">
                    {event.price === 0 ? 'Free' : `$${event.price}`}
                  </div>
                </div>
              </div>

            </div>
          ))}
          
          {filteredEvents.length === 0 && (
            <div className="no-events-state">No events found matching your criteria.</div>
          )}
        </div>

      </div>
    </div>
  );
}