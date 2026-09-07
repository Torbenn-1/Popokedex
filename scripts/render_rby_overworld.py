#!/usr/bin/env python3
"""Render + stitch RBY Kanto overworld from pret/pokered into one PNG.

Usage:
  python3 scripts/render_rby_overworld.py \\
    --pokered .local/pokered \\
    --out assets/maps/rby/kanto_full.png \\
    --meta assets/maps/rby/kanto_meta.json \\
    --scale 2
"""

from __future__ import annotations

import argparse
import json
import re
import struct
from collections import deque
from pathlib import Path

from PIL import Image

TILE_PX = 8
BLOCK_TILES = 4
BLOCK_PX = BLOCK_TILES * TILE_PX  # 32

# Classic Game Boy greens (RBY tilesheets are 2-bit grayscale)
GB_PALETTE = {
    0: (155, 188, 15, 255),
    1: (139, 172, 15, 255),
    2: (48, 98, 48, 255),
    3: (15, 56, 15, 255),
}


def colorize_gb(tile: Image.Image) -> Image.Image:
    """Map grayscale 2bpp shades onto a GB green palette."""
    rgba = tile.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # luminance bucket into 4 shades
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


# tileset constant → gfx basename (pokered)
TILESET_FILES = {
    "OVERWORLD": "overworld",
    "REDS_HOUSE_1": "reds_house",
    "MART": "pokecenter",  # shared mart/pokecenter gfx in some dumps; fallback
    "FOREST": "forest",
    "REDS_HOUSE_2": "reds_house",
    "DOJO": "gym",
    "POKECENTER": "pokecenter",
    "GYM": "gym",
    "HOUSE": "house",
    "FOREST_GATE": "gate",
    "MUSEUM": "gate",
    "UNDERGROUND": "underground",
    "GATE": "gate",
    "SHIP": "ship",
    "SHIP_PORT": "ship_port",
    "CEMETERY": "cemetery",
    "INTERIOR": "interior",
    "CAVERN": "cavern",
    "LOBBY": "lobby",
    "MANSION": "mansion",
    "LAB": "lab",
    "CLUB": "club",
    "FACILITY": "facility",
    "PLATEAU": "plateau",
}


def parse_map_constants(path: Path) -> dict[str, tuple[int, int]]:
    """CONST_ID -> (width, height) in blocks."""
    out: dict[str, tuple[int, int]] = {}
    rx = re.compile(r"map_const\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)")
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        m = rx.search(line)
        if m:
            out[m.group(1)] = (int(m.group(2)), int(m.group(3)))
    return out


def parse_headers(headers_dir: Path) -> dict[str, dict]:
    """MapLabel -> {const, tileset, connections: [{dir, label, const, offset}]}"""
    hdr_rx = re.compile(r"map_header\s+(\w+)\s*,\s*(\w+)\s*,\s*(\w+)")
    conn_rx = re.compile(
        r"connection\s+(north|south|west|east)\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(-?\d+)"
    )
    maps: dict[str, dict] = {}
    for path in sorted(headers_dir.glob("*.asm")):
        text = path.read_text(encoding="utf-8", errors="replace")
        hm = hdr_rx.search(text)
        if not hm:
            continue
        label, const, tileset = hm.group(1), hm.group(2), hm.group(3)
        conns = [
            {
                "dir": m.group(1),
                "label": m.group(2),
                "const": m.group(3),
                "offset": int(m.group(4)),
            }
            for m in conn_rx.finditer(text)
        ]
        maps[label] = {
            "label": label,
            "const": const,
            "tileset": tileset,
            "connections": conns,
            "header": path.name,
        }
    return maps


def load_tileset(pokered: Path, name: str) -> tuple[list[Image.Image], bytes]:
    base = TILESET_FILES.get(name, name.lower())
    png = pokered / "gfx" / "tilesets" / f"{base}.png"
    bst = pokered / "gfx" / "blocksets" / f"{base}.bst"
    if not png.exists():
        raise FileNotFoundError(f"missing tileset png: {png}")
    if not bst.exists():
        raise FileNotFoundError(f"missing blockset: {bst}")

    sheet = Image.open(png).convert("RGBA")
    tw, th = sheet.size
    cols = tw // TILE_PX
    rows = th // TILE_PX
    tiles = [
        colorize_gb(
            sheet.crop((x * TILE_PX, y * TILE_PX, (x + 1) * TILE_PX, (y + 1) * TILE_PX))
        )
        for y in range(rows)
        for x in range(cols)
    ]
    blockset = bst.read_bytes()
    return tiles, blockset


