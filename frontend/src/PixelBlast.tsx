import { useEffect, useRef, useState } from "react";

interface PixelBlastProps {
  variant?: "square" | "circle" | "triangle" | "diamond";
  pixelSize?: number;
  color?: string;
  patternScale?: number;
  patternDensity?: number;
  pixelSizeJitter?: number;
  enableRipples?: boolean;
  rippleSpeed?: number;
  rippleThickness?: number;
  rippleIntensityScale?: number;
  liquid?: boolean;
  liquidStrength?: number;
  liquidRadius?: number;
  liquidWobbleSpeed?: number;
  speed?: number;
  edgeFade?: number;
  noiseAmount?: number;
  transparent?: boolean;
}

export default function PixelBlast({
  variant = "square",
  pixelSize = 4,
  color = "#B497CF",
  patternScale = 2,
  patternDensity = 1,
  pixelSizeJitter = 0,
  enableRipples = true,
  rippleSpeed = 0.3,
  rippleThickness = 0.1,
  rippleIntensityScale = 1,
  liquid = false,
  liquidStrength = 0.1,
  liquidRadius = 1,
  liquidWobbleSpeed = 4.5,
  speed = 0.5,
  edgeFade = 0.25,
  noiseAmount = 0,
  transparent = true,
}: PixelBlastProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.02 * speed;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      if (!transparent) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      }

      ctx.fillStyle = color;
      const size = pixelSize;

      for (let x = 0; x < dimensions.width; x += size + 2) {
        for (let y = 0; y < dimensions.height; y += size + 2) {
          const noise = Math.sin(x * 0.01 * patternScale + time) * Math.cos(y * 0.01 * patternScale + time);
          
          if (noise > 1 - patternDensity) {
            const jitter = (Math.random() - 0.5) * pixelSizeJitter * size;
            const finalSize = Math.max(1, size + jitter);

            ctx.beginPath();
            if (variant === "circle") {
              ctx.arc(x + size / 2, y + size / 2, finalSize / 2, 0, Math.PI * 2);
              ctx.fill();
            } else if (variant === "triangle") {
              ctx.moveTo(x + size / 2, y);
              ctx.lineTo(x + size, y + finalSize);
              ctx.lineTo(x, y + finalSize);
              ctx.closePath();
              ctx.fill();
            } else if (variant === "diamond") {
              ctx.moveTo(x + size / 2, y);
              ctx.lineTo(x + size, y + size / 2);
              ctx.lineTo(x + size / 2, y + size);
              ctx.lineTo(x, y + size / 2);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.fillRect(x, y, finalSize, finalSize);
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions, variant, pixelSize, color, patternScale, patternDensity, pixelSizeJitter, speed, transparent]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}