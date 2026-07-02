import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ArrowRight, Armchair, Bell, CalendarDays, LayoutGrid, Megaphone, Music, ShieldCheck, Ticket, UserPlus, UsersRound } from 'lucide-react';
import { Navbar } from '../widgets/navbar';
import { Register, Login, JoinInvitation } from '../features/auth'; 
import { ClickSpark } from '../shared/ui'; 
import { Events } from '../features/events';
import { Dashboard } from '../features/dashboard';
import { Instruments } from '../features/instruments';
import { Profile } from '../features/profile';
import { clearStoredAuth, fetchCurrentUser, getStoredAuth, storeAuth, type AuthUser } from '../shared/api/api';
import './App.css';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export type AppView = 'home' | 'register' | 'login' | 'events' | 'dashboard' | 'instruments' | 'join' | 'profile';
const VIEW_KEY = 'demetra.currentView';
const demetraBackgroundUrl = `${import.meta.env.BASE_URL}demetraBackground2.png`;

const landingFeatures = [
  { name: 'Events & tickets', detail: 'Browse published events and register in a couple of clicks', tag: 'Students', icon: Ticket },
  { name: 'Seat selection', detail: 'Pick your exact seat on the venue map, standard or VIP', tag: 'Students', icon: Armchair },
  { name: 'Stage designer', detail: 'Design venue layouts with rows, seats, and stage shapes', tag: 'Organizers', icon: LayoutGrid },
  { name: 'Organizations', detail: 'Music schools, choirs, and clubs with member invitations', tag: 'Organizers', icon: UsersRound },
  { name: 'Announcements', detail: 'Post updates that reach every member of your organization', tag: 'Organizers', icon: Megaphone },
  { name: 'Practice room', detail: 'Play piano, violin, guitar, flute, and drums in the browser', tag: 'Everyone', icon: Music },
];

const landingStats = [
  { value: 'Live', label: 'Seat maps', detail: 'Choose your exact seat on the venue layout, with standard and VIP tiers' },
  { value: 'Auto', label: 'Waitlists', detail: 'Full events queue registrations, so nobody loses their spot in line' },
  { value: '2', label: 'Roles', detail: 'Students discover and join events; organizers create and manage them' },
  { value: '5', label: 'Instruments', detail: 'A built-in practice room with playable piano, violin, guitar, flute, and drums' },
];

const landingCapabilities = [
  { icon: CalendarDays, title: 'Events and capacity', text: 'Publish events with venue capacity, dates, and pricing. Registration counts stay visible, and full events switch to a waitlist automatically.' },
  { icon: UsersRound, title: 'People and roles', text: 'Students, teachers, and organization owners each get the right view. Invite members to your music school, choir, or club with a single link.' },
  { icon: Bell, title: 'Notifications', text: 'Invitations, announcements, and event reminders arrive in the app and are mirrored to your email, so you never miss a rehearsal or concert.' },
  { icon: ShieldCheck, title: 'Account protection', text: 'Your account is guarded against break-in attempts: repeated wrong passwords trigger a warning and temporarily lock the login.' },
];

function getStoredView(): AppView {
  const value = localStorage.getItem(VIEW_KEY);
  return value === 'home' || value === 'register' || value === 'login' || value === 'events' || value === 'dashboard' || value === 'instruments' || value === 'profile'
    ? value
    : 'home';
}

