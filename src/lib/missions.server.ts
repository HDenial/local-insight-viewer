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

export async function loadMissions(): Promise<Mission[]> {
  const files = (await readdir(CSV_DIR)).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
  const byId = new Map<string, Mission>();

  for (const file of files) {
    const text = await readFile(path.join(CSV_DIR, file), "utf8");
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
      });
    }
  }



  return [...byId.values()].sort((a, b) => (a.data < b.data ? 1 : -1));
}
