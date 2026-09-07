#!/usr/bin/env python3
"""Build interactive map tiles + markers for RBY/GSC/FRLG/RSE (+ remake aliases)."""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from map_common import camel_to_kebab, cut_tiles, write_markers

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]):
    print("+", " ".join(cmd))
    subprocess.check_call(cmd, cwd=ROOT)


def match_for(region: str, map_id: str) -> list[str]:
    kebab = camel_to_kebab(map_id).replace("_", "-")
    # strip region prefixes sometimes present
    out = [kebab]
    m = re.match(r"route-?(\d+[a-z]?)$", kebab)
    if m:
        num = m.group(1)
        out.append(f"route-{num}")
        if region == "kanto":
            out.append(f"kanto-route-{num}")
        elif region == "johto":
            out.append(f"johto-route-{num}")
        elif region == "hoenn":
            out.append(f"hoenn-route-{num}")
    # FRLG splits
    if kebab.endswith("-north") or kebab.endswith("-south"):
        out.append(kebab.rsplit("-", 1)[0])
    # common alts
    alts = {
        "indigo-plateau": ["indigo-plateau"],
        "mt-moon": ["mt-moon"],
        "victory-road": ["victory-road"],
        "lake-of-rage": ["lake-of-rage"],
        "ruins-of-alph-outside": ["ruins-of-alph"],
        "whirl-islands": ["whirl-islands"],
        "mt-mortar": ["mt-mortar"],
        "ice-path": ["ice-path"],
        "dragons-den": ["dragons-den"],
        "national-park": ["national-park"],
        "seafoam": ["seafoam"],
        "safari-zone": ["safari-zone"],
        "power-plant": ["power-plant"],
        "pokemon-mansion": ["pokemon-mansion"],
        "pokemon-tower": ["pokemon-tower"],
        "digletts-cave": ["digletts-cave"],
        "cerulean-cave": ["cerulean-cave"],
        "viridian-forest": ["viridian-forest"],
        "battle-frontier": ["battle-frontier"],
        "underwater": ["underwater"],
    }
    for key, vals in alts.items():
        if key in kebab:
            out.extend(vals)
    # unique preserve order
    seen = set()
    uniq = []
    for x in out:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def write_alias(src_markers: Path, dest_game: str, dest_path: Path):
    data = json.loads(src_markers.read_text())
    data["game"] = dest_game
    data["aliasOf"] = data.get("aliasOf") or src_markers.stem.replace("_markers", "")
    dest_path.write_text(json.dumps(data, indent=2) + "\n")
    print(f"  alias {dest_path} -> {data['tiles']}")


def finish_pack(game: str, region: str, full_png: Path, meta_json: Path, aliases: list[str]):
    tiles_dir = ROOT / "assets" / "maps" / game / "tiles"
    # Cap zoom by size to keep repo sane
    w = json.loads(meta_json.read_text())["width"]
    h = json.loads(meta_json.read_text())["height"]
    max_dim = max(w, h)
    max_zoom = max(0, min(5, math.ceil(math.log2(max_dim / 256))))
    tj = cut_tiles(full_png, tiles_dir, max_zoom=max_zoom)
    meta = json.loads(meta_json.read_text())
    markers_path = ROOT / "data" / "maps" / f"{game}_markers.json"
    write_markers(
        markers_path,
        game=game,
        region=region,
        tilejson=tj,
        regions=meta["maps"],
        match_fn=lambda mid: match_for(region, mid),
        tiles_rel=f"assets/maps/{game}/tiles/{{z}}/{{x}}/{{y}}.png",
        image_rel=f"assets/maps/{game}/{full_png.name}",
        aliases=aliases or None,
    )
    for a in aliases:
        write_alias(markers_path, a, ROOT / "data" / "maps" / f"{a}_markers.json")


def build_rby(pokered: Path):
    run(
        [
            sys.executable,
            "scripts/render_rby_overworld.py",
            "--pokered",
            str(pokered),
            "--out",
            "assets/maps/rby/kanto_full.png",
            "--meta",
            "assets/maps/rby/kanto_meta.json",
            "--scale",
            "1",
        ]
    )
    finish_pack("rby", "kanto", ROOT / "assets/maps/rby/kanto_full.png", ROOT / "assets/maps/rby/kanto_meta.json", [])


def build_gsc(crystal: Path):
    run(
        [
            sys.executable,
            "scripts/render_crystal_overworld.py",
            "--root",
            str(crystal),
            "--out",
            "assets/maps/gsc/world_full.png",
            "--meta",
            "assets/maps/gsc/world_meta.json",
            "--start",
            "NewBarkTown",
        ]
    )
    finish_pack(
        "gsc",
        "johto",
        ROOT / "assets/maps/gsc/world_full.png",
        ROOT / "assets/maps/gsc/world_meta.json",
        ["hgss"],
    )


def build_rse(emerald: Path):
    run(
        [
            sys.executable,
            "scripts/render_gba_overworld.py",
            "--root",
            str(emerald),
            "--out",
            "assets/maps/rse/hoenn_full.png",
            "--meta",
            "assets/maps/rse/hoenn_meta.json",
            "--start",
            "LittlerootTown",
            "--source-label",
            "pret/pokeemerald overworld stitch",
        ]
    )
    finish_pack(
        "rse",
        "hoenn",
        ROOT / "assets/maps/rse/hoenn_full.png",
        ROOT / "assets/maps/rse/hoenn_meta.json",
        ["oras"],
    )


def build_frlg(firered: Path):
    run(
        [
            sys.executable,
            "scripts/render_gba_overworld.py",
            "--root",
            str(firered),
            "--out",
            "assets/maps/frlg/kanto_full.png",
            "--meta",
            "assets/maps/frlg/kanto_meta.json",
            "--start",
            "PalletTown",
            "--source-label",
            "pret/pokefirered overworld stitch",
        ]
    )
    finish_pack(
        "frlg",
        "kanto",
        ROOT / "assets/maps/frlg/kanto_full.png",
        ROOT / "assets/maps/frlg/kanto_meta.json",
        [],
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--only",
        nargs="*",
        default=["rby", "gsc", "frlg", "rse"],
        help="subset: rby gsc frlg rse",
    )
    ap.add_argument("--local", type=Path, default=ROOT / ".local")
    args = ap.parse_args()
    local = args.local
    wanted = set(args.only)

    if "rby" in wanted:
        print("=== RBY ===")
        build_rby(local / "pokered")
    if "gsc" in wanted:
        print("=== GSC ===")
        build_gsc(local / "pokecrystal")
    if "frlg" in wanted:
        print("=== FRLG ===")
        build_frlg(local / "pokefirered")
    if "rse" in wanted:
        print("=== RSE ===")
        build_rse(local / "pokeemerald")
    print("done")


if __name__ == "__main__":
    main()
