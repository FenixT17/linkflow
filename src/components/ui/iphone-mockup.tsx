"use client";

import { useEffect, useRef, useState } from "react";

interface IPhoneMockupProps {
  className?: string;
  children: React.ReactNode;
}

export function IPhoneMockup({ className, children }: IPhoneMockupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setMousePos({ x: x * 8, y: y * 8 });
    };

    const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={["relative mx-auto", className].filter(Boolean).join(" ")}
      style={{ perspective: "1200px" }}
    >
      <div
        style={{
          transform: `rotateY(${mousePos.x * 0.3}deg) rotateX(${-mousePos.y * 0.3}deg)`,
          transition: "transform 0.15s ease-out",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Glow behind phone */}
        <div className="absolute -inset-8 bg-gradient-to-b from-white/[0.08] to-transparent rounded-[4rem] blur-2xl opacity-60 pointer-events-none" />

        <div className="relative w-[260px] sm:w-[300px] md:w-[340px]">
          {/* Outer frame — glass */}
          <div className="relative rounded-[3rem] border border-white/[0.12] bg-[#111] p-[10px] glass-shadow">
            {/* Dynamic Island */}
            <div className="absolute inset-x-0 top-3 z-20 flex justify-center">
              <div className="h-[28px] w-[100px] rounded-full bg-black border border-white/[0.06] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>

            {/* Screen */}
            <div className="relative overflow-hidden rounded-[2.3rem] bg-[var(--background)] border border-white/[0.06]">
              {children}
            </div>

            {/* Ring light reflection */}
            <div className="absolute -inset-[1px] rounded-[3rem] pointer-events-none ring-1 ring-inset ring-white/[0.06]" />
          </div>

          {/* Side buttons */}
          <div className="absolute -left-[2px] top-24 w-[3px] h-10 rounded-l-sm bg-white/[0.08]" />
          <div className="absolute -left-[2px] top-36 w-[3px] h-14 rounded-l-sm bg-white/[0.08]" />
          <div className="absolute -left-[2px] top-52 w-[3px] h-14 rounded-l-sm bg-white/[0.08]" />
          <div className="absolute -right-[2px] top-32 w-[3px] h-16 rounded-r-sm bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}
