import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import Navbar from './Navbar';
import Register from './Register'; 
import Login from './Login'; 
import ClickSpark from './ClickSpark'; 
import Events from './Events'; // Import Events component
import './app.css';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export default function App() {
  // 2. Add 'login' to the state type union
  const [currentView, setCurrentView] = useState<'home' | 'register' | 'login' | 'events'>('home');

  const containerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGRectElement>(null);

  useLayoutEffect(() => {
    if (currentView !== 'home') return;

    const ctx = gsap.context(() => {
      // Parallax Timeline
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

      // Button Interaction Animations
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

  return (
    <ClickSpark sparkColor={currentView === 'home' ? "#ffffff" : "#e3cc9a"} sparkCount={10} sparkRadius={25} duration={500}>
      <div 
        ref={containerRef} 
        className="app-container" 
        style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh' }}
      >
        <Navbar onNavigate={(view) => setCurrentView(view)} currentView={currentView} />

        {currentView === 'home' && (
          <>
            <div className="scrollDist"></div>
            
            <main style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', maxWidth: 'none', transform: 'none' }}>
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
                
                <image className="mountMg" href="https://cdn.discordapp.com/attachments/1021731951708741644/1519047193527451770/demetraBackground2.png?ex=6a3c2271&is=6a3ad0f1&hm=cbef87e1f5a65935ac3b35240460db8eac15762e298a12a7a00d7a2409dc34f7&" width="1200" height="800"/>    
                <image className="cloud2" href="https://assets.codepen.io/721952/cloud2.png" width="1200" height="800"/>    
                <image className="cloud11" href="https://assets.codepen.io/721952/cloud1.png" width="1200" height="800"/>
                <image className="cloud31" href="https://assets.codepen.io/721952/cloud3.png" width="1200" height="800"/>
                
                <text className="main-title" fill="#fff" x="50%" y="280" textAnchor="middle">DEMETRA</text>
                
                <path 
                  className="arrow" 
                  fill="none" 
                  stroke="#fff" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M600,320 L600,360 M592,352 L600,360 L608,352" 
                />                
                
                <g mask="url(#m)">
                  <rect fill="#fff" width="100%" height="100%" />      
                  <text className="main-title" x="50%" y="220" textAnchor="middle" fill="#162a43">School events</text>
                </g>
                
                <rect 
                  ref={arrowRef} 
                  id="arrow-btn" 
                  width="50" 
                  height="60" 
                  opacity="0" 
                  x="575" 
                  y="310" 
                  style={{ cursor: 'pointer' }} 
                />
              </svg>
            </main>
          </>
        )}

        {/* 3. Render Register component with the routing prop wired up */}
        {/* Render Register component */}
        {currentView === 'register' && (
          <Register 
            onBackToHome={() => setCurrentView('home')} 
            onNavigateToLogin={() => setCurrentView('login')} 
          />
        )}

        {/* Render Login component */}
        {currentView === 'login' && (
          <Login 
            onBackToHome={() => setCurrentView('home')} 
            onNavigateToRegister={() => setCurrentView('register')} // <-- Added this line to fix Error #3
          />
        )}

        {currentView === 'events' && (
          <Events 
            onNavigate={(view) => setCurrentView(view)} // Pass onNavigate prop to Events
          />
        )}
      </div>
    </ClickSpark>
  );
}