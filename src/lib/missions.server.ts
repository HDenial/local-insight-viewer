import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type Reading = {
  timestamp: string;
  lat: number;
  lon: number;
  ph: string;
  oxigenio_dissolvido: string;
  temperatura: string;
  turbidez: string;
  salinidade: string;
  mono_p: string;
  multi_p: string;
  camera_r: string;
  camera_v: string;
  /** Compatibilidade com CSVs antigos: equivale a frame_v. */
  frame: string;
  /** Imagens das câmeras de vante e de ré neste ponto. */
  frame_v: string;
  frame_r: string;
};

export type Mission = {
  id: string;
  data: string;
  local: string;
  inicio: string;
  fim: string;
  duracaoHoras: number;
  readings: Reading[];
};

/** Pasta local onde os CSVs de leitura ficam (um arquivo por missão). Configurável via CSV_DIR. */
const CSV_DIR = process.env["CSV_DIR"] ?? path.join(process.cwd(), "data");

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const header = splitLine(lines[0]!).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function hours(inicio: string, fim: string) {
  const [hi] = inicio.split(":").map(Number);
  const [hf] = fim.split(":").map(Number);
  return Math.max(0, (hf ?? 0) - (hi ?? 0));
}

/**
 * Converte o valor da coluna `frame` em URL exibível.
 * - URL http(s): usada como está.
 * - Caminho relativo (ex.: frames/OP-20260511/063000.jpg): servido por /api/public/frames/.
 */
function frameUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return "/api/public/frames/" + v.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
}

/**
 * CSVs embutidos no bundle em tempo de build (o servidor de produção não tem
 * acesso ao sistema de arquivos do projeto).
 */
const BUNDLED_CSVS = import.meta.glob("../../data/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Lê os CSVs do disco (dev/local) e cai para os arquivos embutidos no bundle. */
async function readCsvFiles(): Promise<{ name: string; text: string }[]> {
  try {
    const files = (await readdir(CSV_DIR)).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
    if (files.length) {
      return Promise.all(
        files.map(async (name) => ({
          name,
          text: await readFile(path.join(CSV_DIR, name), "utf8"),
        })),
      );
    }
  } catch {
    // sem filesystem (produção) — usa os CSVs embutidos
  }
  return Object.entries(BUNDLED_CSVS)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([p, text]) => ({ name: p.split("/").pop() ?? p, text }));
}

export async function loadMissions(): Promise<Mission[]> {
  const byId = new Map<string, Mission>();

  for (const { name: file, text } of await readCsvFiles()) {
    const rows = parseCsv(text);
    const fallbackId = file.replace(/\.csv$/i, "");

    for (const r of rows) {
      const id = r["mission_id"] || fallbackId;
      if (!id) continue;
      let mission = byId.get(id);
      if (!mission) {
        mission = {
          id,
          data: r["data"] ?? "",
          local: r["local"] ?? "",
          inicio: r["inicio"] ?? "",
          fim: r["fim"] ?? "",
          duracaoHoras: hours(r["inicio"] ?? "0:00", r["fim"] ?? "0:00"),
          readings: [],
        };
        byId.set(id, mission);
      }
      const legacyFrame = frameUrl(r["frame"] ?? "");
      mission.readings.push({
        timestamp: r["timestamp"] ?? "",
        lat: Number(r["lat"]),
        lon: Number(r["lon"]),
        ph: r["ph"] ?? "",
        oxigenio_dissolvido: r["oxigenio_dissolvido"] ?? "",
        temperatura: r["temperatura"] ?? "",
        turbidez: r["turbidez"] ?? "",
        salinidade: r["salinidade"] ?? "",
        mono_p: r["mono_p"] ?? "",
        multi_p: r["multi_p"] ?? "",
        camera_r: r["camera_r"] ?? "",
        camera_v: r["camera_v"] ?? "",
        frame: legacyFrame,
        frame_v: frameUrl(r["frame_v"] ?? "") || legacyFrame,
        frame_r: frameUrl(r["frame_r"] ?? ""),
      });
    }
  }

  return [...byId.values()].sort((a, b) => (a.data < b.data ? 1 : -1));
}
