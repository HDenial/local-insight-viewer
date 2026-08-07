import { Home, Map, BarChart3, ClipboardList, Download, Settings, HelpCircle, Ship } from "lucide-react";
import { useState } from "react";

const items = [
  { icon: Home, label: "Início" },
  { icon: Map, label: "Mapa" },
  { icon: BarChart3, label: "Análises" },
  { icon: ClipboardList, label: "Relatórios" },
  { icon: Download, label: "Exportar" },
  { icon: Settings, label: "Configurações" },
];

export function Sidebar() {
  const [active, setActive] = useState(1);
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-2 bg-rail py-4">
      <div className="mb-4 grid h-10 w-10 shrink-0 place-items-center text-primary">
        <Ship className="h-7 w-7" />
      </div>
      {items.map((item, i) => {
        const Icon = item.icon;
        const isActive = i === active;
        return (
          <button
            key={item.label}
            type="button"
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setActive(i)}
            className={`grid h-11 w-11 place-items-center rounded-lg transition-colors ${
              isActive
                ? "bg-primary/20 text-primary ring-1 ring-primary/50"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Ajuda"
        className="mt-auto grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    </nav>
  );
}
