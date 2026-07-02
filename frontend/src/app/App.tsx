import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ArrowRight, UserPlus } from 'lucide-react';
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
  { num: '01', name: 'Events & Tickets', detail: 'Browse published events and register in a couple of clicks.', tag: 'Students' },
  { num: '02', name: 'Live Seat Selection', detail: 'Pick your exact seat on the interactive venue map, standard or VIP.', tag: 'Students' },
  { num: '03', name: 'Stage Designer', detail: 'Design venue layouts with rows, seats, and stage shapes.', tag: 'Organizers' },
  { num: '04', name: 'Organizations & Invitations', detail: 'Music schools, choirs, and clubs with member invitations.', tag: 'Organizers' },
  { num: '05', name: 'Announcements', detail: 'Post updates that reach every member of your organization.', tag: 'Organizers' },
  { num: '06', name: 'Practice Room', detail: 'Piano, violin, guitar, flute, and drums - playable right in the browser.', tag: 'Everyone' },
];

const landingStats = [
  { value: 'Live', label: 'Seat maps', detail: 'Choose your exact seat on the venue layout, standard or VIP tier.' },
  { value: 'Auto', label: 'Waitlists', detail: 'Full events queue registrations automatically - no spot is lost.' },
  { value: '2', label: 'Roles', detail: 'Students discover events. Organizers create and manage them.' },
  { value: '5', label: 'Instruments', detail: 'Piano, violin, guitar, flute, and drums - playable in the browser.' },
];

