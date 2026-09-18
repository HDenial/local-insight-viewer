import { useEffect, useMemo, useRef, useState } from "react";
import { Mountain, RotateCcw } from "lucide-react";
import type { Mission } from "@/lib/missions.functions";
import { buildBathymetry, type DepthPoint } from "@/lib/bathymetry";
import { formatData } from "@/lib/format";

export function BathymetryView({ mission }: { mission: Mission }) {
  const model = useMemo(() => buildBathymetry(mission.readings), [mission]);
  const [rotation, setRotation] = useState(-30);
  const [tilt, setTilt] = useState(55);
  const [zoom, setZoom] = useState(1);
  const surfaceRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1;
      const delta = Math.max(-100, Math.min(100, event.deltaY * unit));
      setZoom((current) => Math.max(0.5, Math.min(2, current * Math.exp(-delta * 0.002))));
    };
    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleWheel);
  }, [model]);
  const [exaggeration, setExaggeration] = useState(3);
  const [showPoints, setShowPoints] = useState(true);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const project = (p: DepthPoint) => {
    const angle = (rotation * Math.PI) / 180,
      pitch = (tilt * Math.PI) / 180;
    const x = p.x * Math.cos(angle) - p.y * Math.sin(angle);
    const y = p.x * Math.sin(angle) + p.y * Math.cos(angle);
    const z = -(p.depth - (model ? (model.min + model.max) / 2 : 0)) * exaggeration;
    const scale =
      (540 / Math.max(model?.span ?? 1, (model ? model.max - model.min : 0) * exaggeration, 1)) *
      zoom;
    return {
      x: 450 + x * scale,
      y: 310 - (y * Math.cos(pitch) + z * Math.sin(pitch)) * scale,
      order: y * Math.sin(pitch) - z * Math.cos(pitch),
    };
  };
  const color = (depth: number) => {
    const t = model && model.max > model.min ? (depth - model.min) / (model.max - model.min) : 0.5;
    return `hsl(${45 + t * 195} ${80 - t * 15}% ${60 - t * 30}%)`;
  };
  const cells =
    model?.cells
      .map((cell) => ({ cell, projected: cell.map(project) }))
      .sort(
        (a, b) =>
          b.projected.reduce((s, p) => s + p.order, 0) -
          a.projected.reduce((s, p) => s + p.order, 0),
      ) ?? [];
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Análises · Batimetria
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
            <Mountain className="h-6 w-6 text-primary" /> Relevo do fundo
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatData(mission.data)} · {mission.local}
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary"
          onClick={() => {
            setRotation(-30);
            setTilt(55);
            setZoom(1);
            setExaggeration(3);
          }}
        >
          <RotateCcw className="h-4 w-4" /> Redefinir vista
        </button>
      </header>
      {!model ? (
        <div className="grid flex-1 place-items-center p-8 text-center text-muted-foreground">
          Esta missão não possui profundidades válidas em Mono P para gerar o relevo.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 pt-4 text-sm">
            <p>
              <span className="text-muted-foreground">Leituras válidas </span>
              {model.validCount}
            </p>
            <p>
              <span className="text-muted-foreground">Mais raso </span>
              {model.min.toFixed(2)} m
            </p>
            <p>
              <span className="text-muted-foreground">Mais profundo </span>
              {model.max.toFixed(2)} m
            </p>
          </div>
          <div className="relative min-h-[300px] flex-1">
            <svg
              ref={surfaceRef}
              viewBox="0 0 900 620"
              className="h-full min-h-[300px] w-full touch-none cursor-grab active:cursor-grabbing"
              role="img"
              aria-label={`Relevo estimado do fundo, profundidade de ${model.min.toFixed(2)} a ${model.max.toFixed(2)} metros. Use os controles abaixo para ajustar a vista.`}
              onPointerDown={(e) => {
                drag.current = { x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const dx = e.clientX - drag.current.x,
                  dy = e.clientY - drag.current.y;
                setRotation((r) => r + dx * 0.4);
                setTilt((t) => Math.max(10, Math.min(90, t + dy * 0.3)));
                drag.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            >
              {cells.map(({ cell, projected }, i) => (
                <polygon
                  key={i}
                  points={projected.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={color(cell.reduce((s, p) => s + p.depth, 0) / 4)}
                  stroke="#0f172a"
                  strokeOpacity=".2"
                  strokeWidth=".5"
                />
              ))}
              {(showPoints || cells.length === 0) &&
                model.points.map((p, i) => {
                  const pos = project(p);
                  return (
                    <circle
                      key={i}
                      cx={pos.x}
                      cy={pos.y}
                      r="2.5"
                      fill={color(p.depth)}
                      stroke="white"
                      strokeWidth=".8"
                    >
                      <title>Profundidade medida: {p.depth.toFixed(2)} m</title>
                    </circle>
                  );
                })}
              {[
                { x: 0, y: model.span * 0.58, depth: (model.min + model.max) / 2, label: "N" },
                { x: model.span * 0.58, y: 0, depth: (model.min + model.max) / 2, label: "L" },
              ].map((p) => {
                const pos = project(p);
                return (
                  <text
                    key={p.label}
                    x={pos.x}
                    y={pos.y}
                    fill="currentColor"
                    fontSize="16"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                );
              })}
            </svg>
            <p className="absolute bottom-1 left-5 text-xs text-muted-foreground">
              Arraste para girar · Role para ajustar o zoom · Extensão horizontal:{" "}
              {model.span.toFixed(0)} m
            </p>
          </div>
          <div className="space-y-4 border-t border-border bg-panel-strong p-5">
            <div className="flex items-center gap-3 text-xs">
              <span>{model.min.toFixed(2)} m</span>
              <div
                className="h-2 flex-1 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, hsl(45 80% 60%), hsl(110 75% 50%), hsl(175 70% 40%), hsl(240 65% 30%))",
                }}
              />
              <span>{model.max.toFixed(2)} m</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs xl:grid-cols-4">
              <label className="space-y-2">
                <span>Rotação: {Math.round(rotation)}°</span>
                <input
                  aria-label="Rotação"
                  type="range"
                  min="-180"
                  max="180"
                  value={((((rotation + 180) % 360) + 360) % 360) - 180}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="block w-full"
                />
              </label>
              <label className="space-y-2">
                <span>Inclinação: {Math.round(tilt)}°</span>
                <input
                  aria-label="Inclinação"
                  type="range"
                  min="10"
                  max="90"
                  value={tilt}
                  onChange={(e) => setTilt(Number(e.target.value))}
                  className="block w-full"
                />
              </label>
              <label className="space-y-2">
                <span>Zoom: {zoom.toFixed(1)}×</span>
                <input
                  aria-label="Zoom"
                  type="range"
                  min=".5"
                  max="2"
                  step=".1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="block w-full"
                />
              </label>
              <label className="space-y-2">
                <span>Exagero vertical: {exaggeration}×</span>
                <input
                  aria-label="Exagero vertical"
                  type="range"
                  min="1"
                  max="10"
                  value={exaggeration}
                  onChange={(e) => setExaggeration(Number(e.target.value))}
                  className="block w-full"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showPoints}
                onChange={(e) => setShowPoints(e.target.checked)}
              />{" "}
              Mostrar posições medidas
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Estimativa por interpolação das leituras Mono P (m), limitada ao contorno dos pontos.
              Espaços entre trajetos não representam medições; a precisão depende da cobertura da
              coleta. Profundidades relativas ao sensor, sem correção de maré. Posições repetidas
              usam a profundidade média.
              {model.excluded > 0 &&
                ` ${model.excluded} leituras sem profundidade ou coordenadas válidas foram ignoradas.`}
              {cells.length === 0 &&
                " Cobertura insuficiente para uma superfície: exibindo apenas as posições medidas."}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
