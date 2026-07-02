import { useEffect, useLayoutEffect, useRef } from 'react';
import { useState } from 'react';
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

const landingFeatures = [
  { num: '01', name: 'Events & Tickets',              detail: 'Browse published events and register in a couple of clicks.',                    tag: 'Students'   },
  { num: '02', name: 'Live Seat Selection',           detail: 'Pick your exact seat on the interactive venue map, standard or VIP.',            tag: 'Students'   },
  { num: '03', name: 'Stage Designer',                detail: 'Design venue layouts with rows, seats, and stage shapes.',                       tag: 'Organizers' },
  { num: '04', name: 'Organizations & Invitations',   detail: 'Music schools, choirs, and clubs with member invitations.',                      tag: 'Organizers' },
  { num: '05', name: 'Announcements',                 detail: 'Post updates that reach every member of your organization.',                     tag: 'Organizers' },
  { num: '06', name: 'Practice Room',                 detail: 'Piano, violin, guitar, flute, and drums — playable right in the browser.',       tag: 'Everyone'   },
];

const landingStats = [
  { value: 'Live', label: 'Seat maps',   detail: 'Choose your exact seat on the venue layout, standard or VIP tier.'       },
  { value: 'Auto', label: 'Waitlists',   detail: 'Full events queue registrations automatically — no spot is lost.'         },
  { value: '2',    label: 'Roles',       detail: 'Students discover events. Organizers create and manage them.'             },
  { value: '5',    label: 'Instruments', detail: 'Piano, violin, guitar, flute, and drums — playable in the browser.'       },
];

const landingHiw = [
  { roman: 'I',   title: 'Events and capacity',   text: 'Publish events with venue capacity, dates, and pricing. Registration counts stay visible, and full events switch to a waitlist automatically.' },
  { roman: 'II',  title: 'People and roles',       text: 'Students, teachers, and organization owners each get the right view. Invite members to your music school, choir, or club with a single link.' },
  { roman: 'III', title: 'Notifications',          text: 'Invitations, announcements, and event reminders arrive in-app and by email, so you never miss a rehearsal or concert.' },
  { roman: 'IV',  title: 'Account protection',     text: 'Repeated wrong passwords trigger a warning and temporarily lock the login — no silent compromise.' },
];

const marqueeItems = [
  'Spring Piano Recital', 'Chamber Ensemble Night', 'Choir Season Finale',
  'Jazz Workshop', 'Year-End Concert', 'Violin Masterclass',
  'Youth Orchestra Showcase', 'Winter Recital', 'Music Theory Seminar',
];

function getStoredView(): AppView {
  const value = localStorage.getItem(VIEW_KEY);
  return value === 'home' || value === 'register' || value === 'login' || value === 'events' || value === 'dashboard' || value === 'instruments' || value === 'profile'
    ? value
    : 'home';
}

