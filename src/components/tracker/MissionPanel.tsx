import { Check, ChevronRight, SlidersHorizontal, User, CalendarDays } from "lucide-react";
import type { Mission } from "@/lib/missions.functions";

const coletas = [
  { label: "PH", tone: "text-ok" },
  { label: "Oxigênio Dissolvido", tone: "text-ok" },
  { label: "Temperatura", tone: "text-foreground" },
  { label: "Turbidez", tone: "text-info" },
  { label: "Salinidade", tone: "text-info" },
  { label: "Mono P", tone: "text-info" },
  { label: "Multi P", tone: "text-alert" },
  { label: "Camera V", tone: "text-ok" },
  { label: "Camera R", tone: "text-alert" },
];

export function MissionPanel({
  missions,
  selectedId,
  onSelect,
}: {
  missions: Mission[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = missions.find((m) => m.id === selectedId);

  return (
    <aside className="flex w-[26rem] max-w-full shrink-0 flex-col border-l border-border bg-panel-strong">
      <h1 className="px-6 pt-6 font-display text-xl font-semibold uppercase tracking-wide">
        Missões do usuário
      </h1>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Nome da empresa do usuário</p>
            <p className="truncate text-xs text-muted-foreground">Nome do Usuário</p>
          </div>
        </div>
        <button type="button" aria-label="Filtrar missões" className="text-muted-foreground hover:text-foreground">
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
        {missions.map((m) => {
          const isActive = m.id === selectedId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                isActive
                  ? "border-primary bg-panel ring-1 ring-primary/40"
                  : "border-border bg-panel hover:border-primary/50"
              }`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 space-y-1.5">
                  <p className={`font-display text-lg font-semibold ${isActive ? "text-primary" : ""}`}>
                    Operação: <span className="font-sans text-base font-medium">{m.data}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Local: <span className="text-foreground/90">{m.local}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tempo:{" "}
                    <span className="text-foreground/90">
                      {m.duracaoHoras}h ({m.inicio} - {m.fim})
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Coletas:{" "}
                    {coletas.map((c, i) => (
                      <span key={c.label} className={c.tone}>
                        {c.label}
                        {i < coletas.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-muted-foreground">
                  {isActive ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-3 text-sm text-primary">
        <CalendarDays className="h-4 w-4" />
        Selecionada: {selected?.data ?? "—"}
      </footer>
    </aside>
  );
}
