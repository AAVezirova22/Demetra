import React, { useRef, useState, useEffect } from 'react';

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: string;
  extraScale?: number;
  children?: React.ReactNode;
}

interface SparkInstance {
  id: number;
  x: number;
  y: number;
}

export default function ClickSpark({
  sparkColor = '#ffffff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  children,
}: ClickSparkProps) {
  const [sparks, setSparks] = useState<SparkInstance[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      // Calculate local mouse placement coordinates
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newSpark: SparkInstance = {
        id: Date.now() + Math.random(),
        x,
        y,
      };

      setSparks((prev) => [...prev, newSpark]);

      // Prune structural instance after duration passes
      setTimeout(() => {
        setSparks((prev) => prev.filter((s) => s.id !== newSpark.id));
      }, duration);
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [duration]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      
      {sparks.map((spark) => {
        const svgSize = (sparkRadius + sparkSize) * 2 * extraScale;
        return (
          <svg
            key={spark.id}
            width={svgSize}
            height={svgSize}
            viewBox="0 0 100 100"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            stroke={sparkColor}
            style={{
              position: 'absolute',
              left: spark.x - svgSize / 2,
              top: spark.y - svgSize / 2,
              pointerEvents: 'none',
              zIndex: 9999,
              transform: 'rotate(-20deg)',
            }}
          >
            <style>{`
              @keyframes spark-dash {
                0% { stroke-dashoffset: 30; transform: scale(0.3) rotate(var(--rot)) translateY(15px); }
                100% { stroke-dashoffset: 10; transform: scale(1) rotate(var(--rot)) translateY(0px); }
              }
              .spark-line {
                transform-origin: center;
                stroke-dasharray: 30;
                animation: spark-dash ${duration}ms ${easing} forwards;
              }
            `}</style>
            {Array.from({ length: sparkCount }).map((_, i) => {
              const degrees = (i * 360) / sparkCount;
              return (
                <line
                  key={i}
                  x1="50"
                  y1="30"
                  x2="50"
                  y2="4"
                  className="spark-line"
                  style={{ '--rot': `${degrees}deg` } as React.CSSProperties}
                />
              );
            })}
          </svg>
        );
      })}
    </div>
  );
}