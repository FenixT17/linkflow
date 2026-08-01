"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  /** Data-alvo ISO. Se ausente, mostra "Em breve". */
  target?: string;
  accent?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Countdown({ target, accent }: CountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const targetTime = target ? new Date(target).getTime() : NaN;
  const diff = target ? Math.max(0, targetTime - now) : 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (!target) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm">
        Em breve
      </div>
    );
  }

  // Evita hydration mismatch: só renderiza os números após montar no cliente
  if (!mounted) {
    return (
      <div className="flex gap-2 sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex min-w-[58px] flex-col items-center rounded-2xl border border-white/12 bg-white/[0.05] px-2 py-3 backdrop-blur-sm"
          >
            <span className="text-xl font-semibold tabular-nums sm:text-2xl" style={{ color: accent }}>
              00
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wider opacity-60">dias</span>
          </div>
        ))}
      </div>
    );
  }

  const cells = [
    { label: "Dias", value: pad(days) },
    { label: "Horas", value: pad(hours) },
    { label: "Min", value: pad(minutes) },
    { label: "Seg", value: pad(seconds) },
  ];

  return (
    <div className="flex gap-2 sm:gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="flex min-w-[58px] flex-col items-center rounded-2xl border border-white/12 bg-white/[0.05] px-2 py-3 backdrop-blur-sm"
        >
          <span
            className="text-xl font-semibold tabular-nums sm:text-2xl"
            style={{ color: accent }}
          >
            {c.value}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider opacity-60">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
