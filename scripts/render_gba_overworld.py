#!/usr/bin/env python3
"""Stitch Gen3 overworld (pokeemerald / pokefirered) into one PNG + meta."""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image

from map_common import normalize_placed, stitch_place

TILE_PX = 8
META_PX = 16  # one metatile = 16x16
NUM_METATILES_PRIMARY = 0x200


def parse_jasc_pal(path: Path) -> list[tuple[int, int, int, int]]:
    lines = path.read_text(encoding="utf-8", errors="replace").strip().splitlines()
    # JASC-PAL / 0100 / count / rgb lines
    colors = []
    for line in lines[3:]:
        parts = line.split()
        if len(parts) >= 3:
            r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
            colors.append((r, g, b, 255 if len(colors) else 0))  # index 0 transparent-ish
    while len(colors) < 16:
        colors.append((0, 0, 0, 255))
    colors[0] = (colors[0][0], colors[0][1], colors[0][2], 0)
    return colors[:16]


def load_tileset(ts_dir: Path):
    tiles_png = Image.open(ts_dir / "tiles.png").convert("P")
    # build RGBA tiles with each of 16 palettes applied later per-tile
    raw = tiles_png.convert("RGBA")
    # Actually tiles are indexed; keep palette indices from P mode
    indexed = Image.open(ts_dir / "tiles.png")
    if indexed.mode != "P":
        indexed = indexed.convert("P")
    tw, th = indexed.size
    cols, rows = tw // TILE_PX, th // TILE_PX
    # store as raw palette-index images (mode P) cropped
    tiles_p = []
    for y in range(rows):
        for x in range(cols):
            tiles_p.append(
                indexed.crop((x * TILE_PX, y * TILE_PX, (x + 1) * TILE_PX, (y + 1) * TILE_PX))
            )

    pals = []
    pal_dir = ts_dir / "palettes"
    for i in range(16):
        p = pal_dir / f"{i:02d}.pal"
        if p.exists():
            pals.append(parse_jasc_pal(p))
        else:
            pals.append([(0, 0, 0, 0)] * 16)

    meta = (ts_dir / "metatiles.bin").read_bytes()
    return {"tiles": tiles_p, "pals": pals, "metatiles": meta, "path": ts_dir}


def tile_to_rgba(tile_p: Image.Image, pal: list[tuple[int, int, int, int]], hflip: bool, vflip: bool):
    t = tile_p
    if hflip:
        t = t.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if vflip:
        t = t.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    # map indices through palette
    src = t.load()
    out = Image.new("RGBA", (TILE_PX, TILE_PX))
    dst = out.load()
    for y in range(TILE_PX):
        for x in range(TILE_PX):
            idx = src[x, y]
            if isinstance(idx, tuple):
                idx = idx[0]
            idx &= 0xF
            dst[x, y] = pal[idx]
    return out


def render_metatile(ts_primary, ts_secondary, metatile_id: int) -> Image.Image:
    mid = metatile_id & 0x03FF
    if mid < NUM_METATILES_PRIMARY:
        ts = ts_primary
        local = mid
    else:
        ts = ts_secondary
        local = mid - NUM_METATILES_PRIMARY
    base = local * 16
    meta = ts["metatiles"]
    if base + 16 > len(meta):
        return Image.new("RGBA", (META_PX, META_PX), (0, 0, 0, 0))

    # 8 tiles: bottom layer 0-3, top layer 4-7; each 2x2 of 8x8
    # layout: TL TR / BL BR for each layer
    entries = struct.unpack_from("<8H", meta, base)
    img = Image.new("RGBA", (META_PX, META_PX), (0, 0, 0, 0))

    def blit_layer(start: int):
        positions = [(0, 0), (8, 0), (0, 8), (8, 8)]
        for i, (px, py) in enumerate(positions):
            e = entries[start + i]
            tile_num = e & 0x3FF
            hflip = bool(e & 0x400)
            vflip = bool(e & 0x800)
            pal_idx = (e >> 12) & 0xF
            if tile_num >= len(ts["tiles"]):
                continue
            tile = tile_to_rgba(ts["tiles"][tile_num], ts["pals"][pal_idx], hflip, vflip)
            img.paste(tile, (px, py), tile)

    blit_layer(0)
    blit_layer(4)
    return img


def resolve_tileset_path(root: Path, const_name: str) -> Path:
    # gTileset_General -> primary/general or secondary/...
    name = const_name
    if name.startswith("gTileset_"):
        name = name[len("gTileset_") :]
    # CamelCase to folder: Petalburg -> petalburg, SecretBaseBrownCave -> secret_base_brown_cave?
    # pret uses snake: General -> general, Petalburg -> petalburg
    folder = re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
    for kind in ("primary", "secondary"):
        p = root / "data" / "tilesets" / kind / folder
        if p.exists():
            return p
    raise FileNotFoundError(const_name)


