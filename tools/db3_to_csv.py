#!/usr/bin/env python3
"""
Converte um arquivo de gravação .db3 (ROS 2 Bag) em um CSV e extrai os frames
no formato esperado pelo Boat Tracker.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path

from rosbags.rosbag2 import Reader
from rosbags.serde import deserialize_cdr

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


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db3-path", type=Path, required=True, help="Caminho para o diretório da rosbag ou arquivo .db3")
    p.add_argument("--mission-id", required=True, help="Identificador da missão (ex.: OP-20260601)")
    p.add_argument("--local", default="Enseada de Jurujuba, Niterói/RJ")
    p.add_argument("--intervalo", type=parse_dur, default="5s", help="Intervalo mínimo de amostragem no CSV (ex.: 5s, 1m)")
    p.add_argument("--out-dir", type=Path, default=Path("data"))
    p.add_argument("--topic-gps", default="/gps/fix")
    p.add_argument("--topic-image", default="/camera/image_raw/compressed")
    p.add_argument("--topic-sensor", nargs=2, action="append", metavar=("COLUNA", "TOPICO"), default=[],
                   help="Mapeia uma coluna para um tópico de valor flutuante (ex.: --topic-sensor ph /sensors/ph)")

    args = p.parse_args()

    # Prepara diretório de frames
    frames_dir = args.out_dir / "frames" / args.mission_id
    frames_dir.mkdir(parents=True, exist_ok=True)

    sensor_map = {topic: col for col, topic in args.topic_sensor}

    # Estado atual dos tópicos para amostragem
    current_gps: tuple[float, float] | None = None
    current_frame: bytes | None = None
    current_sensors: dict[str, float] = {}

    rows: list[dict[str, str]] = []
    last_sample_time: datetime | None = None

    # Leitura do DB3
    with Reader(args.db3_path) as reader:
        # Filtra apenas os tópicos que interessam
        target_topics = {args.topic_gps, args.topic_image}.union(sensor_map.keys())
        connections = [c for c in reader.connections if c.topic in target_topics]

        for connection, timestamp_ns, rawdata in reader.messages(connections=connections):
            msg = deserialize_cdr(rawdata, connection.msgtype)
            msg_dt = datetime.fromtimestamp(timestamp_ns / 1e9)

            # Atualiza estado com base no tópico
            if connection.topic == args.topic_gps:
                current_gps = (msg.latitude, msg.longitude)
            elif connection.topic == args.topic_image:
                # Trata sensor_msgs/msg/CompressedImage
                current_frame = bytes(msg.data)
            elif connection.topic in sensor_map:
                col = sensor_map[connection.topic]
                current_sensors[col] = float(msg.data)

            # Amostragem temporal orientada pelo intervalo
            if current_gps is not None:
                if last_sample_time is None or (msg_dt - last_sample_time).total_seconds() >= args.intervalo:
                    last_sample_time = msg_dt
                    
                    frame_rel = ""
                    if current_frame:
                        name = msg_dt.strftime("%H%M%S") + ".jpg"
                        (frames_dir / name).write_bytes(current_frame)
                        frame_rel = f"frames/{args.mission_id}/{name}"
                        current_frame = None  # Consome o frame salvo

                    row = {c: "" for c in COLUMNS}
                    row.update(
                        timestamp=msg_dt.strftime("%Y-%m-%d %H:%M:%S"),
                        lat=f"{current_gps[0]:.6f}",
                        lon=f"{current_gps[1]:.6f}",
                        frame=frame_rel,
                    )

                    for k, v in current_sensors.items():
                        if k in row:
                            row[k] = f"{v:.2f}"

                    rows.append(row)

    if not rows:
        raise SystemExit("Nenhuma leitura válida foi extraída do arquivo .db3.")

    # Metadados globais da missão
    data_str = datetime.strptime(rows[0]["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d")
    inicio_str = datetime.strptime(rows[0]["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%H:%M")
    fim_str = datetime.strptime(rows[-1]["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%H:%M")

    for row in rows:
        row.update(
            mission_id=args.mission_id,
            data=data_str,
            local=args.local,
            inicio=inicio_str,
            fim=fim_str,
        )

    # Gravação do CSV
    out = args.out_dir / f"missao-{data_str.replace('-', '')}.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"{out} — {len(rows)} leituras geradas com sucesso. Frames salvos em: {frames_dir}")


if __name__ == "__main__":
    main()
