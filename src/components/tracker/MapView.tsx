import { Calendar, MapPin, Compass, Plus, Minus, Crosshair } from "lucide-react";
import { Suspense, lazy, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Mission } from "@/lib/missions.functions";
import type { ActivePoint, MapApi } from "./MissionMap";
import { ReadingCard } from "./ReadingCard";
import { formatData } from "@/lib/format";

const MissionMap = lazy(() => import("./MissionMap"));

export function MapView({ mission }: { mission: Mission }) {
  const [hovered, setHovered] = useState<ActivePoint>(null);
  const [pinnedPoint, setPinnedPoint] = useState<ActivePoint>(null);
  const api = useRef<MapApi | null>(null);

  const active = pinnedPoint ?? hovered;
  const reading = active ? mission.readings[active.index] : null;

  return (
    <section className="relative min-w-0 flex-1 overflow-hidden">
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
        aria-label="Enquadrar trajeto da missão"
        onClick={() => api.current?.fit()}
        className="absolute right-5 top-5 z-[500] grid h-11 w-11 place-items-center rounded-full border border-border bg-panel-strong/85 text-foreground backdrop-blur"
      >
        <Compass className="h-5 w-5" />
      </button>

      {active && reading && (
        <div
          className="pointer-events-none absolute z-[600] max-w-[calc(100%-2rem)]"
          style={{
            left: `min(${active.x + 14}px, calc(100% - 19rem))`,
            top: `min(${Math.max(active.y - 40, 8)}px, calc(100% - 26rem))`,
          }}
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