def render_map(
    blk: bytes,
    width: int,
    height: int,
    tiles: list[Image.Image],
    blockset: bytes,
) -> Image.Image:
    img = Image.new("RGBA", (width * BLOCK_PX, height * BLOCK_PX), (0, 0, 0, 0))
    expected = width * height
    if len(blk) < expected:
        raise ValueError(f"blk too short: {len(blk)} < {expected}")
    for i, block_id in enumerate(blk[:expected]):
        bx = (i % width) * BLOCK_PX
        by = (i // width) * BLOCK_PX
        base = block_id * 16
        if base + 16 > len(blockset):
            continue
        for ty in range(BLOCK_TILES):
            for tx in range(BLOCK_TILES):
                tid = blockset[base + ty * BLOCK_TILES + tx]
                if tid >= len(tiles):
                    continue
                img.paste(tiles[tid], (bx + tx * TILE_PX, by + ty * TILE_PX))
    return img


def stitch_overworld(
    maps: dict[str, dict],
    sizes: dict[str, tuple[int, int]],
    start: str = "PalletTown",
) -> dict[str, tuple[int, int]]:
    """BFS place maps in block coords. Returns label -> (x, y) top-left."""
    if start not in maps:
        raise SystemExit(f"start map missing: {start}")

    placed: dict[str, tuple[int, int]] = {start: (0, 0)}
    q = deque([start])

    while q:
        cur = q.popleft()
        cx, cy = placed[cur]
        cw, ch = sizes[maps[cur]["const"]]
        for conn in maps[cur]["connections"]:
            tgt = conn["label"]
            if tgt in placed or tgt not in maps:
                continue
            tw, th = sizes[maps[tgt]["const"]]
            o = conn["offset"]
            d = conn["dir"]
            if d == "north":
                tx, ty = cx + o, cy - th
            elif d == "south":
                tx, ty = cx + o, cy + ch
            elif d == "west":
                tx, ty = cx - tw, cy + o
            elif d == "east":
                tx, ty = cx + cw, cy + o
            else:
                continue
            placed[tgt] = (tx, ty)
            q.append(tgt)

    return placed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pokered", type=Path, default=Path(".local/pokered"))
    ap.add_argument("--out", type=Path, default=Path("assets/maps/rby/kanto_full.png"))
    ap.add_argument("--meta", type=Path, default=Path("assets/maps/rby/kanto_meta.json"))
    ap.add_argument("--scale", type=int, default=2, help="integer upscale factor")
    ap.add_argument("--start", default="PalletTown")
    args = ap.parse_args()

    pokered = args.pokered.resolve()
    sizes = parse_map_constants(pokered / "constants" / "map_constants.asm")
    maps = parse_headers(pokered / "data" / "maps" / "headers")
    placed = stitch_overworld(maps, sizes, args.start)

    # normalize to non-negative
    min_x = min(x for x, _ in placed.values())
    min_y = min(y for _, y in placed.values())
    placed = {k: (x - min_x, y - min_y) for k, (x, y) in placed.items()}

    max_x = max(placed[k][0] + sizes[maps[k]["const"]][0] for k in placed)
    max_y = max(placed[k][1] + sizes[maps[k]["const"]][1] for k in placed)

    canvas = Image.new("RGBA", (max_x * BLOCK_PX, max_y * BLOCK_PX), (40, 90, 160, 255))
    tileset_cache: dict[str, tuple[list[Image.Image], bytes]] = {}
    regions = []

    for label, (bx, by) in sorted(placed.items(), key=lambda kv: (kv[1][1], kv[1][0])):
        info = maps[label]
        const = info["const"]
        w, h = sizes[const]
        ts_name = info["tileset"]
        if ts_name not in tileset_cache:
            tileset_cache[ts_name] = load_tileset(pokered, ts_name)
        tiles, blockset = tileset_cache[ts_name]
        blk_path = pokered / "maps" / f"{label}.blk"
        if not blk_path.exists():
            print(f"skip missing blk: {label}")
            continue
        blk = blk_path.read_bytes()
        rendered = render_map(blk, w, h, tiles, blockset)
        canvas.paste(rendered, (bx * BLOCK_PX, by * BLOCK_PX), rendered)
        regions.append(
            {
                "id": label,
                "const": const,
                "tileset": ts_name,
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
        print(f"placed {label} @ block ({bx},{by}) size {w}x{h}")

    scale = max(1, int(args.scale))
    if scale != 1:
        canvas = canvas.resize(
            (canvas.width * scale, canvas.height * scale),
            Image.Resampling.NEAREST,
        )
        for r in regions:
            for k in ("pixel_x", "pixel_y", "pixel_w", "pixel_h"):
                r[k] *= scale

    args.out.parent.mkdir(parents=True, exist_ok=True)
    # flatten on ocean blue for smaller PNG
    bg = Image.new("RGB", canvas.size, (40, 90, 160))
    bg.paste(canvas, mask=canvas.split()[3] if canvas.mode == "RGBA" else None)
    bg.save(args.out, optimize=True)
    print(f"wrote {args.out} ({bg.size[0]}x{bg.size[1]}) maps={len(regions)}")

    meta = {
        "source": "pret/pokered overworld stitch",
        "scale": scale,
        "block_px": BLOCK_PX * scale,
        "width": bg.size[0],
        "height": bg.size[1],
        "maps": regions,
    }
    args.meta.parent.mkdir(parents=True, exist_ok=True)
    args.meta.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.meta}")


if __name__ == "__main__":
    main()
