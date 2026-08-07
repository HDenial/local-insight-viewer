import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMissions } from "@/lib/missions.functions";
import { Sidebar } from "@/components/tracker/Sidebar";
import { MapView } from "@/components/tracker/MapView";
import { MissionPanel } from "@/components/tracker/MissionPanel";

const missionsQuery = queryOptions({
  queryKey: ["missions"],
  queryFn: () => getMissions(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boat Tracker — Monitoramento de Missões Náuticas" },
      {
        name: "description",
        content:
          "Painel de monitoramento de barcos autônomos: trajetos, leituras de qualidade da água e câmeras por missão.",
      },
      { property: "og:title", content: "Boat Tracker — Monitoramento de Missões Náuticas" },
      {
        property: "og:description",
        content: "Acompanhe trajetos, sensores e câmeras das missões de coleta em tempo quase real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(missionsQuery);
  },
  component: Index,
  errorComponent: ({ error }) => (
    <div role="alert" className="grid min-h-screen place-items-center p-8 text-center">
      <div>
        <h1 className="font-display text-xl font-semibold">Não foi possível ler o CSV</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Nenhuma missão encontrada.</div>,
});

function Index() {
  const { data: missions } = useSuspenseQuery(missionsQuery);
  const [selectedId, setSelectedId] = useState(missions[0]?.id ?? "");
  const selected = missions.find((m) => m.id === selectedId) ?? missions[0];

  if (!selected) {
    return <div className="grid min-h-screen place-items-center">Nenhuma missão no CSV.</div>;
  }

  return (
    <main className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <MapView mission={selected} />
      <MissionPanel missions={missions} selectedId={selected.id} onSelect={setSelectedId} />
    </main>
  );
}
