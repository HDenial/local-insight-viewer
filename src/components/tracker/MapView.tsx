import { Calendar, MapPin, Plus, Minus, Crosshair } from "lucide-react";
import { Suspense, lazy, useLayoutEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Mission } from "@/lib/missions.functions";
import type { ActivePoint, MapApi } from "./MissionMap";
import { ReadingCard } from "./ReadingCard";
import { formatData } from "@/lib/format";

const MissionMap = lazy(() => import("./MissionMap"));

const MARGIN = 12;
const GAP = 14;

/** Rosa dos ventos: agulha azul aponta para o norte (N) do mapa (north-up). */
function CompassRose({ bearing }: { bearing: number }) {
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
      {/* anéis e marcações fixos */}
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
      {[0, 90, 180, 270].map((a) => (
        <line
          key={`maj${a}`}
          x1="24"
          y1="5"
          x2="24"
          y2="9"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <line
          key={`min${a}`}
          x1="24"
          y1="6"
          x2="24"
          y2="8.5"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeLinecap="round"
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      {/* direções cardinais fixas: N em destaque */}
      <text x="24" y="3" textAnchor="middle" dominantBaseline="hanging" fontSize="9" fontWeight="700" className="fill-primary">N</text>
      <text x="24" y="47.5" textAnchor="middle" dominantBaseline="auto" fontSize="8" fontWeight="600" fill="currentColor" fillOpacity="0.85">S</text>
      <text x="44.5" y="24.5" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="600" fill="currentColor" fillOpacity="0.85">L</text>
      <text x="3.5" y="24.5" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="600" fill="currentColor" fillOpacity="0.85">O</text>
      {/* agulha: ponta azul (norte) para cima, ponta sul apagada */}
      <g
        style={{
          transform: `rotate(${-bearing}deg)`,
          transformOrigin: "50% 50%",
          transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <polygon points="24,13 28,25 24,21 20,25" className="fill-primary" />
        <polygon points="24,35 20,23 24,27 28,23" fill="currentColor" fillOpacity="0.45" />
        <circle cx="24" cy="24" r="2" fill="currentColor" fillOpacity="0.85" />
      </g>
    </svg>
  );
}

export function MapView({ mission }: { mission: Mission }) {
  const [hovered, setHovered] = useState<ActivePoint>(null);
  const [pinnedPoint, setPinnedPoint] = useState<ActivePoint>(null);
  const [bearing, setBearing] = useState(0);
  const api = useRef<MapApi | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const active = pinnedPoint ?? hovered;
  const reading = active ? mission.readings[active.index] : null;

  useLayoutEffect(() => {
    if (!active || !reading) {
      setPos(null);
      return;
    }
    const place = () => {
      const box = sectionRef.current?.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      if (!box || !card) return;
      const maxLeft = Math.max(MARGIN, box.width - card.width - MARGIN);
      const maxTop = Math.max(MARGIN, box.height - card.height - MARGIN);
      let left = active.x + GAP;
      if (left > maxLeft) left = active.x - GAP - card.width;
      let top = active.y - 40;
      if (top > maxTop) top = active.y - card.height + 40;
      setPos({
        left: Math.min(Math.max(left, MARGIN), maxLeft),
        top: Math.min(Math.max(top, MARGIN), maxTop),
      });
    };
    place();
    const ro = new ResizeObserver(place);
    if (sectionRef.current) ro.observe(sectionRef.current);
    if (cardRef.current) ro.observe(cardRef.current);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [active?.index, active?.x, active?.y, reading]);

  return (
    <section ref={sectionRef} className="relative min-w-0 flex-1 overflow-hidden">
      <ClientOnly fallback={<div className="absolute inset-0 bg-panel-strong" />}>
        <Suspense fallback={<div className="absolute inset-0 bg-panel-strong" />}>
          <MissionMap
            mission={mission}
            pinned={pinnedPoint?.index ?? null}
            onHover={setHovered}
            onMove={setPinnedPoint}
            onPin={(index) =>
              setPinnedPoint((cur) => (cur && cur.index === index ? null : (hovered ?? { index, x: 0, y: 0 })))
            }
            onClearPin={() => setPinnedPoint(null)}
            onReady={(a) => (api.current = a)}
          />
        </Suspense>
      </ClientOnly>

      <header className="pointer-events-none absolute left-5 top-5 z-[500] w-72 panel-surface bg-panel-strong/90 px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Missão selecionada</p>
        <p className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
          <Calendar className="h-5 w-5 text-primary" />
          {formatData(mission.data)}
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Local: {mission.local}</span>
        </p>
      </header>

      <button
        type="button"
        aria-label="Re-alinhar o mapa ao norte"
        title="Norte"
        onClick={() => {
          setBearing(0);
          api.current?.fit();
        }}
        className="absolute right-5 top-5 z-[500] grid h-14 w-14 place-items-center rounded-full border border-border bg-panel-strong/85 text-foreground backdrop-blur"
      >
        <CompassRose bearing={bearing} />
      </button>

      {active && reading && (
        <div
          ref={cardRef}
          className="pointer-events-none absolute z-[600]"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
        >
          <ReadingCard reading={reading} mission={mission} />
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 z-[500] flex -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border bg-panel-strong/85 backdrop-blur">
        <button
          type="button"
          aria-label="Aproximar"
          onClick={() => api.current?.zoomIn()}
          className="grid h-9 w-9 place-items-center text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Afastar"
          onClick={() => api.current?.zoomOut()}
          className="grid h-9 w-9 place-items-center border-t border-border text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Centralizar no trajeto"
        onClick={() => api.current?.fit()}
        className="absolute bottom-6 left-[calc(50%+3.5rem)] z-[500] grid h-9 w-9 place-items-center rounded-full border border-border bg-panel-strong/85 text-foreground backdrop-blur"
      >
        <Crosshair className="h-4 w-4" />
      </button>
    </section>
  );
}
