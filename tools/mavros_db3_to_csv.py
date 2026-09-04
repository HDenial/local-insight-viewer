#!/usr/bin/env python3
"""Convert ROS 2 bags produced by rosbag.py into Boat Tracker CSV data."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
from rosbags.highlevel import AnyReader
from rosbags.typesys import Stores, get_types_from_msg, get_typestore


GPS_TYPE = "mavros_msgs/msg/GPSRAW"
GPS_MSGDEF = """
std_msgs/Header header
uint8 GPS_FIX_TYPE_NO_GPS=0
uint8 GPS_FIX_TYPE_NO_FIX=1
uint8 GPS_FIX_TYPE_2D_FIX=2
uint8 GPS_FIX_TYPE_3D_FIX=3
uint8 GPS_FIX_TYPE_DGPS=4
uint8 GPS_FIX_TYPE_RTK_FLOAT=5
uint8 GPS_FIX_TYPE_RTK_FIXED=6
uint8 GPS_FIX_TYPE_STATIC=7
uint8 GPS_FIX_TYPE_PPP=8
uint8 fix_type
int32 lat
int32 lon
int32 alt
uint16 eph
uint16 epv
uint16 vel
uint16 cog
uint8 satellites_visible
int32 alt_ellipsoid
uint32 h_acc
uint32 v_acc
uint32 vel_acc
int32 hdg_acc
uint16 yaw
uint8 dgps_numch
uint32 dgps_age
"""

COLUMNS = [
    "mission_id", "data", "local", "inicio", "fim", "timestamp", "lat", "lon",
    "ph", "oxigenio_dissolvido", "temperatura", "turbidez", "salinidade",
    "mono_p", "multi_p", "camera_r", "camera_v", "frame", "frame_v", "frame_r",
]


def parse_duration(value: str) -> float:
    """Parse seconds, or a duration ending in s, m, or h."""
    text = value.strip().lower()
    multiplier = {"s": 1, "m": 60, "h": 3600}.get(text[-1:], 1)
    if text[-1:] in "smh":
        text = text[:-1]
    try:
        seconds = float(text) * multiplier
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"duração inválida: {value!r}") from exc
    if seconds <= 0:
        raise argparse.ArgumentTypeError("a duração deve ser maior que zero")
    return seconds


def raw_image_to_jpeg(msg: Any, quality: int) -> bytes:
    """Encode a sensor_msgs/Image as JPEG."""
    try:
        import cv2
    except ImportError as exc:
        raise SystemExit("OpenCV é necessário: instale o pacote python3-opencv.") from exc

    channels_by_encoding = {
        "bgr8": 3, "rgb8": 3, "bgra8": 4, "rgba8": 4,
        "mono8": 1, "8uc1": 1, "8uc3": 3, "8uc4": 4,
    }
    encoding = msg.encoding.lower()
    channels = channels_by_encoding.get(encoding)
    if channels is None:
        raise ValueError(f"encoding de imagem não suportado: {msg.encoding!r}")

    packed_width = int(msg.width) * channels
    pixels = np.asarray(msg.data, dtype=np.uint8).reshape(int(msg.height), int(msg.step))
    pixels = np.ascontiguousarray(pixels[:, :packed_width])
    if channels > 1:
        pixels = pixels.reshape(int(msg.height), int(msg.width), channels)

    if encoding in {"rgb8", "8uc3"}:
        pixels = cv2.cvtColor(pixels, cv2.COLOR_RGB2BGR)
    elif encoding == "rgba8":
        pixels = cv2.cvtColor(pixels, cv2.COLOR_RGBA2BGR)
    elif encoding in {"bgra8", "8uc4"}:
        pixels = cv2.cvtColor(pixels, cv2.COLOR_BGRA2BGR)

    ok, encoded = cv2.imencode(".jpg", pixels, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("OpenCV não conseguiu codificar o frame como JPEG")
    return encoded.tobytes()


def sensor_value(msg: Any) -> float:
    """Read common scalar ROS messages (std_msgs and sensor_msgs/Range)."""
    for field in ("data", "range"):
        if hasattr(msg, field):
            return float(getattr(msg, field))
    raise ValueError("o tópico de sensor não possui um campo 'data' ou 'range'")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db3-path", type=Path, required=True,
                        help="Diretório da rosbag ou arquivo .db3")
    parser.add_argument("--mission-id", required=True)
    parser.add_argument("--local", default="Enseada de Jurujuba, Niterói/RJ")
    parser.add_argument("--intervalo", type=parse_duration, default="5s")
    parser.add_argument("--out-dir", type=Path, default=Path("data"))
    parser.add_argument("--topic-gps", default="/mavros/gpsstatus/gps2/raw")
    parser.add_argument("--topic-image-back", default="/mavros/camera/b/raw",
                        help="Câmera de ré (back), gravada em frame_r")
    parser.add_argument("--topic-image-front", default="/mavros/camera/f/raw",
                        help="Câmera de vante (front), gravada em frame_v")
    parser.add_argument("--jpeg-quality", type=int, choices=range(1, 101), default=90,
                        metavar="1-100")
    parser.add_argument("--topic-sensor", nargs=2, action="append", default=[],
                        metavar=("COLUNA", "TOPICO"),
                        help="Ex.: --topic-sensor mono_p /mavros/rangefinder/rangefinder")
    args = parser.parse_args()

    if not args.db3_path.exists():
        parser.error(f"arquivo ou diretório não encontrado: {args.db3_path}")
    invalid_columns = [column for column, _ in args.topic_sensor if column not in COLUMNS]
    if invalid_columns:
        parser.error(f"colunas de sensor inválidas: {', '.join(invalid_columns)}")

    # The recorder was built against the ROS 2 Humble-era message schemas.
    # Newer sensor_msgs/Range definitions contain an additional variance field.
    typestore = get_typestore(Stores.ROS2_HUMBLE)
    typestore.register(get_types_from_msg(GPS_MSGDEF, GPS_TYPE))
    sensor_map = {topic: column for column, topic in args.topic_sensor}
    camera_map = {
        args.topic_image_back: ("frame_r", "re"),
        args.topic_image_front: ("frame_v", "vante"),
    }
    wanted_topics = {args.topic_gps, *camera_map, *sensor_map}

    rows: list[dict[str, str]] = []
    latest_images: dict[str, Any] = {}
    latest_sensors: dict[str, float] = {}
    last_sample_ns: int | None = None
    interval_ns = int(args.intervalo * 1_000_000_000)

    frames_dir = args.out_dir / "frames" / args.mission_id
    frames_dir.mkdir(parents=True, exist_ok=True)

    with AnyReader([args.db3_path], default_typestore=typestore) as reader:
        by_topic = {connection.topic: connection for connection in reader.connections}
        required_topics = {args.topic_gps, *sensor_map}
        missing = sorted(required_topics - by_topic.keys())
        if missing:
            available = ", ".join(sorted(by_topic))
            raise SystemExit(
                f"Tópicos ausentes no bag: {', '.join(missing)}. Disponíveis: {available}"
            )
        if by_topic[args.topic_gps].msgtype != GPS_TYPE:
            raise SystemExit(
                f"{args.topic_gps} usa {by_topic[args.topic_gps].msgtype}, esperado {GPS_TYPE}."
            )
        for topic in camera_map.keys() & by_topic.keys():
            if by_topic[topic].msgtype != "sensor_msgs/msg/Image":
                raise SystemExit(f"{topic} não é sensor_msgs/msg/Image.")

        connections = [by_topic[topic] for topic in wanted_topics if topic in by_topic]
        for connection, timestamp_ns, rawdata in reader.messages(connections=connections):
            msg = reader.deserialize(rawdata, connection.msgtype)
            if connection.topic in camera_map:
                latest_images[connection.topic] = msg
                continue
            if connection.topic in sensor_map:
                latest_sensors[sensor_map[connection.topic]] = sensor_value(msg)
                continue

            # GPSRAW stores latitude and longitude as signed degrees * 1e7.
            if msg.fix_type < 2 or (msg.lat == 0 and msg.lon == 0):
                continue
            if last_sample_ns is not None and timestamp_ns - last_sample_ns < interval_ns:
                continue
            last_sample_ns = timestamp_ns
            timestamp = datetime.fromtimestamp(timestamp_ns / 1e9)

            frames: dict[str, str] = {}
            for topic, image in latest_images.items():
                column, prefix = camera_map[topic]
                filename = f"{prefix}-{timestamp.strftime('%H%M%S')}.jpg"
                (frames_dir / filename).write_bytes(
                    raw_image_to_jpeg(image, args.jpeg_quality)
                )
                frames[column] = f"frames/{args.mission_id}/{filename}"

            row = {column: "" for column in COLUMNS}
            row.update(
                timestamp=timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                lat=f"{msg.lat / 1e7:.7f}",
                lon=f"{msg.lon / 1e7:.7f}",
                **frames,
            )
            for column, value in latest_sensors.items():
                row[column] = f"{value:.2f}"
            rows.append(row)

    if not rows:
        raise SystemExit("Nenhum fix GPS válido foi encontrado no bag.")

    first = datetime.strptime(rows[0]["timestamp"], "%Y-%m-%d %H:%M:%S")
    last = datetime.strptime(rows[-1]["timestamp"], "%Y-%m-%d %H:%M:%S")
    date = first.strftime("%Y-%m-%d")
    for row in rows:
        row.update(
            mission_id=args.mission_id,
            data=date,
            local=args.local,
            inicio=first.strftime("%H:%M"),
            fim=last.strftime("%H:%M"),
        )

    output = args.out_dir / f"missao-{date.replace('-', '')}.csv"
    with output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"{output} — {len(rows)} leituras. Frames salvos em: {frames_dir}")


if __name__ == "__main__":
    main()