const landingHiw = [
  { roman: 'I', title: 'Events and capacity', text: 'Publish events with venue capacity, dates, and pricing. Registration counts stay visible, and full events switch to a waitlist automatically.' },
  { roman: 'II', title: 'People and roles', text: 'Students, teachers, and organization owners each get the right view. Invite members to your music school, choir, or club with a single link.' },
  { roman: 'III', title: 'Notifications', text: 'Invitations, announcements, and event reminders arrive in-app and by email, so you never miss a rehearsal or concert.' },
  { roman: 'IV', title: 'Account protection', text: 'Repeated wrong passwords trigger a warning and temporarily lock the login - no silent compromise.' },
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
          end: 'bottom top',
          scrub: 1.7,
        }
      })
      .fromTo('.sky', { y: 0 }, { y: -200 }, 0)
      .fromTo('.cloud1', { y: 100 }, { y: -800 }, 0)
      .fromTo('.cloud2', { y: -150 }, { y: -500 }, 0)
      .fromTo('.cloud3', { y: -50 }, { y: -650 }, 0)
      .fromTo('.mountBg', { y: -10 }, { y: -100 }, 0)
      .fromTo('.mountMg', { y: -30 }, { y: -250 }, 0)
      .fromTo('.mountFg', { y: -50 }, { y: -600 }, 0)
      .fromTo('.hero-line-field', { autoAlpha: 0 }, { autoAlpha: 1 }, 0.1)
      .fromTo('.hero-rise-line', { y: 210, autoAlpha: 0 }, { y: -250, autoAlpha: 1, stagger: 0.018, ease: 'none' }, 0.12);

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

      const cleanups: Array<() => void> = [];
      const btn = arrowRef.current;
      if (btn) {
        const onMouseEnter = () => {
          gsap.to('.arrow', { y: 10, duration: 0.8, ease: 'back.inOut(3)', overwrite: 'auto' });
        };
        const onMouseLeave = () => {
          gsap.to('.arrow', { y: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
        };
        const onClick = () => {
          const landingTop = document.querySelector('.landing-content')?.getBoundingClientRect().top ?? window.innerHeight;
          gsap.to(window, { scrollTo: window.scrollY + landingTop, duration: 2.1, ease: 'power1.inOut' });
        };

        btn.addEventListener('mouseenter', onMouseEnter);
        btn.addEventListener('mouseleave', onMouseLeave);
        btn.addEventListener('click', onClick);

        cleanups.push(() => {
          btn.removeEventListener('mouseenter', onMouseEnter);
          btn.removeEventListener('mouseleave', onMouseLeave);
          btn.removeEventListener('click', onClick);
        });
      }

      document.querySelectorAll<HTMLElement>('.feature-row').forEach((row) => {
        const onMouseEnter = () => gsap.to(row, { paddingLeft: 60, duration: 0.35, ease: 'power2.out' });
        const onMouseLeave = () => gsap.to(row, { paddingLeft: 0, duration: 0.3, ease: 'power2.out' });
        row.addEventListener('mouseenter', onMouseEnter);
        row.addEventListener('mouseleave', onMouseLeave);
        cleanups.push(() => {
          row.removeEventListener('mouseenter', onMouseEnter);
          row.removeEventListener('mouseleave', onMouseLeave);
        });
      });

      return () => cleanups.forEach((cleanup) => cleanup());
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
        data-view={currentView}
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
                  <rect className="hero-reveal-bg" width="100%" height="100%" />
                  <g className="hero-line-field" aria-hidden="true">
                    {Array.from({ length: 31 }, (_, index) => {
                      const x = 30 + index * 38;
                      const height = 210 + (index % 5) * 34;
                      const y = 520 - height;
                      return (
                        <line
                          key={index}
                          className="hero-rise-line"
                          x1={x}
                          x2={x}
                          y1={y}
                          y2={520}
                        />
                      );
                    })}
                  </g>
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

            <div className="landing-content">
              <section className="landing-band manifesto landing-reveal" aria-label="About Demetra">
                <div className="manifesto-index">
                  <div className="manifesto-index-num">01 / 04</div>
                  Platform
                </div>
                <div className="manifesto-body">
                  <h2>
                    Music deserves better than<br />
                    <em>spreadsheets and email chains.</em>
                  </h2>
                  <div className="manifesto-cols">
                    <p>Demetra brings music schools, choirs, and student clubs together with the audiences who come to their events. One platform - from the first rehearsal to the final bow.</p>
                    <p>Organizers publish concerts, design seating, and broadcast announcements. Students browse, register, and choose their seats. Everyone stays in sync.</p>
                  </div>
                </div>
              </section>

              <div className="number-strip landing-reveal">
                <div className="number-strip-inner">
                  {landingStats.map((stat) => (
                    <div className="num-cell" key={stat.label}>
                      <b>{stat.value}</b>
                      <span>{stat.label}</span>
                      <p>{stat.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <section className="landing-band features" aria-label="Features">
                <div className="features-header landing-reveal">
                  <div>
                    <div className="section-eyebrow">02 / 04 - What you can do</div>
                    <h2>Built for organizers.<br />Loved by students.</h2>
                  </div>
                  <p className="features-header-right">
                    Every feature is designed to reduce friction between a music organization and its community - from first invite to last encore.
                  </p>
                </div>
                <div className="feature-list landing-reveal">
                  {landingFeatures.map((feature) => (
                    <div className="feature-row" key={feature.num}>
                      <span className="feat-num">{feature.num}</span>
                      <div className="feature-row-body">
                        <div className="feature-row-title">{feature.name}</div>
                        <div className="feature-row-desc">{feature.detail}</div>
                      </div>
                      <span className="feat-tag">{feature.tag}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pull-quote-band landing-reveal" aria-label="Philosophy">
                <div className="pull-quote-inner">
                  <div className="pq-bar" aria-hidden="true" />
                  <blockquote className="pq-text">
                    "The curtain rises when the last seat is filled.{' '}
                    <strong>Demetra fills the seats.</strong>"
                  </blockquote>
                </div>
              </div>

              <section className="landing-band hiw" aria-label="How it works">
                <div className="hiw-header landing-reveal">
                  <div>
                    <div className="section-eyebrow">03 / 04 - How it works</div>
                    <h2>Thoughtful details,<br />from invitation to encore.</h2>
                  </div>
                </div>
                <div className="hiw-grid landing-reveal">
                  {landingHiw.map((item) => (
                    <div className="hiw-cell" key={item.roman}>
                      <div className="hiw-cell-num" aria-hidden="true">{item.roman}</div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cta-closer" aria-label="Get started">
                <div className="cta-closer-bg" aria-hidden="true">DEMETRA</div>
                <div className="cta-closer-inner landing-reveal">
                  <span className="cta-kicker">04 / 04 - Get started</span>
                  <h2>Your next event<br />starts here.</h2>
                  <p>Create a free account to browse concerts and recitals - or set up your organization and start hosting.</p>
                  <div className="cta-buttons">
                    <button type="button" className="cta-main" onClick={() => handleNavigate('register')}>
                      <UserPlus size={16} />
                      Join us
                    </button>
                    <button type="button" className="cta-ghost" onClick={() => handleNavigate('events')}>
                      Browse events
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </section>
            </div>
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

