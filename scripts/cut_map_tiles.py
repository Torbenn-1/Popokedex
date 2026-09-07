#!/usr/bin/env python3
"""Cut a large map PNG into Leaflet XYZ tiles (CRS.Simple friendly).

Produces:
  out_dir/{z}/{x}/{y}.png
  out_dir/tilejson.json  (bounds + zoom range for the viewer)

Usage:
  python3 scripts/cut_map_tiles.py \\
    --image assets/maps/rby/kanto_full.png \\
    --out assets/maps/rby/tiles \\
    --tile-size 256
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--tile-size", type=int, default=256)
    ap.add_argument(
        "--max-zoom",
        type=int,
        default=None,
        help="default: ceil(log2(max(w,h)/tile))",
    )
    args = ap.parse_args()

    img = Image.open(args.image).convert("RGB")
    w, h = img.size
    ts = args.tile_size
    max_dim = max(w, h)
    max_zoom = args.max_zoom
    if max_zoom is None:
        max_zoom = max(0, math.ceil(math.log2(max_dim / ts)))

    if args.out.exists():
        shutil.rmtree(args.out)
    args.out.mkdir(parents=True)

    # At zoom z, world size is tile_size * 2^z. We cover the image with that grid.
    # For CRS.Simple / L.tileLayer with noWrap, y increases downward (Leaflet default for
    # geographic is north-up; for Simple we use L.CRS.Simple and custom TileLayer or
    # map coords carefully). We'll emit standard {z}/{x}/{y} with y from top.
    counts = {}
    for z in range(0, max_zoom + 1):
        world = ts * (2**z)
        # scale image to fit world while preserving aspect (letterbox into world canvas)
        scale = min(world / w, world / h)
        rw = max(1, int(round(w * scale)))
        rh = max(1, int(round(h * scale)))
        resized = img.resize((rw, rh), Image.Resampling.NEAREST)
        canvas = Image.new("RGB", (world, world), (40, 90, 160))
        ox = (world - rw) // 2
        oy = (world - rh) // 2
        canvas.paste(resized, (ox, oy))

        n = 2**z
        zdir = args.out / str(z)
        for x in range(n):
            xdir = zdir / str(x)
            xdir.mkdir(parents=True, exist_ok=True)
            for y in range(n):
                tile = canvas.crop((x * ts, y * ts, (x + 1) * ts, (y + 1) * ts))
                tile.save(xdir / f"{y}.png", optimize=True)
        counts[z] = n * n
        print(f"z={z}: {n}x{n} = {counts[z]} tiles (world {world}px)")

    # Pixel bounds of the map content inside the max-zoom world (for markers).
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
    (args.out / "tilejson.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {args.out} maxZoom={max_zoom}")


if __name__ == "__main__":
    main()
