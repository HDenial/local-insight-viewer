import { Calendar, MapPin, Plus, Minus, Crosshair } from "lucide-react";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
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
      {/* anel azul reservado exclusivamente às direções cardinais */}
      <circle cx="24" cy="24" r="22" className="fill-primary" />
      <circle cx="24" cy="24" r="13" className="fill-panel-strong stroke-primary-foreground/30" />
      {/* marcações na borda interna do anel azul */}
      {[0, 90, 180, 270].map((angle) => (
        <line
          key={`major-${angle}`}
          x1="24"
          y1="10.5"
          x2="24"
          y2="13.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-primary-foreground"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      {[45, 135, 225, 315].map((angle) => (
        <line
          key={`minor-${angle}`}
          x1="24"
          y1="11"
          x2="24"
          y2="13"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          className="text-primary-foreground/70"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      {/* letras na borda externa; sem sobreposição com as marcações */}
      <text
        x="24"
        y="5.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontWeight="700"
        className="fill-primary-foreground"
      >
        N
      </text>
      <text
        x="24"
        y="42.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontWeight="700"
        className="fill-primary-foreground"
      >
        S
      </text>
      <text
        x="42.5"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontWeight="700"
        className="fill-primary-foreground"
      >
        L
      </text>
      <text
        x="5.5"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontWeight="700"
        className="fill-primary-foreground"
      >
        O
      </text>
      {/* agulha: ponta azul (norte) para cima, ponta sul apagada */}
      <g
        style={{
          transform: `rotate(${-bearing}deg)`,
          transformOrigin: "50% 50%",
          transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <polygon points="24,13 28,25 24,21 20,25" className="fill-primary" />
        <polygon points="24,35 20,23 24,27 28,23" className="fill-muted-foreground" />
        <circle cx="24" cy="24" r="2" className="fill-foreground" />
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
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const active = pinnedPoint ?? hovered;
  const reading = active ? mission.readings[active.index] : null;

  const cancelHoverClear = () => {
    if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
    hoverClearTimer.current = null;
  };

  const handleHover = (point: ActivePoint) => {
    cancelHoverClear();
    if (point) {
      setHovered(point);
      return;
    }
    hoverClearTimer.current = setTimeout(() => setHovered(null), 180);
  };

  useEffect(
    () => () => {
      if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
    },
    [],
  );

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
  }, [active, reading]);

  return (
    <section ref={sectionRef} className="relative min-w-0 flex-1 overflow-hidden">
      <ClientOnly fallback={<div className="absolute inset-0 bg-panel-strong" />}>
        <Suspense fallback={<div className="absolute inset-0 bg-panel-strong" />}>
          <MissionMap
            mission={mission}
            pinned={pinnedPoint?.index ?? null}
            onHover={handleHover}
            onMove={setPinnedPoint}
            onPin={(index) =>
              setPinnedPoint((cur) =>
                cur && cur.index === index ? null : (hovered ?? { index, x: 0, y: 0 }),
              )
            }
            onClearPin={() => setPinnedPoint(null)}
            onReady={(a) => (api.current = a)}
          />
        </Suspense>
      </ClientOnly>

      <header className="pointer-events-none absolute left-5 top-5 z-[500] w-72 panel-surface bg-panel-strong/90 px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Missão selecionada
        </p>
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
          className="pointer-events-auto absolute z-[600]"
          onPointerEnter={cancelHoverClear}
          onPointerLeave={() => {
            if (!pinnedPoint) handleHover(null);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          style={{
            left: pos?.left ?? -9999,
            top: pos?.top ?? -9999,
            visibility: pos ? "visible" : "hidden",
          }}
        >
          <ReadingCard reading={reading} mission={mission} />
        </div>
      )}

      <div className="absolute bottom-10 left-3 z-[500] flex overflow-hidden rounded-md border border-border bg-panel-strong/85 backdrop-blur">
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
          className="grid h-9 w-9 place-items-center border-l border-border text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Centralizar no trajeto"
          onClick={() => api.current?.fit()}
          className="grid h-9 w-9 place-items-center border-l border-border text-foreground"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
