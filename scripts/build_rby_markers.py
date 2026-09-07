#!/usr/bin/env python3
"""Build data/maps/rby_markers.json from stitched meta + tilejson content transform."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

# pokered CamelCase label → PokéAPI location slug matches
MATCH_OVERRIDES = {
    "PalletTown": ["pallet-town"],
    "ViridianCity": ["viridian-city"],
    "PewterCity": ["pewter-city"],
    "CeruleanCity": ["cerulean-city"],
    "LavenderTown": ["lavender-town"],
    "VermilionCity": ["vermilion-city"],
    "CeladonCity": ["celadon-city"],
    "FuchsiaCity": ["fuchsia-city"],
    "CinnabarIsland": ["cinnabar-island"],
    "IndigoPlateau": ["indigo-plateau"],
    "SaffronCity": ["saffron-city"],
    "Route1": ["kanto-route-1", "route-1"],
    "Route2": ["kanto-route-2", "route-2"],
    "Route3": ["kanto-route-3", "route-3"],
    "Route4": ["kanto-route-4", "route-4"],
    "Route5": ["kanto-route-5", "route-5"],
    "Route6": ["kanto-route-6", "route-6"],
    "Route7": ["kanto-route-7", "route-7"],
    "Route8": ["kanto-route-8", "route-8"],
    "Route9": ["kanto-route-9", "route-9"],
    "Route10": ["kanto-route-10", "route-10"],
    "Route11": ["kanto-route-11", "route-11"],
    "Route12": ["kanto-route-12", "route-12"],
    "Route13": ["kanto-route-13", "route-13"],
    "Route14": ["kanto-route-14", "route-14"],
    "Route15": ["kanto-route-15", "route-15"],
    "Route16": ["kanto-route-16", "route-16"],
    "Route17": ["kanto-route-17", "route-17"],
    "Route18": ["kanto-route-18", "route-18"],
    "Route19": ["kanto-route-19", "route-19"],
    "Route20": ["kanto-route-20", "route-20"],
    "Route21": ["kanto-route-21", "route-21"],
    "Route22": ["kanto-route-22", "route-22"],
    "Route23": ["kanto-route-23", "route-23", "victory-road"],
    "Route24": ["kanto-route-24", "route-24"],
    "Route25": ["kanto-route-25", "route-25"],
}


def pretty_label(map_id: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", map_id)
    s = re.sub(r"(Route)(\d+)", r"\1 \2", s)
    return s


def default_match(map_id: str) -> list[str]:
    kebab = re.sub(r"([a-z])([A-Z])", r"\1-\2", map_id).lower()
    kebab = re.sub(r"(route)(\d+)", r"\1-\2", kebab)
    return [kebab]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta", type=Path, default=Path("assets/maps/rby/kanto_meta.json"))
    ap.add_argument("--tilejson", type=Path, default=Path("assets/maps/rby/tiles/tilejson.json"))
    ap.add_argument("--out", type=Path, default=Path("data/maps/rby_markers.json"))
    args = ap.parse_args()

    meta = json.loads(args.meta.read_text())
    tj = json.loads(args.tilejson.read_text())
    content = tj["content"]
    ox, oy = content["offsetX"], content["offsetY"]
    scale = content["scale"]

    markers = []
    for m in meta["maps"]:
        mid = m["id"]
        cx = m["pixel_x"] + m["pixel_w"] / 2
        cy = m["pixel_y"] + m["pixel_h"] / 2
        wx = ox + cx * scale
        wy = oy + cy * scale
        markers.append(
            {
                "id": mid.lower(),
                "label": pretty_label(mid),
                "match": MATCH_OVERRIDES.get(mid, default_match(mid)),
                "x": round(wx, 2),
                "y": round(wy, 2),
                "image_x": round(cx, 2),
                "image_y": round(cy, 2),
                "map": mid,
            }
        )

    markers.sort(key=lambda m: m["label"])
    payload = {
        "game": "rby",
        "region": "kanto",
        "maxZoom": tj["maxZoom"],
        "worldSize": tj["worldSize"],
        "tileSize": tj["tileSize"],
        "tiles": "assets/maps/rby/tiles/{z}/{x}/{y}.png",
        "markers": markers,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({len(markers)} markers)")


if __name__ == "__main__":
    main()