def load_all_maps(root: Path):
    layouts = {
        L["id"]: L
        for L in json.loads((root / "data" / "layouts" / "layouts.json").read_text())["layouts"]
        if L.get("id")
    }
    maps = {}
    sizes = {}
    maps_dir = root / "data" / "maps"
    for mj in maps_dir.glob("*/map.json"):
        data = json.loads(mj.read_text())
        name = data["name"]
        layout_id = data["layout"]
        layout = layouts.get(layout_id)
        if not layout:
            continue
        conns = []
        for c in data.get("connections") or []:
            # "MAP_ROUTE101" -> find map name
            target_id = c["map"]
            conns.append(
                {
                    "dir": c["direction"],
                    "target_id": target_id,
                    "offset": int(c.get("offset") or 0),
                }
            )
        maps[name] = {
            "name": name,
            "id": data["id"],
            "layout": layout,
            "connections_raw": conns,
            "map_type": data.get("map_type", ""),
            "path": mj.parent,
        }
        sizes[name] = (int(layout["width"]), int(layout["height"]))

    id_to_name = {m["id"]: n for n, m in maps.items()}
    for name, m in maps.items():
        m["connections"] = []
        for c in m["connections_raw"]:
            tname = id_to_name.get(c["target_id"])
            if not tname:
                continue
            # FireRed uses SaffronCity_Connection as a stub — prefer real town
            if tname.endswith("_Connection"):
                real = tname[: -len("_Connection")]
                if real in maps:
                    tname = real
            d = c["dir"]
            if d in ("dive", "emerge"):
                continue
            m["connections"].append(
                {"dir": d, "target": tname, "offset": c["offset"]}
            )

    # Drop stub connection maps when the real map exists
    stub_names = [
        n
        for n in list(maps)
        if n.endswith("_Connection") and n[: -len("_Connection")] in maps
    ]
    for n in stub_names:
        del maps[n]
        sizes.pop(n, None)

    return maps, sizes


def render_layout(root: Path, layout: dict, cache: dict) -> Image.Image:
    w, h = int(layout["width"]), int(layout["height"])
    prim_key = layout["primary_tileset"]
    sec_key = layout["secondary_tileset"]
    if prim_key not in cache:
        cache[prim_key] = load_tileset(resolve_tileset_path(root, prim_key))
    if sec_key not in cache:
        cache[sec_key] = load_tileset(resolve_tileset_path(root, sec_key))
    prim, sec = cache[prim_key], cache[sec_key]

    block_path = root / layout["blockdata_filepath"]
    data = block_path.read_bytes()
    img = Image.new("RGBA", (w * META_PX, h * META_PX), (0, 0, 0, 0))
    for i in range(w * h):
        if i * 2 + 2 > len(data):
            break
        mid = struct.unpack_from("<H", data, i * 2)[0]
        mt = render_metatile(prim, sec, mid)
        img.paste(mt, ((i % w) * META_PX, (i // w) * META_PX), mt)
    return img


OUTDOOR_TYPES = {
    "MAP_TYPE_TOWN",
    "MAP_TYPE_CITY",
    "MAP_TYPE_ROUTE",
    "MAP_TYPE_OCEAN_ROUTE",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--meta", type=Path, required=True)
    ap.add_argument("--start", required=True)
    ap.add_argument("--source-label", default="pret gen3")
    ap.add_argument("--scale", type=int, default=1)
    ap.add_argument(
        "--outdoor-only",
        action="store_true",
        default=True,
        help="only stitch maps reachable from start (connections)",
    )
    args = ap.parse_args()
    root = args.root.resolve()

    maps, sizes = load_all_maps(root)
    if args.start not in maps:
        raise SystemExit(f"start missing: {args.start}")

    # Keep outdoor maps + anything reachable; drop underwater islands
    outdoor_ok = set()
    for name, m in maps.items():
        mt = m.get("map_type") or ""
        if mt in OUTDOOR_TYPES or name == args.start:
            outdoor_ok.add(name)
        if "UNDERWATER" in mt or "underwater" in name.lower():
            continue
        outdoor_ok.add(name)

    # prune underwater
    for name in list(maps):
        mt = maps[name].get("map_type") or ""
        if "UNDERWATER" in mt or name.lower().startswith("underwater"):
            del maps[name]
            sizes.pop(name, None)
            continue
        # strip dive targets already done; also drop conns to removed maps
        maps[name]["connections"] = [
            c for c in maps[name]["connections"] if c["target"] in maps
        ]

    stitch_maps = {n: {"connections": maps[n]["connections"]} for n in maps}
    placed = normalize_placed(stitch_place(stitch_maps, sizes, args.start))

    # filter to outdoor-ish if desired (keep whatever was placed via connections)
    max_x = max(placed[k][0] + sizes[k][0] for k in placed)
    max_y = max(placed[k][1] + sizes[k][1] for k in placed)

    canvas = Image.new("RGBA", (max_x * META_PX, max_y * META_PX), (40, 90, 160, 255))
    cache = {}
    regions = []
    for name, (bx, by) in sorted(placed.items(), key=lambda kv: (kv[1][1], kv[1][0])):
        layout = maps[name]["layout"]
        try:
            rendered = render_layout(root, layout, cache)
        except Exception as e:
            print(f"  skip {name}: {e}")
            continue
        canvas.paste(rendered, (bx * META_PX, by * META_PX), rendered)
        w, h = sizes[name]
        regions.append(
            {
                "id": name,
                "block_x": bx,
                "block_y": by,
                "width_blocks": w,
                "height_blocks": h,
                "pixel_x": bx * META_PX,
                "pixel_y": by * META_PX,
                "pixel_w": w * META_PX,
                "pixel_h": h * META_PX,
            }
        )
        print(f"  {name} @ ({bx},{by})")

    scale = max(1, args.scale)
    if scale != 1:
        canvas = canvas.resize(
            (canvas.width * scale, canvas.height * scale), Image.Resampling.NEAREST
        )
        for r in regions:
            for k in ("pixel_x", "pixel_y", "pixel_w", "pixel_h"):
                r[k] *= scale

    args.out.parent.mkdir(parents=True, exist_ok=True)
    bg = Image.new("RGB", canvas.size, (40, 90, 160))
    bg.paste(canvas, mask=canvas.split()[3])
    bg.save(args.out, optimize=True)
    meta = {
        "source": args.source_label,
        "scale": scale,
        "width": bg.size[0],
        "height": bg.size[1],
        "maps": regions,
    }
    args.meta.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {args.out} {bg.size} maps={len(regions)}")


if __name__ == "__main__":
    main()
