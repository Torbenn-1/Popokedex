#!/usr/bin/env python3
"""Rebuild marker JSON from existing *_meta.json without re-tiling."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_all_interactive_maps import match_for, write_alias
from map_common import write_markers

ROOT = Path(__file__).resolve().parents[1]

PACKS = [
    ("rby", "kanto", "kanto_full.png", []),
    ("gsc", "johto", "world_full.png", ["hgss"]),
    ("frlg", "kanto", "kanto_full.png", []),
    ("rse", "hoenn", "hoenn_full.png", ["oras"]),
]


def main():
    for game, region, png_name, aliases in PACKS:
        meta_path = ROOT / "assets" / "maps" / game / f"{png_name.replace('_full.png', '_meta.json').replace('world_full', 'world_meta').replace('kanto_full', 'kanto_meta').replace('hoenn_full', 'hoenn_meta')}"
        # explicit meta names
        meta_map = {
            "rby": "kanto_meta.json",
            "gsc": "world_meta.json",
            "frlg": "kanto_meta.json",
            "rse": "hoenn_meta.json",
        }
        meta_path = ROOT / "assets" / "maps" / game / meta_map[game]
        meta = json.loads(meta_path.read_text())
        tj = {
            "imageWidth": meta["width"],
            "imageHeight": meta["height"],
        }
        out = ROOT / "data" / "maps" / f"{game}_markers.json"
        write_markers(
            out,
            game=game,
            region=region,
            tilejson=tj,
            regions=meta["maps"],
            match_fn=lambda mid, r=region: match_for(r, mid),
            tiles_rel=f"assets/maps/{game}/tiles/{{z}}/{{x}}/{{y}}.png",
            image_rel=f"assets/maps/{game}/{png_name}",
            aliases=aliases or None,
        )
        for a in aliases:
            write_alias(out, a, ROOT / "data" / "maps" / f"{a}_markers.json")


if __name__ == "__main__":
    main()
