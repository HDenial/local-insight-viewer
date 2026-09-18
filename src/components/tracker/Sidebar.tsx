import {
  Home,
  Map,
  ClipboardList,
  Download,
  Settings,
  HelpCircle,
  Ship,
} from "lucide-react";

function BathymetryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 11.5h15l-2.1 3.2H7.1L4 11.5Z" />
      <path d="M6.8 11.5 8.7 7h4.4l2.1 4.5" />
      <path d="M10.9 7V4.5" />
      <path d="M9.2 16.8c.8 1.1 1.7 1.6 2.8 1.6s2-.5 2.8-1.6" />
      <path d="M6.5 18.5c1.5 2 3.3 3 5.5 3s4-1 5.5-3" />
    </svg>
  );
}

const items = [
  { icon: Home, label: "Início" },
  { icon: Map, label: "Mapa" },
  { icon: BathymetryIcon, label: "Análises" },
  { icon: ClipboardList, label: "Relatórios" },
  { icon: Download, label: "Exportar" },
  { icon: Settings, label: "Configurações" },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: number;
  onSelect: (section: number) => void;
}) {
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
            onClick={() => onSelect(i)}
            disabled={i !== 1 && i !== 2}
            title={i !== 1 && i !== 2 ? `${item.label} — em breve` : item.label}
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
