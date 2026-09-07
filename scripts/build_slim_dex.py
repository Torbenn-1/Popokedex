#!/usr/bin/env python3
"""Gera data/dex_slim.json a partir do mirror PokeAPI/api-data (GitHub).

Uso:
  python3 scripts/build_slim_dex.py

Saída: data/dex_slim.json — índice leve pra grade/lista offline.
"""

from __future__ import annotations

import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "dex_slim.json"
MIRROR = "https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2"
UA = "caraio-dex-slim-builder/1.0"
LIMIT = 1025
WORKERS = 8

GEN_MAP = {
    "generation-i": 1,
    "generation-ii": 2,
    "generation-iii": 3,
    "generation-iv": 4,
    "generation-v": 5,
    "generation-vi": 6,
    "generation-vii": 7,
    "generation-viii": 8,
    "generation-ix": 9,
}

CTX = ssl.create_default_context()


def get_json(path: str, tries: int = 4):
    url = f"{MIRROR}/{path}/index.json"
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, context=CTX, timeout=40) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(0.4 * (2**i))
    raise RuntimeError(f"fail {url}: {last}")


def pick_name(entries, lang: str, field: str = "name") -> str:
    want = next((e for e in entries if e.get("language", {}).get("name") == lang), None)
    en = next((e for e in entries if e.get("language", {}).get("name") == "en"), None)
    hit = want or en
    if not hit:
        return ""
    return hit.get(field) or hit.get("name") or ""


def slim_one(pid: int) -> dict:
    mon = get_json(f"pokemon/{pid}")
    sp = get_json(f"pokemon-species/{pid}")
    stats = {s["stat"]["name"]: s["base_stat"] for s in mon.get("stats", [])}
    types = [t["type"]["name"] for t in sorted(mon.get("types", []), key=lambda x: x["slot"])]
    gen_name = (sp.get("generation") or {}).get("name") or ""
    genera = [
        {"language": g["language"], "name": g.get("genus", "")}
        for g in sp.get("genera", [])
    ]
    return {
        "id": pid,
        "slug": mon.get("name") or sp.get("name"),
        "name": {
            "en": pick_name(sp.get("names", []), "en"),
            "pt": pick_name(sp.get("names", []), "pt-BR")
            or pick_name(sp.get("names", []), "pt-br")
            or pick_name(sp.get("names", []), "en"),
        },
        "types": types,
        "stats": {
            "hp": stats.get("hp", 0),
            "attack": stats.get("attack", 0),
            "defense": stats.get("defense", 0),
            "special-attack": stats.get("special-attack", 0),
            "special-defense": stats.get("special-defense", 0),
            "speed": stats.get("speed", 0),
        },
        "gen": GEN_MAP.get(gen_name, 0),
        "genus": {
            "en": pick_name(genera, "en"),
            "pt": pick_name(genera, "pt-BR")
            or pick_name(genera, "pt-br")
            or pick_name(genera, "en"),
        },
    }


def main() -> int:
    print(f"building slim dex 1..{LIMIT} → {OUT}", flush=True)
    rows: list[dict | None] = [None] * LIMIT
    done = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {pool.submit(slim_one, i): i for i in range(1, LIMIT + 1)}
        for fut in as_completed(futs):
            pid = futs[fut]
            try:
                rows[pid - 1] = fut.result()
            except Exception as e:  # noqa: BLE001
                errors += 1
                print(f"ERR #{pid}: {e}", flush=True)
            done += 1
            if done % 50 == 0 or done == LIMIT:
                print(f"  {done}/{LIMIT} (errors={errors})", flush=True)

    if any(r is None for r in rows):
        missing = [i + 1 for i, r in enumerate(rows) if r is None]
        print(f"missing {len(missing)} ids, retrying…", flush=True)
        for pid in missing:
            rows[pid - 1] = slim_one(pid)

    payload = {
        "version": 1,
        "source": "PokeAPI/api-data mirror",
        "count": len(rows),
        "pokemon": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"ok → {OUT} ({size/1024:.1f} KB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
