"use client";

import { useEffect, useRef } from "react";

interface BinaryRainProps {
  opacity?: number;
  className?: string;
}

export function BinaryRain({ opacity = 0.05, className = "" }: BinaryRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const chars = "01";
    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize);
    let drops: number[] = [];
    let speeds: number[] = [];

    const initDrops = () => {
      columns = Math.floor(canvas.width / fontSize);
      drops = [];
      speeds = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
        speeds[i] = 0.3 + Math.random() * 0.7;
      }
    };
    initDrops();

    const draw = () => {
      ctx.fillStyle = "rgba(13, 17, 23, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "Share Tech Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        if (Math.random() > 0.85) {
          ctx.fillStyle = "#00a088";
          ctx.shadowBlur = 12;
          ctx.shadowColor = "#00a088";
        } else {
          ctx.fillStyle = "rgba(0, 160, 136, 0.6)";
          ctx.shadowBlur = 0;
        }

        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += speeds[i];
      }
    };

    const interval = setInterval(draw, 45);

    const handleResize = () => {
      resize();
      initDrops();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex: 0, opacity }}
    />
  );
}
