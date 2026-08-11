import type { Mission, Reading } from "@/lib/missions.functions";
import cameraImg from "@/assets/camera-frontal.jpg";

const params: { key: keyof Reading; label: string; unit?: string; tone: string }[] = [
  { key: "ph", label: "PH", tone: "bg-ok" },
  { key: "oxigenio_dissolvido", label: "Oxigênio Dissolvido", unit: " mg/L", tone: "bg-ok" },
  { key: "temperatura", label: "Temperatura", unit: " °C", tone: "bg-ok" },
  { key: "turbidez", label: "Turbidez", unit: " NTU", tone: "bg-ok" },
  { key: "salinidade", label: "Salinidade", unit: " PSU", tone: "bg-ok" },
  { key: "mono_p", label: "Mono P", unit: " m", tone: "bg-ok" },
  { key: "multi_p", label: "Multi P", tone: "bg-alert" },
  { key: "camera_r", label: "Câmera R", tone: "bg-alert" },
  { key: "camera_v", label: "Câmera V", tone: "bg-ok" },
];

export function ReadingCard({ reading, mission }: { reading: Reading; mission: Mission }) {
  return (
    <div className="w-72 panel-surface overflow-hidden text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="font-semibold text-foreground">Dados nesta posição</span>
        <span className="text-[10px] text-muted-foreground">{reading.timestamp || mission.data}</span>
      </div>
      <dl className="px-3 py-2">
        {params.map((p) => {
          const raw = String(reading[p.key] ?? "");
          const empty = raw === "";
          return (
            <div key={p.label} className="flex items-center justify-between gap-3 py-[3px]">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${empty ? "bg-alert" : p.tone}`} />
                {p.label}
              </dt>
              <dd className="tabular-nums text-foreground">{empty ? "—" : raw + (p.unit ?? "")}</dd>
            </div>
          );
        })}
      </dl>
      <div className="border-t border-border px-3 py-2">
        <p className="mb-2 text-muted-foreground">Imagem da câmera frontal</p>
        {/*
          Frame do ponto: usa reading.frame (coluna `frame` do CSV) quando existe.
          Enquanto não há dados reais, cai na imagem de exemplo fixa.
          PLACEHOLDER FUTURO — ao ligar os dados reais, troque o fallback abaixo por:

          {!reading.frame ? (
            <div className="grid h-32 w-full place-items-center rounded-md border border-border text-muted-foreground">
              sem frame
            </div>
          ) : (
            <img src={reading.frame} ... />
          )}
        */}
        <img
          src={reading.frame || cameraImg}
          alt={`Frame da câmera frontal em ${reading.timestamp || mission.data}`}
          loading="lazy"
          width={768}
          height={512}
          className="w-full rounded-md border border-border object-cover"
        />
      </div>

    </div>
  );
}
