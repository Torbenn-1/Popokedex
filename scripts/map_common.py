#!/usr/bin/env python3
"""Shared helpers for overworld stitch → PNG → markers."""

from __future__ import annotations

import json
import math
import re
import shutil
from collections import deque
from pathlib import Path

from PIL import Image

TILE_PX = 8
BLOCK_TILES = 4
BLOCK_PX = 32  # gen1/2 block = 4x4 tiles

GB_PALETTE = {
    0: (155, 188, 15, 255),
    1: (139, 172, 15, 255),
    2: (48, 98, 48, 255),
    3: (15, 56, 15, 255),
}


def colorize_gb(tile: Image.Image) -> Image.Image:
    rgba = tile.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r + g + b) // 3
            if lum >= 192:
                shade = 0
            elif lum >= 128:
                shade = 1
            elif lum >= 64:
                shade = 2
            else:
                shade = 3
            px[x, y] = GB_PALETTE[shade]
    return rgba


def camel_to_kebab(name: str) -> str:
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", name)
    s = re.sub(r"([A-Za-z])(\d)", r"\1-\2", s)
    return s.lower()


def pretty_label(name: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    s = re.sub(r"(Route)(\d+)", r"\1 \2", s)
    s = s.replace("_", " ")
    return s


def stitch_place(
    maps: dict[str, dict],
    sizes: dict[str, tuple[int, int]],
    start: str,
) -> dict[str, tuple[int, int]]:
    """BFS place maps. maps[id] has connections: [{dir, target, offset}]. sizes[id]=(w,h)."""
    if start not in maps:
        raise SystemExit(f"start map missing: {start}")
    placed = {start: (0, 0)}
    q = deque([start])
    while q:
        cur = q.popleft()
        cx, cy = placed[cur]
        cw, ch = sizes[cur]
        for conn in maps[cur].get("connections", []):
            tgt = conn["target"]
            if tgt in placed or tgt not in maps:
                continue
            tw, th = sizes[tgt]
            o = int(conn["offset"])
            d = conn["dir"]
            if d in ("north", "up"):
                tx, ty = cx + o, cy - th
            elif d in ("south", "down"):
                tx, ty = cx + o, cy + ch
            elif d in ("west", "left"):
                tx, ty = cx - tw, cy + o
            elif d in ("east", "right"):
                tx, ty = cx + cw, cy + o
            else:
                continue
            placed[tgt] = (tx, ty)
            q.append(tgt)
    return placed


def normalize_placed(placed: dict[str, tuple[int, int]]):
    min_x = min(x for x, _ in placed.values())
    min_y = min(y for _, y in placed.values())
    return {k: (x - min_x, y - min_y) for k, (x, y) in placed.items()}


def cut_tiles(image: Path, out_dir: Path, tile_size: int = 256, max_zoom: int | None = None):
    img = Image.open(image).convert("RGB")
    w, h = img.size
    ts = tile_size
    max_dim = max(w, h)
    if max_zoom is None:
        max_zoom = max(0, math.ceil(math.log2(max_dim / ts)))
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    counts = {}
    for z in range(0, max_zoom + 1):
        world = ts * (2**z)
        scale = min(world / w, world / h)
        rw = max(1, int(round(w * scale)))
        rh = max(1, int(round(h * scale)))
        resized = img.resize((rw, rh), Image.Resampling.NEAREST)
        canvas = Image.new("RGB", (world, world), (40, 90, 160))
        ox = (world - rw) // 2
        oy = (world - rh) // 2
        canvas.paste(resized, (ox, oy))
        n = 2**z
        for x in range(n):
            xdir = out_dir / str(z) / str(x)
            xdir.mkdir(parents=True, exist_ok=True)
            for y in range(n):
                tile = canvas.crop((x * ts, y * ts, (x + 1) * ts, (y + 1) * ts))
                tile.save(xdir / f"{y}.png", optimize=True)
        counts[z] = n * n
        print(f"  z={z}: {n}x{n}")
    world_max = ts * (2**max_zoom)
    scale_max = min(world_max / w, world_max / h)
    rw = int(round(w * scale_max))
    rh = int(round(h * scale_max))
    ox = (world_max - rw) // 2
    oy = (world_max - rh) // 2
    meta = {
        "tileSize": ts,
        "minZoom": 0,
        "maxZoom": max_zoom,
        "imageWidth": w,
        "imageHeight": h,
        "worldSize": world_max,
        "content": {
            "offsetX": ox,
            "offsetY": oy,
            "width": rw,
            "height": rh,
            "scale": scale_max,
        },
        "tileUrl": "{z}/{x}/{y}.png",
        "tilesPerZoom": counts,
    }
    (out_dir / "tilejson.json").write_text(json.dumps(meta, indent=2) + "\n")
    return meta


def write_markers(
    out: Path,
    *,
    game: str,
    region: str,
    tilejson: dict,
    regions: list[dict],
    match_fn,
    tiles_rel: str,
    image_rel: str,
    aliases: list[str] | None = None,
):
    """Markers use image pixel coords (top-left origin) for L.imageOverlay."""
    markers = []
    for m in regions:
        mid = m["id"]
        cx = m["pixel_x"] + m["pixel_w"] / 2
        cy = m["pixel_y"] + m["pixel_h"] / 2
        markers.append(
            {
                "id": camel_to_kebab(mid).replace("_", "-"),
                "label": pretty_label(mid),
                "match": match_fn(mid),
                "x": round(cx, 2),
                "y": round(cy, 2),
                "map": mid,
            }
        )
    markers.sort(key=lambda m: m["label"])
    payload = {
        "game": game,
        "region": region,
        "image": image_rel,
        "imageWidth": tilejson["imageWidth"],
        "imageHeight": tilejson["imageHeight"],
        "maxZoom": 2,
        "minZoom": -3,
        "tiles": tiles_rel,
        "markers": markers,
    }
    if aliases:
        payload["alsoFor"] = aliases
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"  markers {out} ({len(markers)})")
    return payload
