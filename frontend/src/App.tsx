import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import Navbar from './Navbar';
import './app.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGRectElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      
      // 1. Parallax Timeline
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

      // 2. Button Interaction Animations
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
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="app-container" 
      style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh' }}
    >
      {/* Navigation overlay */}
      <Navbar />

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
          
          {/* Main Title adjusted with elegant Cinzel typography class */}
          <text className="main-title" fill="#fff" x="50%" y="220" textAnchor="middle">DEMETRA</text>
          <polyline className="arrow" fill="#fff" points="599,260 599,299 590,289 590,292 600,302 610,292 610,289 601,299 601,260" />
          
          <g mask="url(#m)">
            <rect fill="#fff" width="100%" height="100%" />      
            <text className="main-title" x="50%" y="220" textAnchor="middle" fill="#162a43">School events</text>
          </g>
          
          <rect ref={arrowRef} id="arrow-btn" width="120" height="120" opacity="0" x="540" y="220" />
        </svg>
      </main>
    </div>
  );
}