import type { Reading } from "./missions.functions";

export type DepthPoint = { x: number; y: number; depth: number };
const cross = (a: DepthPoint, b: DepthPoint, c: DepthPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export function buildBathymetry(readings: Reading[]) {
  const valid = readings.filter(
    (r) =>
      r.mono_p.trim() !== "" &&
      Number.isFinite(Number(r.mono_p.replace(",", "."))) &&
      Number(r.mono_p.replace(",", ".")) >= 0 &&
      Number.isFinite(r.lat) &&
      Math.abs(r.lat) <= 90 &&
      Number.isFinite(r.lon) &&
      Math.abs(r.lon) <= 180,
  );
  const origin = valid[0];
  if (!origin) return null;
  const locations = new Map<string, { x: number; y: number; total: number; count: number }>();
  for (const r of valid) {
    const x = (r.lon - origin.lon) * 111320 * Math.cos((origin.lat * Math.PI) / 180);
    const y = (r.lat - origin.lat) * 111320;
    const key = `${r.lat},${r.lon}`;
    const p = locations.get(key) ?? { x, y, total: 0, count: 0 };
    p.total += Number(r.mono_p.replace(",", "."));
    p.count++;
    locations.set(key, p);
  }
  const points = [...locations.values()].map((p) => ({ x: p.x, y: p.y, depth: p.total / p.count }));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1);
  points.forEach((p) => {
    p.x -= (minX + maxX) / 2;
    p.y -= (minY + maxY) / 2;
  });
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (ps: DepthPoint[]) => {
    const h: DepthPoint[] = [];
    for (const p of ps) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  const inside = (p: DepthPoint) =>
    hull.length >= 3 && hull.every((a, i) => cross(a, hull[(i + 1) % hull.length]!, p) >= -1e-8);
  const cells: DepthPoint[][] = [];
  const size = 36;
  const grid: (DepthPoint | null)[][] = [];
  for (let j = 0; j <= size; j++) {
    const row: (DepthPoint | null)[] = [];
    for (let i = 0; i <= size; i++) {
      const p = {
        x: (i / size - 0.5) * (maxX - minX),
        y: (j / size - 0.5) * (maxY - minY),
        depth: 0,
      };
      if (!inside(p)) {
        row.push(null);
        continue;
      }
      const neighbors = points
        .map((q) => ({ q, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 8);
      const exact = neighbors[0];
      if (exact && exact.d < 1e-10) p.depth = exact.q.depth;
      else {
        let weights = 0;
        for (const n of neighbors) {
          const w = 1 / n.d;
          p.depth += n.q.depth * w;
          weights += w;
        }
        p.depth /= weights;
      }
      row.push(p);
    }
    grid.push(row);
  }
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const corners = [grid[j]![i], grid[j]![i + 1], grid[j + 1]![i + 1], grid[j + 1]![i]];
      if (corners.every((p): p is DepthPoint => p != null)) cells.push(corners);
    }
  return {
    points,
    cells,
    span,
    min: Math.min(...points.map((p) => p.depth)),
    max: Math.max(...points.map((p) => p.depth)),
    validCount: valid.length,
    excluded: readings.length - valid.length,
  };
}
