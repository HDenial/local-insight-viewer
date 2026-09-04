import { CameraOff, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Mission, Reading } from "@/lib/missions.functions";

const params: { key: keyof Reading; label: string; unit?: string; tone: string }[] = [
  { key: "ph", label: "PH", tone: "bg-ok" },
  { key: "oxigenio_dissolvido", label: "Oxigênio Dissolvido", unit: " mg/L", tone: "bg-ok" },
  { key: "temperatura", label: "Temperatura", unit: " °C", tone: "bg-ok" },
  { key: "turbidez", label: "Turbidez", unit: " NTU", tone: "bg-ok" },
  { key: "salinidade", label: "Salinidade", unit: " PSU", tone: "bg-ok" },
  { key: "mono_p", label: "Mono P", unit: " m", tone: "bg-ok" },
  { key: "multi_p", label: "Multi P", tone: "bg-alert" },
];

function CameraStatus({ label, frame }: { label: string; frame: string }) {
  const active = frame !== "";
  return (
    <div className="flex items-center justify-between gap-3 py-[3px]">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-ok" : "bg-alert"}`} />
        {label}
      </dt>
      <dd className="font-medium tabular-nums text-foreground">{active ? "ON" : "OFF"}</dd>
    </div>
  );
}

function CameraFrame({
  label,
  frame,
  timestamp,
}: {
  label: string;
  frame: string;
  timestamp: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-muted-foreground">{label}</p>
      {frame ? (
        <img
          src={frame}
          alt={`${label} em ${timestamp}`}
          loading="lazy"
          className="aspect-[470/127] w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`${label} indisponível`}
          className="grid aspect-[470/127] w-full place-items-center rounded-md border border-dashed border-alert/60 bg-muted/40 text-alert"
        >
          <span className="flex items-center gap-2">
            <CameraOff className="h-4 w-4" />
            Imagem indisponível
          </span>
        </div>
      )}
    </div>
  );
}

export function ReadingCard({ reading, mission }: { reading: Reading; mission: Mission }) {
  const [imagesVisible, setImagesVisible] = useState(true);
  const timestamp = reading.timestamp || mission.data;

  return (
    <div className="w-72 panel-surface overflow-hidden text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="font-semibold text-foreground">Dados nesta posição</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{timestamp}</span>
          <button
            type="button"
            aria-label={imagesVisible ? "Ocultar imagens" : "Mostrar imagens"}
            aria-expanded={imagesVisible}
            onClick={() => setImagesVisible((visible) => !visible)}
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {imagesVisible ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <dl className="px-3 py-2">
        {params.map((param) => {
          const raw = String(reading[param.key] ?? "");
          const empty = raw === "";
          return (
            <div key={param.label} className="flex items-center justify-between gap-3 py-[3px]">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${empty ? "bg-alert" : param.tone}`} />
                {param.label}
              </dt>
              <dd className="tabular-nums text-foreground">
                {empty ? "—" : raw + (param.unit ?? "")}
              </dd>
            </div>
          );
        })}
        <CameraStatus label="Câmera V" frame={reading.frame_v} />
        <CameraStatus label="Câmera R" frame={reading.frame_r} />
      </dl>

      {imagesVisible && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          <CameraFrame
            label="Imagem da câmera de vante"
            frame={reading.frame_v}
            timestamp={timestamp}
          />
          <CameraFrame
            label="Imagem da câmera de ré"
            frame={reading.frame_r}
            timestamp={timestamp}
          />
        </div>
      )}
    </div>
  );
}