export default function App() {
  const initialInviteToken = new URLSearchParams(window.location.search).get('token') || new URLSearchParams(window.location.search).get('invite') || '';
  const [inviteToken, setInviteToken]       = useState(initialInviteToken);
  const [currentView, setCurrentView]       = useState<AppView>(() => initialInviteToken ? 'join' : getStoredView());
  const [currentUser, setCurrentUser]       = useState<AuthUser | null>(() => getStoredAuth()?.user ?? null);
  const [dashboardPostId, setDashboardPostId] = useState('');
  const [eventsEventId, setEventsEventId]   = useState('');

  const containerRef  = useRef<HTMLDivElement>(null);
  const arrowRef      = useRef<SVGRectElement>(null);
  const mqTrackRef    = useRef<HTMLDivElement>(null);
  const mqInnerRef    = useRef<HTMLDivElement>(null);

  /* ── GSAP home animations ── */
  useLayoutEffect(() => {
    if (currentView !== 'home') return;

    const ctx = gsap.context(() => {

      /* Parallax scroll timeline */
      gsap.timeline({
        scrollTrigger: {
          trigger: '.scrollDist',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.2,
        },
      })
        .fromTo('.sky',     { y: 0 },    { y: -180 }, 0)
        .fromTo('.cloud1',  { y: 100 },  { y: -800 }, 0)
        .fromTo('.cloud2',  { y: -150 }, { y: -500 }, 0)
        .fromTo('.cloud31', { y: -50 },  { y: -650 }, 0)
        .fromTo('.cloud11', { y: 0 },    { y: -300 }, 0)
        .fromTo('.mountMg', { y: -30 },  { y: -250 }, 0);

      /* Scroll-reveal */
      gsap.utils.toArray<HTMLElement>('.landing-reveal').forEach((el) => {
        gsap.fromTo(el,
          { autoAlpha: 0, y: 40 },
          {
            autoAlpha: 1, y: 0,
            duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' },
          },
        );
      });

      /* Arrow hover + click */
      const btn = arrowRef.current;
      if (btn) {
        const arrPath = document.querySelector<SVGPathElement>('.hero-arrow');
        const onEnter = () => gsap.to(arrPath, { y: 10, duration: 0.7, ease: 'back.inOut(3)', overwrite: 'auto' });
        const onLeave = () => gsap.to(arrPath, { y: 0,  duration: 0.5, ease: 'power3.out',    overwrite: 'auto' });
        const onClick = () => gsap.to(window, { scrollTo: window.innerHeight, duration: 1.4, ease: 'power1.inOut' });
        btn.addEventListener('mouseenter', onEnter);
        btn.addEventListener('mouseleave', onLeave);
        btn.addEventListener('click', onClick);
        return () => {
          btn.removeEventListener('mouseenter', onEnter);
          btn.removeEventListener('mouseleave', onLeave);
          btn.removeEventListener('click', onClick);
        };
      }

      /* Scroll-cue line pulse */
      gsap.to('.scroll-arrow-line', {
        scaleY: 0.3, transformOrigin: 'top',
        duration: 1, ease: 'power1.inOut',
        repeat: -1, yoyo: true,
      });

      /* Feature row indent on hover */
      document.querySelectorAll<HTMLElement>('.feature-row').forEach((row) => {
        row.addEventListener('mouseenter', () => gsap.to(row, { paddingLeft: 60, duration: 0.35, ease: 'power2.out' }));
        row.addEventListener('mouseleave', () => gsap.to(row, { paddingLeft: 0,  duration: 0.30, ease: 'power2.out' }));
      });

    }, containerRef);

    return () => ctx.revert();
  }, [currentView]);

  /* ── Marquee ── */
  useEffect(() => {
    if (currentView !== 'home') return;
    const track = mqTrackRef.current;
    const inner = mqInnerRef.current;
    if (!track || !inner) return;
    const w = inner.scrollWidth;
    const anim = gsap.to(track, {
      x: -w, duration: 28, ease: 'none', repeat: -1,
      modifiers: { x: gsap.utils.unitize((v: number) => v % w) },
    });
    return () => { anim.kill(); };
  }, [currentView]);

  /* ── URL invite token ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('invite') || '';
    if (token) { setInviteToken(token); setCurrentView('join'); }
  }, []);

  /* ── Auth rehydration ── */
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
        if (currentView === 'dashboard' && user.role !== 'ORGANIZER' && !user.organization) setCurrentView('events');
      })
      .catch(() => {
        clearStoredAuth();
        setCurrentUser(null);
        if (currentView === 'dashboard' || currentView === 'profile') setCurrentView('login');
      });
  }, []);

  /* ── Persist view ── */
  useEffect(() => { localStorage.setItem(VIEW_KEY, currentView); }, [currentView]);

  /* ── Scroll to top on view change ── */
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [currentView]);

  /* ── Navigation helpers ── */
  const handleNavigate = (view: AppView) => {
    if ((view === 'dashboard' || view === 'profile') && !currentUser) { setCurrentView('login'); return; }
    if (view === 'dashboard' && currentUser?.role !== 'ORGANIZER' && !currentUser?.organization) { setCurrentView('events'); return; }
    setCurrentView(view);
  };

  const handleOpenInvitation = (token: string) => {
    setInviteToken(token);
    window.history.replaceState(null, '', `${window.location.pathname}?token=${encodeURIComponent(token)}`);
    setCurrentView('join');
  };

  const handleOpenPost = (postId: string) => { setDashboardPostId(postId); setCurrentView('dashboard'); };
  const handleOpenEvent = (eventId: string) => { setEventsEventId(eventId); setCurrentView('events'); };

  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    if (inviteToken && currentView === 'login') { setCurrentView('join'); return; }
    if (currentView === 'join') { setInviteToken(''); window.history.replaceState(null, '', window.location.pathname); }
    setCurrentView(user.role === 'ORGANIZER' || user.organization ? 'dashboard' : 'events');
  };

  const handleLogout = () => { clearStoredAuth(); setCurrentUser(null); setCurrentView('home'); };

  /* ── Render ── */
  return (
    <ClickSpark sparkColor="#ffffff" sparkCount={7} sparkRadius={18} duration={380} enabled={currentView === 'home'}>
      <div
        ref={containerRef}
        className={`app-container ${currentView === 'home' ? 'app-home' : ''}`}
        style={{ position: 'relative', top: 0, left: 0, width: '100vw', minHeight: '100vh', height: 'auto', overflow: 'visible' }}
      >
        {/* ── Your existing Navbar, untouched ── */}
        <Navbar
          onNavigate={handleNavigate}
          currentView={currentView}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenInvitation={handleOpenInvitation}
          onOpenPost={handleOpenPost}
          onOpenEvent={handleOpenEvent}
        />

        {/* ════════════════════════════════════════
            HOME — award-winning editorial layout
            ════════════════════════════════════════ */}
        {currentView === 'home' && (
          <>
            <div className="scrollDist" />

            {/* Fixed parallax stage */}
            <main className="home-parallax-stage" aria-label="Hero — Demetra school music events">

              {/* Giant background title always visible behind clouds */}
              <div className="hero-bg-title" aria-hidden="true">
                <span>DEMETRA</span>
              </div>

              {/* SVG cloud / sky layer sits on top */}
              <svg
                className="hero-svg-layer"
                viewBox="0 0 1200 800"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <mask id="m">
                    <g className="cloud1">
                      <rect fill="#fff" width="100%" height="801" y="799" />
                      <image href="https://assets.codepen.io/721952/cloud1Mask.jpg" width="1200" height="800" />
                    </g>
                  </mask>
                </defs>

                <image className="sky"     href="https://assets.codepen.io/721952/sky.jpg"    width="1200" height="590" />
                <image className="mountMg" href="https://assets.codepen.io/721952/mountMg.jpg" width="1200" height="800" onLoad={() => ScrollTrigger.refresh()} />
                <image className="cloud2"  href="https://assets.codepen.io/721952/cloud2.png"  width="1200" height="800" />
                <image className="cloud11" href="https://assets.codepen.io/721952/cloud1.png"  width="1200" height="800" />
                <image className="cloud31" href="https://assets.codepen.io/721952/cloud3.png"  width="1200" height="800" />

                {/* Scroll arrow */}
                <path
                  className="hero-arrow"
                  fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  d="M600,730 L600,758 M593,751 L600,758 L607,751"
                />

                {/* Mask layer: cream bg + dark title revealed by cloud cutout */}
                <g mask="url(#m)">
                  <rect fill="#f5f2eb" width="100%" height="100%" />
                  <text
                    x="50%" y="50%"
                    dominantBaseline="middle" textAnchor="middle"
                    fontFamily="'Cinzel',serif" fontWeight="900"
                    fontSize="216" letterSpacing="-2"
                    fill="#0a0a08"
                  >DEMETRA</text>
                </g>

                {/* Invisible arrow hit target */}
                <rect
                  ref={arrowRef}
                  id="arrow-btn"
                  width="60" height="60" opacity="0"
                  x="570" y="722"
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                />
              </svg>

              {/* Hero footer row */}
              <div className="hero-footer">
                <p className="hero-tagline">School concerts, recitals &amp; rehearsals — in one place</p>
                <div className="hero-scroll-cue" onClick={() => gsap.to(window, { scrollTo: window.innerHeight, duration: 1.4, ease: 'power1.inOut' })}>
                  <span>Scroll</span>
                  <div className="scroll-arrow-line" />
                </div>
                <p className="hero-year">Est. 2024<br />Music Platform</p>
              </div>
            </main>

            {/* ── Marquee band ── */}
            <div className="marquee-band" role="marquee" aria-label="Upcoming events">
              <div className="marquee-track" ref={mqTrackRef}>
                {[0, 1].map((copy) => (
                  <div className="marquee-inner" key={copy} ref={copy === 0 ? mqInnerRef : undefined} aria-hidden={copy === 1}>
                    {marqueeItems.map((name) => (
                      <span className="marquee-item" key={name}>
                        {name} <i />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Editorial landing content ── */}
            <div className="landing-content">

              {/* 01 — Manifesto */}
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
                    <p>Demetra brings music schools, choirs, and student clubs together with the audiences who come to their events. One platform — from the first rehearsal to the final bow.</p>
                    <p>Organizers publish concerts, design seating, and broadcast announcements. Students browse, register, and choose their seats. Everyone stays in sync.</p>
                  </div>
                </div>
              </section>

              {/* Number strip */}
              <div className="number-strip landing-reveal">
                <div className="number-strip-inner">
                  {landingStats.map((s) => (
                    <div className="num-cell" key={s.label}>
                      <b>{s.value}</b>
                      <span>{s.label}</span>
                      <p>{s.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 02 — Features */}
              <section className="landing-band features" aria-label="Features">
                <div className="features-header landing-reveal">
                  <div>
                    <div className="section-eyebrow">02 / 04 — What you can do</div>
                    <h2>Built for organizers.<br />Loved by students.</h2>
                  </div>
                  <p className="features-header-right">
                    Every feature is designed to reduce friction between a music organization and its community — from first invite to last encore.
                  </p>
                </div>
                <div className="feature-list landing-reveal">
                  {landingFeatures.map((f) => (
                    <div className="feature-row" key={f.num}>
                      <span className="feat-num">{f.num}</span>
                      <div className="feature-row-body">
                        <div className="feature-row-title">{f.name}</div>
                        <div className="feature-row-desc">{f.detail}</div>
                      </div>
                      <span className="feat-tag">{f.tag}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Pull quote */}
              <div className="pull-quote-band landing-reveal" aria-label="Philosophy">
                <div className="pull-quote-inner">
                  <div className="pq-bar" aria-hidden="true" />
                  <blockquote className="pq-text">
                    "The curtain rises when the last seat is filled.{' '}
                    <strong>Demetra fills the seats.</strong>"
                  </blockquote>
                </div>
              </div>

              {/* 03 — How it works */}
              <section className="landing-band hiw" aria-label="How it works">
                <div className="hiw-header landing-reveal">
                  <div>
                    <div className="section-eyebrow">03 / 04 — How it works</div>
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

              {/* 04 — CTA closer */}
              <section className="cta-closer" aria-label="Get started">
                <div className="cta-closer-bg" aria-hidden="true">DEMETRA</div>
                <div className="cta-closer-inner landing-reveal">
                  <span className="cta-kicker">04 / 04 — Get started</span>
                  <h2>Your next event<br />starts here.</h2>
                  <p>Create a free account to browse concerts and recitals — or set up your organization and start hosting.</p>
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

            </div>{/* end .landing-content */}
          </>
        )}

        {/* ── All other views — unchanged ── */}
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