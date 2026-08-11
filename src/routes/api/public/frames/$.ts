import { createFileRoute } from "@tanstack/react-router";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serve os frames de câmera referenciados na coluna `frame` dos CSVs.
 * Os arquivos ficam dentro da pasta de dados (CSV_DIR, padrão ./data).
 */
export const Route = createFileRoute("/api/public/frames/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readFile } = await import("node:fs/promises");
        const path = await import("node:path");

        const base = path.resolve(process.env["CSV_DIR"] ?? path.join(process.cwd(), "data"));
        const rel = decodeURIComponent(params._splat ?? "");
        const ext = rel.split(".").pop()?.toLowerCase() ?? "";
        const type = TYPES[ext];
        if (!type) return new Response("Tipo de arquivo não suportado", { status: 400 });

        const full = path.resolve(base, rel);
        if (full !== base && !full.startsWith(base + path.sep)) {
          return new Response("Caminho inválido", { status: 400 });
        }

        try {
          const file = await readFile(full);
          return new Response(new Uint8Array(file), {
            headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
          });
        } catch {
          return new Response("Frame não encontrado", { status: 404 });
        }
      },
    },
  },
});
