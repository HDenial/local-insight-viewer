import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Mission } from "@/lib/missions.functions";

export type ActivePoint = { index: number; x: number; y: number } | null;
export type MapApi = { zoomIn: () => void; zoomOut: () => void; fit: () => void };

type Props = {
  mission: Mission;
  pinned: number | null;
  onHover: (p: ActivePoint) => void;
  onPin: (index: number) => void;
  onMove: (p: ActivePoint) => void;
  onReady: (api: MapApi) => void;
};

/** Mapa dinâmico (OpenStreetMap/Leaflet). Carregado apenas no navegador. */
export default function MissionMap({ mission, pinned, onHover, onPin, onMove, onReady }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const cb = useRef({ onHover, onPin, onMove, onReady });
  cb.current = { onHover, onPin, onMove, onReady };

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { zoomControl: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      className: "map-tiles",
    }).addTo(map);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    cb.current.onReady({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      fit: () => {
        if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [80, 80] });
      },
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current = [];

    const coords = mission.readings
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
      .map((r) => [r.lat, r.lon] as [number, number]);
    if (coords.length === 0) return;

    L.polyline(coords, {
      color: "#2f7fff",
      weight: 2.5,
      opacity: 0.95,
      lineJoin: "round",
    }).addTo(layer);

    coords.forEach((c, i) => {
      const marker = L.circleMarker(c, {
        radius: 3.5,
        color: "#9fd0ff",
        weight: 1,
        fillColor: "#2f7fff",
        fillOpacity: 0.9,
        bubblingMouseEvents: false,
      })
        .on("mouseover", (e) => {
          const p = map.latLngToContainerPoint(e.target.getLatLng());
          cb.current.onHover({ index: i, x: p.x, y: p.y });
        })
        .on("mouseout", () => cb.current.onHover(null))
        .on("click", () => cb.current.onPin(i))
        .addTo(layer);
      markersRef.current[i] = marker;
    });

    const endpoint = (c: [number, number], label: string) =>
      L.marker(c, {
        icon: L.divIcon({
          className: "",
          html: `<span class="grid h-5 w-5 place-items-center rounded-full border-2 border-track bg-panel-strong text-[9px] font-semibold text-foreground">${label}</span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        interactive: false,
      }).addTo(layer);
    endpoint(coords[0]!, "P");
    endpoint(coords[coords.length - 1]!, "C");

    boundsRef.current = L.latLngBounds(coords);
    map.fitBounds(boundsRef.current, { padding: [80, 80] });
  }, [mission]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const emit = () => {
      const i = pinned;
      if (i === null) return;
      const m = markersRef.current[i];
      if (!m) return;
      const p = map.latLngToContainerPoint(m.getLatLng());
      cb.current.onMove({ index: i, x: p.x, y: p.y });
    };
    emit();
    map.on("move zoom resize", emit);
    return () => {
      map.off("move zoom resize", emit);
    };
  }, [pinned, mission]);

  useEffect(() => {
    markersRef.current.forEach((m, i) => {
      m.setStyle({ fillColor: i === pinned ? "#ffffff" : "#2f7fff" });
      m.setRadius(i === pinned ? 6 : 3.5);
    });
  }, [pinned, mission]);

  return <div ref={el} className="absolute inset-0 h-full w-full" />;
}
