"use client";

import { useState, useMemo } from "react";
import { PremiumCard } from "@/components/ui/premium-card";
import { Globe } from "lucide-react";

interface CountryPoint {
  code: string;
  name: string;
  x: number;
  y: number;
}

const COUNTRY_POINTS: CountryPoint[] = [
  { code: "PT", name: "Portugal", x: 446, y: 176 },
  { code: "ES", name: "Espanha", x: 453, y: 171 },
  { code: "FR", name: "França", x: 463, y: 158 },
  { code: "DE", name: "Alemanha", x: 480, y: 152 },
  { code: "GB", name: "Reino Unido", x: 455, y: 145 },
  { code: "IT", name: "Itália", x: 485, y: 167 },
  { code: "NL", name: "Holanda", x: 472, y: 148 },
  { code: "BE", name: "Bélgica", x: 466, y: 152 },
  { code: "CH", name: "Suíça", x: 477, y: 160 },
  { code: "AT", name: "Áustria", x: 483, y: 158 },
  { code: "SE", name: "Suécia", x: 482, y: 128 },
  { code: "NO", name: "Noruega", x: 476, y: 118 },
  { code: "DK", name: "Dinamarca", x: 476, y: 141 },
  { code: "FI", name: "Finlândia", x: 495, y: 120 },
  { code: "PL", name: "Polónia", x: 489, y: 151 },
  { code: "UA", name: "Ucrânia", x: 507, y: 153 },
  { code: "TR", name: "Turquia", x: 510, y: 172 },
  { code: "RU", name: "Rússia", x: 560, y: 125 },
  { code: "US", name: "Estados Unidos", x: 226, y: 165 },
  { code: "CA", name: "Canadá", x: 214, y: 130 },
  { code: "MX", name: "México", x: 200, y: 195 },
  { code: "BR", name: "Brasil", x: 288, y: 270 },
  { code: "AR", name: "Argentina", x: 275, y: 330 },
  { code: "CL", name: "Chile", x: 257, y: 320 },
  { code: "CO", name: "Colômbia", x: 245, y: 230 },
  { code: "PE", name: "Peru", x: 238, y: 245 },
  { code: "VE", name: "Venezuela", x: 258, y: 222 },
  { code: "ZA", name: "África do Sul", x: 500, y: 320 },
  { code: "EG", name: "Egipto", x: 505, y: 188 },
  { code: "NG", name: "Nigéria", x: 467, y: 222 },
  { code: "KE", name: "Quénia", x: 525, y: 248 },
  { code: "MA", name: "Marrocos", x: 440, y: 183 },
  { code: "CN", name: "China", x: 715, y: 180 },
  { code: "IN", name: "Índia", x: 650, y: 208 },
  { code: "JP", name: "Japão", x: 785, y: 168 },
  { code: "KR", name: "Coreia do Sul", x: 755, y: 178 },
  { code: "ID", name: "Indonésia", x: 710, y: 260 },
  { code: "TH", name: "Tailândia", x: 675, y: 215 },
  { code: "VN", name: "Vietname", x: 690, y: 215 },
  { code: "MY", name: "Malásia", x: 695, y: 248 },
  { code: "PH", name: "Filipinas", x: 735, y: 218 },
  { code: "SG", name: "Singapura", x: 695, y: 252 },
  { code: "AU", name: "Austrália", x: 800, y: 330 },
  { code: "NZ", name: "Nova Zelândia", x: 855, y: 360 },
  { code: "AE", name: "Emirados", x: 545, y: 190 },
  { code: "SA", name: "Arábia Saudita", x: 525, y: 190 },
  { code: "IL", name: "Israel", x: 505, y: 180 },
  { code: "GR", name: "Grécia", x: 492, y: 173 },
  { code: "RO", name: "Roménia", x: 491, y: 160 },
  { code: "CZ", name: "República Checa", x: 481, y: 154 },
  { code: "HU", name: "Hungria", x: 487, y: 158 },
];

interface WorldMapProps {
  data: { code: string; count: number; country?: string }[];
}

export function WorldMap({ data }: WorldMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxCount = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  const dataByCode = useMemo(() => {
    const map = new Map<string, { count: number; name: string }>();
    data.forEach((d) => {
      const point = COUNTRY_POINTS.find((p) => p.code === d.code);
      if (point) {
        map.set(d.code, { count: d.count, name: d.country || point.name });
      }
    });
    return map;
  }, [data]);

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <PremiumCard className="p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-white/60" />
          <h3 className="text-sm font-semibold text-white/90">Mapa de países</h3>
        </div>
        <span className="text-xs text-white/50">{total} visitas</span>
      </div>
      <div className="relative aspect-[2/1] w-full rounded-xl overflow-hidden bg-white/[0.03] ring-1 ring-white/[0.06]">
        <svg viewBox="0 0 1000 500" className="h-full w-full" role="img" aria-label="Mapa mundial de visitas">
          <rect width="100%" height="100%" fill="transparent" />
          {[...Array(9)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1="0"
              y1={((i + 1) * 500) / 10}
              x2="1000"
              y2={((i + 1) * 500) / 10}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="1"
            />
          ))}
          {[...Array(9)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={((i + 1) * 1000) / 10}
              y1="0"
              x2={((i + 1) * 1000) / 10}
              y2="500"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="1"
            />
          ))}
          {COUNTRY_POINTS.map((point) => {
            const value = dataByCode.get(point.code);
            const isHovered = hovered === point.code;
            const radius = value ? Math.max(3, (value.count / maxCount) * 16) : 1.5;
            const fill = value ? "rgba(56, 189, 248, 0.85)" : "rgba(255,255,255,0.08)";
            return (
              <g key={point.code}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={fill}
                  stroke={isHovered && value ? "#fff" : "transparent"}
                  strokeWidth={isHovered && value ? 2 : 0}
                  className="transition-all duration-300"
                  style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                  role={value ? "button" : undefined}
                  tabIndex={value ? 0 : -1}
                  aria-label={value ? `${value.name}: ${value.count} visitas` : undefined}
                  onMouseEnter={() => value && setHovered(point.code)}
                  onMouseLeave={() => setHovered((prev) => (prev === point.code ? null : prev))}
                  onFocus={() => value && setHovered(point.code)}
                  onBlur={() => setHovered((prev) => (prev === point.code ? null : prev))}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && value) {
                      e.preventDefault();
                      setHovered(point.code);
                    }
                  }}
                />
                {isHovered && value && (
                  <text
                    x={point.x}
                    y={point.y - radius - 6}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="12"
                    fontWeight="500"
                    pointerEvents="none"
                  >
                    {value.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400/80" />
          Com visitas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/10" />
          Sem dados
        </span>
      </div>
    </PremiumCard>
  );
}
