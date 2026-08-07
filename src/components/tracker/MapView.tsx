import { Calendar, MapPin, Compass, Plus, Minus, Crosshair } from "lucide-react";
import { useMemo, useState } from "react";
import satellite from "@/assets/satellite-bay.jpg";
import type { Mission } from "@/lib/missions.functions";
import { ReadingCard } from "./ReadingCard";
import { formatData } from "@/lib/format";

/** Recorte geográfico fixo da imagem de satélite: cada missão mantém sua própria área de água. */
const LON_MIN = -43.14;
const LON_SPAN = 0.1;
const LAT_MAX = -22.9;
const LAT_SPAN = 0.08;

function project(mission: Mission) {
  return mission.readings.map((r) => ({
    reading: r,
    x: ((r.lon - LON_MIN) / LON_SPAN) * 100,
    y: ((LAT_MAX - r.lat) / LAT_SPAN) * 100,
  }));
}


export function MapView({ mission }: { mission: Mission }) {
  const points = useMemo(() => project(mission), [mission]);
  const [selected, setSelected] = useState(0);
  const active = points[Math.min(selected, points.length - 1)];
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

  return (
    <section className="relative min-w-0 flex-1 overflow-hidden">
      <img
        src={satellite}
        alt="Imagem de satélite da área da missão"
        width={1280}
        height={1024}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-panel-strong/25" />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={path} fill="none" stroke="var(--track)" strokeWidth="0.35" className="track-glow" />
      </svg>

      <div className="absolute inset-0">
        {points.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Leitura ${p.reading.timestamp}`}
            onMouseEnter={() => setSelected(i)}
            onFocus={() => setSelected(i)}
            onClick={() => setSelected(i)}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
              i === selected
                ? "h-3.5 w-3.5 border-2 border-track bg-panel-strong"
                : "h-2 w-2 bg-track/0 hover:bg-track/70"
            }`}
          />
        ))}
      </div>


      <header className="absolute left-5 top-5 w-72 panel-surface bg-panel-strong/90 px-4 py-3 backdrop-blur">
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
        aria-label="Orientar ao norte"
        className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-border bg-panel-strong/85 text-foreground backdrop-blur"
      >
        <Compass className="h-5 w-5" />
      </button>

      <div
        className="absolute z-10 max-w-[calc(100%-2rem)]"
        style={{ left: `min(${active!.x + 6}%, calc(100% - 19rem))`, top: `min(${active!.y}%, calc(100% - 26rem))` }}
      >
        <ReadingCard reading={active!.reading} mission={mission} />
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border bg-panel-strong/85 backdrop-blur">
        <button type="button" aria-label="Aproximar" className="grid h-9 w-9 place-items-center text-foreground">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Afastar" className="grid h-9 w-9 place-items-center border-t border-border text-foreground">
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Centralizar no barco"
        className="absolute bottom-6 left-[calc(50%+3.5rem)] grid h-9 w-9 place-items-center rounded-full border border-border bg-panel-strong/85 text-foreground backdrop-blur"
      >
        <Crosshair className="h-4 w-4" />
      </button>

      <div className="absolute bottom-6 left-6 text-[10px] text-foreground/90">
        <div className="flex items-end gap-0">
          {["0", "150", "300", "450 m"].map((t) => (
            <span key={t} className="w-14 border-b-2 border-l border-foreground/80 pb-1 pl-1">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
