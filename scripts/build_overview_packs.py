#!/usr/bin/env python3
"""Build Leaflet overview packs from CC0 region art + mapa_pins percentages."""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PINS_JS = ROOT / "data" / "mapa_pins.js"
OUT = ROOT / "data" / "maps"

# game slug → region pack id (file overview_{region}_markers.json, aliased per game)
GAME_REGION = {
    "dppt": "sinnoh",
    "bdsp": "sinnoh",
    "bw": "unova",
    "b2w2": "unova",
    "xy": "kalos",
    "sm": "alola",
    "usum": "alola",
    "sv": "paldea",
    "swsh": "galar",
}


def parse_pins_js(text: str) -> dict:
    """Rough extract of MAPA_POR_REGIAO entries with image + pins."""
    regions = {}
    # split by top-level region keys
    for m in re.finditer(
        r"(\w+):\s*\{\s*image:\s*(null|\"([^\"]+)\")\s*,.*?pins:\s*\[(.*?)\]\s*,?\s*\}",
        text,
        re.S,
    ):
        region = m.group(1)
        if region in ("MAPA_POR_REGIAO",):
            continue
        img = None if m.group(2) == "null" else m.group(3)
        pins_blob = m.group(4)
        pins = []
        for pm in re.finditer(
            r"\{\s*id:\s*\"([^\"]+)\"\s*,\s*label:\s*\"([^\"]+)\"\s*,\s*match:\s*\[([^\]]*)\]\s*,\s*x:\s*([\d.]+)\s*,\s*y:\s*([\d.]+)\s*\}",
            pins_blob,
        ):
            match_raw = pm.group(3)
            matches = re.findall(r"\"([^\"]+)\"", match_raw)
            pins.append(
                {
                    "id": pm.group(1),
                    "label": pm.group(2),
                    "match": matches,
                    "x_pct": float(pm.group(4)),
                    "y_pct": float(pm.group(5)),
                }
            )
        regions[region] = {"image": img, "pins": pins}
    return regions


def main():
    regions = parse_pins_js(PINS_JS.read_text(encoding="utf-8"))
    print("parsed regions:", list(regions))

    # Build one pack per region that has art
    region_packs = {}
    for region, meta in regions.items():
        if not meta["image"] or not meta["pins"]:
            print(f"  skip {region}: no art/pins")
            continue
        img_path = ROOT / "assets" / "maps" / meta["image"]
        if not img_path.exists():
            print(f"  skip {region}: missing {img_path}")
            continue
        with Image.open(img_path) as im:
            w, h = im.size
        markers = []
        for p in meta["pins"]:
            markers.append(
                {
                    "id": p["id"],
                    "label": p["label"],
                    "match": p["match"],
                    "x": round(p["x_pct"] / 100.0 * w, 2),
                    "y": round(p["y_pct"] / 100.0 * h, 2),
                    "map": p["id"],
                }
            )
        pack = {
            "game": region,
            "region": region,
            "mode": "overview",
            "image": f"assets/maps/{meta['image']}",
            "imageWidth": w,
            "imageHeight": h,
            "minZoom": -2,
            "maxZoom": 2,
            "markers": markers,
        }
        region_packs[region] = pack
        out = OUT / f"overview_{region}_markers.json"
        out.write_text(json.dumps(pack, indent=2) + "\n")
        print(f"  wrote {out.name} ({len(markers)} pins, {w}x{h})")

    # Per-game aliases for titles without decomp stitch
    for game, region in GAME_REGION.items():
        base = region_packs.get(region)
        if not base:
            print(f"  no pack for game {game} ({region})")
            continue
        pack = dict(base)
        pack["game"] = game
        pack["aliasOf"] = f"overview_{region}"
        out = OUT / f"{game}_markers.json"
        # never clobber Gen1–3 decomp packs
        if out.exists():
            existing = json.loads(out.read_text())
            if existing.get("mode") != "overview":
                print(f"  keep existing {out.name}")
                continue
        out.write_text(json.dumps(pack, indent=2) + "\n")
        print(f"  wrote {out.name}")


if __name__ == "__main__":
    main()
