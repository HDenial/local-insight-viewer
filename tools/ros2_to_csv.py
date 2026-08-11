#!/usr/bin/env python3
"""
Gera o CSV completo de uma missão para o Boat Tracker.

Dois modos:

  --source sim   (padrão)  gera uma missão sintética completa (trajeto praia ->
                           varredura zigue-zague na água -> outro ponto de praia),
                           sensores plausíveis e frames copiados de uma imagem de
                           exemplo. Não depende de ROS2 nem de hardware.

  --source ros2            captura de tópicos ROS2 reais durante --duracao,
                           amostrando a cada --intervalo segundos.

Exemplos:
  python tools/ros2_to_csv.py --mission-id OP-20260601 --local "Enseada de Jurujuba, Niterói/RJ" \
      --data 2026-06-01 --inicio 06:30 --duracao 5h --intervalo 60s

  python tools/ros2_to_csv.py --source ros2 --mission-id OP-20260601 --duracao 2h --intervalo 5s \
      --topic-image /camera/image_raw/compressed --topic-gps /gps/fix

Saída:
  data/missao-<AAAAMMDD>.csv           uma linha por leitura
  data/frames/<mission_id>/<HHMMSS>.jpg  frame de cada leitura
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import shutil
import time
from datetime import datetime, timedelta
from pathlib import Path

COLUMNS = [
    "mission_id", "data", "local", "inicio", "fim",
    "timestamp", "lat", "lon",
    "ph", "oxigenio_dissolvido", "temperatura", "turbidez", "salinidade",
    "mono_p", "multi_p", "camera_r", "camera_v", "frame",
]


def parse_dur(s: str) -> int:
    """Aceita '90', '90s', '15m', '2h'."""
    s = s.strip().lower()
    mult = {"s": 1, "m": 60, "h": 3600}.get(s[-1:], 1)
    if s[-1:] in "smh":
        s = s[:-1]
    return int(float(s) * mult)


# --------------------------------------------------------------------------
# Trajeto sintético: praia -> varredura zigue-zague na água -> outra praia
# --------------------------------------------------------------------------
def sim_track(n: int, lat0: float, lon0: float) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    legs = 6                      # número de faixas da varredura
    width = 0.010                 # largura da varredura em graus de longitude
    step = 0.0016                 # avanço entre faixas em graus de latitude

    pts.append((lat0, lon0))                       # ponto de lançamento (praia)
    pts.append((lat0 - 0.0012, lon0 + 0.0009))     # entrada na água

    for i in range(legs):
        lat = lat0 - 0.0012 - i * step
        a, b = (lon0 + 0.0009, lon0 + 0.0009 + width)
        if i % 2:
            a, b = b, a
        for k in range(8):
            pts.append((lat, a + (b - a) * k / 7))

    lat_end = lat0 - 0.0012 - (legs - 1) * step
    pts.append((lat_end + 0.0010, lon0 + 0.0060))  # saída da área de varredura
    pts.append((lat0 - 0.0004, lon0 + 0.0075))     # retorno a outro ponto da praia

    # reamostra o polígono para exatamente n pontos
    out: list[tuple[float, float]] = []
    for i in range(n):
        t = i * (len(pts) - 1) / max(1, n - 1)
        j = min(int(t), len(pts) - 2)
        f = t - j
        (la, lo), (lb, lob) = pts[j], pts[j + 1]
        out.append((la + (lb - la) * f, lo + (lob - lo) * f))
    return out


def sim_sensors(i: int) -> dict[str, str]:
    r = random.Random(i)
    return {
        "ph": f"{r.uniform(7.1, 8.2):.2f}",
        "oxigenio_dissolvido": f"{r.uniform(4.2, 7.4):.2f}",
        "temperatura": f"{r.uniform(22.5, 26.5):.1f}",
        "turbidez": f"{r.uniform(1.2, 8.5):.1f}",
        "salinidade": f"{r.uniform(28.0, 34.0):.1f}",
        "mono_p": str(r.randint(8, 40)),
        "multi_p": "" if r.random() < 0.35 else str(r.randint(2, 20)),
        "camera_r": "ALERTA" if r.random() < 0.25 else "OK",
        "camera_v": "OK",
    }


# --------------------------------------------------------------------------
# ROS2
# --------------------------------------------------------------------------
def run_ros2(args, rows_out, frames_dir: Path):
    """Captura leituras reais de tópicos ROS2 por args.duracao segundos."""
    import rclpy                                    # noqa: PLC0415
    from rclpy.node import Node                     # noqa: PLC0415
    from sensor_msgs.msg import CompressedImage, NavSatFix  # noqa: PLC0415
    from std_msgs.msg import Float32                # noqa: PLC0415

    class Collector(Node):
        def __init__(self):
            super().__init__("boat_tracker_csv")
            self.fix: NavSatFix | None = None
            self.frame: bytes | None = None
            self.sensors: dict[str, float] = {}
            self.create_subscription(NavSatFix, args.topic_gps, self._gps, 10)
            self.create_subscription(CompressedImage, args.topic_image, self._img, 10)
            for name, topic in args.topic_sensor:
                self.create_subscription(
                    Float32, topic, lambda m, n=name: self.sensors.__setitem__(n, m.data), 10
                )

        def _gps(self, msg):   self.fix = msg
        def _img(self, msg):   self.frame = bytes(msg.data)

    rclpy.init()
    node = Collector()
    t_end = time.time() + args.duracao
    i = 0
    try:
        while time.time() < t_end:
            deadline = time.time() + args.intervalo
            while time.time() < deadline:
                rclpy.spin_once(node, timeout_sec=0.05)
            if node.fix is None:
                continue
            ts = datetime.now()
            frame_rel = ""
            if node.frame:
                name = ts.strftime("%H%M%S") + ".jpg"
                (frames_dir / name).write_bytes(node.frame)
                frame_rel = f"frames/{args.mission_id}/{name}"
            row = {c: "" for c in COLUMNS}
            row.update(
                timestamp=ts.strftime("%Y-%m-%d %H:%M:%S"),
                lat=f"{node.fix.latitude:.6f}",
                lon=f"{node.fix.longitude:.6f}",
                frame=frame_rel,
            )
            for k, v in node.sensors.items():
                if k in row:
                    row[k] = f"{v:.2f}"
            rows_out.append(row)
            i += 1
    finally:
        node.destroy_node()
        rclpy.shutdown()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", choices=["sim", "ros2"], default="sim")
    p.add_argument("--mission-id", required=True)
    p.add_argument("--data", default=datetime.now().strftime("%Y-%m-%d"))
    p.add_argument("--local", default="Enseada de Jurujuba, Niterói/RJ")
    p.add_argument("--inicio", default="06:30")
    p.add_argument("--duracao", type=parse_dur, default="2h", help="ex.: 2h, 30m, 600s")
    p.add_argument("--intervalo", type=parse_dur, default="60s", help="ex.: 5s, 1m")
    p.add_argument("--out-dir", type=Path, default=Path("data"))
    p.add_argument("--lat0", type=float, default=-22.926686)
    p.add_argument("--lon0", type=float, default=-43.119029)
    p.add_argument("--sample-frame", type=Path, default=Path("src/assets/camera-frontal.jpg"),
                   help="imagem usada como frame no modo sim")
    p.add_argument("--topic-gps", default="/gps/fix")
    p.add_argument("--topic-image", default="/camera/image_raw/compressed")
    p.add_argument("--topic-sensor", nargs=2, action="append", metavar=("COLUNA", "TOPICO"), default=[],
                   help="ex.: --topic-sensor ph /sensors/ph")
    args = p.parse_args()

    frames_dir = args.out_dir / "frames" / args.mission_id
    frames_dir.mkdir(parents=True, exist_ok=True)

    inicio_dt = datetime.strptime(f"{args.data} {args.inicio}", "%Y-%m-%d %H:%M")
    rows: list[dict[str, str]] = []

    if args.source == "ros2":
        run_ros2(args, rows, frames_dir)
        fim_dt = datetime.now()
    else:
        n = max(2, args.duracao // args.intervalo)
        track = sim_track(n, args.lat0, args.lon0)
        for i, (lat, lon) in enumerate(track):
            ts = inicio_dt + timedelta(seconds=i * args.intervalo)
            frame_rel = ""
            if args.sample_frame.exists():
                name = ts.strftime("%H%M%S") + ".jpg"
                shutil.copyfile(args.sample_frame, frames_dir / name)
                frame_rel = f"frames/{args.mission_id}/{name}"
            row = {c: "" for c in COLUMNS}
            row.update(sim_sensors(i))
            row.update(
                timestamp=ts.strftime("%Y-%m-%d %H:%M:%S"),
                lat=f"{lat:.6f}", lon=f"{lon:.6f}", frame=frame_rel,
            )
            rows.append(row)
        fim_dt = inicio_dt + timedelta(seconds=(len(rows) - 1) * args.intervalo)

    if not rows:
        raise SystemExit("Nenhuma leitura capturada.")

    for row in rows:
        row.update(
            mission_id=args.mission_id, data=args.data, local=args.local,
            inicio=args.inicio, fim=fim_dt.strftime("%H:%M"),
        )

    out = args.out_dir / f"missao-{args.data.replace('-', '')}.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"{out} — {len(rows)} leituras, frames em {frames_dir}")


if __name__ == "__main__":
    main()
