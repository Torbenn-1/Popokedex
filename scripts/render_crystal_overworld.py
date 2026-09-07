#!/usr/bin/env python3
"""Stitch pokecrystal (GSC) overworld into one PNG + meta."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image

from map_common import (
    BLOCK_PX,
    TILE_PX,
    colorize_gb,
    normalize_placed,
    stitch_place,
)


def parse_sizes(path: Path) -> dict[str, tuple[int, int]]:
    """CONST_ID -> (w,h); also Camel label via later maps."""
    out = {}
    rx = re.compile(r"map_const\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)")
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        m = rx.search(line)
        if m:
            out[m.group(1)] = (int(m.group(2)), int(m.group(3)))
    return out


def parse_attributes(path: Path) -> dict[str, dict]:
    """label -> {const, connections}"""
    text = path.read_text(encoding="utf-8", errors="replace")
    maps = {}
    # split on map_attributes
    parts = re.split(r"(?m)^\s*map_attributes\s+", text)
    attr_rx = re.compile(r"^(\w+)\s*,\s*(\w+)")
    conn_rx = re.compile(
        r"connection\s+(north|south|west|east)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(-?\d+)"
    )
    for part in parts[1:]:
        hm = attr_rx.match(part.strip())
        if not hm:
            continue
        label, const = hm.group(1), hm.group(2)
        # only keep until next map_attributes chunk (already split)
        chunk = part
        conns = [
            {"dir": m.group(1), "target": m.group(2), "const": m.group(3), "offset": int(m.group(4))}
            for m in conn_rx.finditer(chunk)
        ]
        maps[label] = {"label": label, "const": const, "connections": conns}
    return maps


def parse_tilesets(maps_asm: Path) -> dict[str, str]:
    """label -> tileset file stem (johto, kanto, …)"""
    out = {}
    rx = re.compile(r"map\s+(\w+)\s*,\s*TILESET_(\w+)\s*,")
    for line in maps_asm.read_text(encoding="utf-8", errors="replace").splitlines():
        m = rx.search(line)
        if m:
            out[m.group(1)] = m.group(2).lower()
    return out


def load_tileset(root: Path, stem: str):
    png = root / "gfx" / "tilesets" / f"{stem}.png"
    meta = root / "data" / "tilesets" / f"{stem}_metatiles.bin"
    if not png.exists() or not meta.exists():
        raise FileNotFoundError(stem)
    sheet = Image.open(png).convert("RGBA")
    tw, th = sheet.size
    cols, rows = tw // TILE_PX, th // TILE_PX
    tiles = [
        colorize_gb(sheet.crop((x * TILE_PX, y * TILE_PX, (x + 1) * TILE_PX, (y + 1) * TILE_PX)))
        for y in range(rows)
        for x in range(cols)
    ]
    return tiles, meta.read_bytes()


def render_map(blk: bytes, w: int, h: int, tiles, blockset: bytes) -> Image.Image:
    img = Image.new("RGBA", (w * BLOCK_PX, h * BLOCK_PX), (0, 0, 0, 0))
    for i, block_id in enumerate(blk[: w * h]):
        bx = (i % w) * BLOCK_PX
        by = (i // w) * BLOCK_PX
        base = block_id * 16
        if base + 16 > len(blockset):
            continue
        for ty in range(4):
            for tx in range(4):
                tid = blockset[base + ty * 4 + tx]
                if tid >= len(tiles):
                    continue
                img.paste(tiles[tid], (bx + tx * TILE_PX, by + ty * TILE_PX))
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path(".local/pokecrystal"))
    ap.add_argument("--out", type=Path, default=Path("assets/maps/gsc/world_full.png"))
    ap.add_argument("--meta", type=Path, default=Path("assets/maps/gsc/world_meta.json"))
    ap.add_argument("--start", default="NewBarkTown")
    ap.add_argument("--scale", type=int, default=1)
    args = ap.parse_args()
    root = args.root.resolve()

    sizes_by_const = parse_sizes(root / "constants" / "map_constants.asm")
    attrs = parse_attributes(root / "data" / "maps" / "attributes.asm")
    tilesets = parse_tilesets(root / "data" / "maps" / "maps.asm")

    # only maps with outdoor connections
    outdoor = {k: v for k, v in attrs.items() if v["connections"]}
    # ensure start included even if somehow empty
    outdoor.setdefault(args.start, attrs[args.start])

    sizes = {}
    maps_for_stitch = {}
    for label, info in outdoor.items():
        const = info["const"]
        if const not in sizes_by_const:
            continue
        sizes[label] = sizes_by_const[const]
        maps_for_stitch[label] = {
            "connections": [
                {"dir": c["dir"], "target": c["target"], "offset": c["offset"]}
                for c in info["connections"]
                if c["target"] in outdoor or c["target"] in attrs
            ]
        }
    # include connection targets that have no outbound connections (dead ends)
    for label, info in list(maps_for_stitch.items()):
        for c in attrs[label]["connections"]:
            t = c["target"]
            if t not in maps_for_stitch and t in attrs and attrs[t]["const"] in sizes_by_const:
                maps_for_stitch[t] = {
                    "connections": [
                        {"dir": x["dir"], "target": x["target"], "offset": x["offset"]}
                        for x in attrs[t]["connections"]
                    ]
                }
                sizes[t] = sizes_by_const[attrs[t]["const"]]

    # expand BFS universe: any target reachable
    changed = True
    while changed:
        changed = False
        for label in list(maps_for_stitch):
            for c in attrs.get(label, {}).get("connections", []):
                t = c["target"]
                if t not in maps_for_stitch and t in attrs and attrs[t]["const"] in sizes_by_const:
                    maps_for_stitch[t] = {
                        "connections": [
                            {"dir": x["dir"], "target": x["target"], "offset": x["offset"]}
                            for x in attrs[t]["connections"]
                        ]
                    }
                    sizes[t] = sizes_by_const[attrs[t]["const"]]
                    changed = True

    placed = normalize_placed(stitch_place(maps_for_stitch, sizes, args.start))
    max_x = max(placed[k][0] + sizes[k][0] for k in placed)
    max_y = max(placed[k][1] + sizes[k][1] for k in placed)

    canvas = Image.new("RGBA", (max_x * BLOCK_PX, max_y * BLOCK_PX), (40, 90, 160, 255))
    cache = {}
    regions = []
    for label, (bx, by) in sorted(placed.items(), key=lambda kv: (kv[1][1], kv[1][0])):
        w, h = sizes[label]
        stem = tilesets.get(label, "johto")
        if stem not in cache:
            try:
                cache[stem] = load_tileset(root, stem)
            except FileNotFoundError:
                print(f"  missing tileset {stem} for {label}, skip")
                continue
        tiles, blockset = cache[stem]
        blk_path = root / "maps" / f"{label}.blk"
        if not blk_path.exists():
            print(f"  missing blk {label}")
            continue
        rendered = render_map(blk_path.read_bytes(), w, h, tiles, blockset)
        canvas.paste(rendered, (bx * BLOCK_PX, by * BLOCK_PX), rendered)
        regions.append(
            {
                "id": label,
                "tileset": stem,
                "block_x": bx,
                "block_y": by,
                "width_blocks": w,
                "height_blocks": h,
                "pixel_x": bx * BLOCK_PX,
                "pixel_y": by * BLOCK_PX,
                "pixel_w": w * BLOCK_PX,
                "pixel_h": h * BLOCK_PX,
            }
        )
        print(f"  {label} @ ({bx},{by})")

    scale = max(1, args.scale)
    if scale != 1:
        canvas = canvas.resize((canvas.width * scale, canvas.height * scale), Image.Resampling.NEAREST)
        for r in regions:
            for k in ("pixel_x", "pixel_y", "pixel_w", "pixel_h"):
                r[k] *= scale

    args.out.parent.mkdir(parents=True, exist_ok=True)
    bg = Image.new("RGB", canvas.size, (40, 90, 160))
    bg.paste(canvas, mask=canvas.split()[3])
    bg.save(args.out, optimize=True)
    meta = {
        "source": "pret/pokecrystal overworld stitch",
        "scale": scale,
        "width": bg.size[0],
        "height": bg.size[1],
        "maps": regions,
    }
    args.meta.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {args.out} {bg.size} maps={len(regions)}")


if __name__ == "__main__":
    main()