export default function App() {
  const initialInviteToken = new URLSearchParams(window.location.search).get('token') || new URLSearchParams(window.location.search).get('invite') || '';
  const [inviteToken, setInviteToken] = useState(initialInviteToken);
  const [currentView, setCurrentView] = useState<AppView>(() => initialInviteToken ? 'join' : getStoredView());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuth()?.user ?? null);
  const [dashboardPostId, setDashboardPostId] = useState('');
  const [eventsEventId, setEventsEventId] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGRectElement>(null);

  useLayoutEffect(() => {
    if (currentView !== 'home') return;

    const ctx = gsap.context(() => {
      gsap.timeline({
        scrollTrigger: {
          trigger: '.scrollDist',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        }
      })
      .fromTo('.sky', { y: 0 }, { y: -200 }, 0)
      .fromTo('.cloud1', { y: 100 }, { y: -800 }, 0)
      .fromTo('.cloud2', { y: -150 }, { y: -500 }, 0)
      .fromTo('.cloud3', { y: -50 }, { y: -650 }, 0)
      .fromTo('.mountBg', { y: -10 }, { y: -100 }, 0)
      .fromTo('.mountMg', { y: -30 }, { y: -250 }, 0)
      .fromTo('.mountFg', { y: -50 }, { y: -600 }, 0);

      gsap.utils.toArray<HTMLElement>('.landing-reveal').forEach((section) => {
        gsap.fromTo(section,
          { autoAlpha: 0, y: 46 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 78%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });

      const btn = arrowRef.current;
      if (btn) {
        const onMouseEnter = () => {
          gsap.to('.arrow', { y: 10, duration: 0.8, ease: 'back.inOut(3)', overwrite: 'auto' });
        };
        const onMouseLeave = () => {
          gsap.to('.arrow', { y: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
        };
        const onClick = () => {
          gsap.to(window, { scrollTo: window.innerHeight, duration: 1.5, ease: 'power1.inOut' });
        };

        btn.addEventListener('mouseenter', onMouseEnter);
        btn.addEventListener('mouseleave', onMouseLeave);
        btn.addEventListener('click', onClick);

        return () => {
          btn.removeEventListener('mouseenter', onMouseEnter);
          btn.removeEventListener('mouseleave', onMouseLeave);
          btn.removeEventListener('click', onClick);
        };
      }
    }, containerRef);

    return () => ctx.revert();
  }, [currentView]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('invite') || '';
    if (token) {
      setInviteToken(token);
      setCurrentView('join');
    }
  }, []);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth) {
      if (currentView === 'dashboard' || currentView === 'profile') setCurrentView('login');
      return;
    }

    fetchCurrentUser(auth.token)
      .then(({ user }) => {
        setCurrentUser(user);
        storeAuth({ token: auth.token, user });
        if (currentView === 'dashboard' && user.role !== 'ORGANIZER' && !user.organization) {
          setCurrentView('events');
        }
      })
      .catch(() => {
        clearStoredAuth();
        setCurrentUser(null);
        if (currentView === 'dashboard' || currentView === 'profile') setCurrentView('login');
      });
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, currentView);
  }, [currentView]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [currentView]);

  const handleNavigate = (view: AppView) => {
    if (view === 'dashboard' && !currentUser) {
      setCurrentView('login');
      return;
    }
    if (view === 'profile' && !currentUser) {
      setCurrentView('login');
      return;
    }
    if (view === 'dashboard' && currentUser?.role !== 'ORGANIZER' && !currentUser?.organization) {
      setCurrentView('events');
      return;
    }

    setCurrentView(view);
  };

  const handleOpenInvitation = (token: string) => {
    setInviteToken(token);
    window.history.replaceState(null, '', `${window.location.pathname}?token=${encodeURIComponent(token)}`);
    setCurrentView('join');
  };

  const handleOpenPost = (postId: string) => {
    setDashboardPostId(postId);
    setCurrentView('dashboard');
  };

  const handleOpenEvent = (eventId: string) => {
    setEventsEventId(eventId);
    setCurrentView('events');
  };

  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    if (inviteToken && currentView === 'login') {
      setCurrentView('join');
      return;
    }
    if (currentView === 'join') {
      setInviteToken('');
      window.history.replaceState(null, '', window.location.pathname);
    }
    setCurrentView(user.role === 'ORGANIZER' || user.organization ? 'dashboard' : 'events');
  };

  const handleLogout = () => {
    clearStoredAuth();
    setCurrentUser(null);
    setCurrentView('home');
  };

  return (
    <ClickSpark sparkColor="#ffffff" sparkCount={7} sparkRadius={18} duration={380} enabled={currentView === 'home'}>
      <div 
        ref={containerRef} 
        className={`app-container ${currentView === 'home' ? 'app-home' : ''}`} 
        style={{
          position: 'relative',
          top: 0,
          left: 0,
          width: '100vw',
          minHeight: '100vh',
          height: 'auto',
          overflow: 'visible',
        }}
      >
        <Navbar
          onNavigate={handleNavigate}
          currentView={currentView}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenInvitation={handleOpenInvitation}
          onOpenPost={handleOpenPost}
          onOpenEvent={handleOpenEvent}
        />

        {currentView === 'home' && (
          <>
            <div className="scrollDist"></div>
            
            <main className="home-parallax-stage">
              <svg 
                viewBox="0 0 1200 800" 
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: '100%', height: '100%' }}
              >
                <defs>
                  <mask id="m">
                    <g className="cloud1">
                      <rect fill="#fff" width="100%" height="801" y="799" />
                      <image href="https://assets.codepen.io/721952/cloud1Mask.jpg" width="1200" height="800"/>
                    </g>
                  </mask>
                </defs>
                
                <image className="sky" href="https://assets.codepen.io/721952/sky.jpg" width="1200" height="590" />
                
                <image className="mountMg" href={demetraBackgroundUrl} width="1200" height="800" onLoad={() => ScrollTrigger.refresh()} />    
                <image className="cloud2" href="https://assets.codepen.io/721952/cloud2.png" width="1200" height="800"/>    
                <image className="cloud11" href="https://assets.codepen.io/721952/cloud1.png" width="1200" height="800"/>
                <image className="cloud31" href="https://assets.codepen.io/721952/cloud3.png" width="1200" height="800"/>
                
                <text className="main-title" fill="#fff" x="50%" y="280" textAnchor="middle">DEMETRA</text>
                <text className="hero-subtitle hero-subtitle-desktop" fill="#fff" x="50%" y="322" textAnchor="middle">School concerts, recitals, and rehearsals in one place</text>
                <text className="hero-subtitle hero-subtitle-mobile" fill="#fff" x="50%" y="318" textAnchor="middle">
                  <tspan x="50%">School concerts, recitals,</tspan>
                  <tspan x="50%" dy="20">and rehearsals in one place</tspan>
                </text>
                
                <path 
                  className="arrow" 
                  fill="none" 
                  stroke="#fff" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M600,356 L600,396 M592,388 L600,396 L608,388" 
                />                
                
                <g mask="url(#m)">
                  <rect fill="#fff" width="100%" height="100%" />
                  <text className="main-title main-title-school" x="50%" y="300" textAnchor="middle" fill="#162a43">School events</text>
                </g>
                
                <rect 
                  ref={arrowRef} 
                  id="arrow-btn" 
                  width="50" 
                  height="60" 
                  opacity="0" 
                  x="575" 
                  y="346" 
                  style={{ cursor: 'pointer' }} 
                />
              </svg>
            </main>

            <section className="landing-content" aria-label="Demetra system">
              <div className="landing-band landing-command landing-reveal">
                <div className="stack-copy">
                  <span className="landing-kicker">School music events</span>
                  <h2>Every concert, recital, and rehearsal in one place.</h2>
                  <p>
                    Demetra brings music schools, choirs, and student clubs together with the people who attend
                    their events. Organizers publish concerts and design seating, students pick a seat and
                    register — and everyone stays in the loop with reminders and announcements.
                  </p>
                  <div className="landing-actions">
                    <button type="button" className="landing-primary" onClick={() => handleNavigate('register')}>
                      <UserPlus size={17} />
                      Join us
                    </button>
                    <button type="button" className="landing-secondary" onClick={() => handleNavigate('events')}>
                      See events
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>

                <div className="landing-stat-board" aria-label="Platform highlights">
                  {landingStats.map((stat) => (
                    <div className="landing-stat" key={stat.label}>
                      <b>{stat.value}</b>
                      <span>{stat.label}</span>
                      <p>{stat.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="landing-band landing-service-section landing-reveal">
                <div className="landing-section-head">
                  <span className="landing-kicker">What you can do</span>
                  <h2>Built for organizers. Loved by students.</h2>
                </div>
                <div className="stack-service-grid" aria-label="Platform features">
                  {landingFeatures.map(({ name, detail, tag, icon: Icon }) => (
                    <div className="stack-service-card" key={name}>
                      <Icon size={22} />
                      <div>
                        <b>{name}</b>
                        <span>{detail}</span>
                      </div>
                      <em>{tag}</em>
                    </div>
                  ))}
                </div>
              </div>

              <div className="landing-band landing-capabilities landing-reveal">
                <div className="landing-section-head">
                  <span className="landing-kicker">How it works</span>
                  <h2>Thoughtful details, from invitation to encore.</h2>
                </div>
                <div className="landing-capability-grid">
                  {landingCapabilities.map(({ icon: Icon, title, text }) => (
                    <article className="landing-capability" key={title}>
                      <Icon size={24} />
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="landing-band landing-join-panel landing-reveal">
                <div>
                  <span className="landing-kicker">Get started</span>
                  <h2>Your next event starts here.</h2>
                  <p>Create a free account to browse concerts and recitals — or set up your organization and start hosting.</p>
                </div>
                <button type="button" className="landing-primary landing-join-btn" onClick={() => handleNavigate('register')}>
                  <UserPlus size={18} />
                  Join us
                </button>
              </div>
            </section>
          </>
        )}

        {currentView === 'register' && (
          <Register 
            onBackToHome={() => setCurrentView('home')} 
            onNavigateToLogin={() => setCurrentView('login')} 
            onAuthenticated={handleAuthenticated}
          />
        )}

        {currentView === 'login' && (
          <Login 
            onBackToHome={() => setCurrentView('home')} 
            onNavigateToRegister={() => setCurrentView(inviteToken ? 'join' : 'register')}
            onAuthenticated={handleAuthenticated}
          />
        )}

        {currentView === 'events' && (
          <Events 
            onNavigate={(view) => setCurrentView(view)}
            openEventId={eventsEventId}
            onEventOpened={() => setEventsEventId('')}
          />
        )}

        {currentView === 'instruments' && (
          <Instruments onNavigate={(view) => setCurrentView(view)} />
        )}

        {currentView === 'join' && (
          <JoinInvitation
            token={inviteToken}
            currentUser={currentUser}
            onBackToHome={() => setCurrentView('home')}
            onNavigateToLogin={() => setCurrentView('login')}
            onAuthenticated={handleAuthenticated}
            onLogout={handleLogout}
          />
        )}

        {currentView === 'dashboard' && (
          <Dashboard 
            onNavigate={(view) => setCurrentView(view)}
            currentUser={currentUser}
            onOpenInvitation={handleOpenInvitation}
            onOpenEvent={handleOpenEvent}
            onUserUpdated={setCurrentUser}
            openPostId={dashboardPostId}
            onPostOpened={() => setDashboardPostId('')}
          />
        )}

        {currentView === 'profile' && currentUser && (
          <Profile
            currentUser={currentUser}
            onUserUpdated={setCurrentUser}
            onOpenEvent={handleOpenEvent}
          />
        )}
      </div>
    </ClickSpark>
  );
}
