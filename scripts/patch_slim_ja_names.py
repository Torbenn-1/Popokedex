#!/usr/bin/env python3
"""Injeta nomes japoneses (ja + ja-roma) em data/dex_slim.json via mirror PokeAPI."""

from __future__ import annotations

import json
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SLIM = ROOT / "data" / "dex_slim.json"
MIRROR = "https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2"
UA = "caraio-dex-ja-names/1.0"
WORKERS = 10
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
            time.sleep(0.35 * (2**i))
    raise RuntimeError(f"fail {url}: {last}")


def pick(entries, *langs: str, field: str = "name") -> str:
    by = {e.get("language", {}).get("name"): e for e in entries or []}
    for lang in langs:
        hit = by.get(lang)
        if hit:
            return (hit.get(field) or hit.get("name") or "").strip()
    return ""


def fetch_names(pid: int) -> tuple[int, dict]:
    sp = get_json(f"pokemon-species/{pid}")
    names = sp.get("names", [])
    genera = [{"language": g["language"], "name": g.get("genus", "")} for g in sp.get("genera", [])]
    return pid, {
        "ja": pick(names, "ja", "ja-hrkt", "en"),
        "ja_roma": pick(names, "ja-roma", "en"),
        "genus_ja": pick(genera, "ja", "ja-hrkt", "en"),
    }


def main() -> int:
    pack = json.loads(SLIM.read_text(encoding="utf-8"))
    mons = pack.get("pokemon") or []
    ids = [m["id"] for m in mons]
    print(f"patching ja names for {len(ids)} species…", flush=True)

    got: dict[int, dict] = {}
    done = 0
    errors = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {pool.submit(fetch_names, i): i for i in ids}
        for fut in as_completed(futs):
            pid = futs[fut]
            try:
                _, data = fut.result()
                got[pid] = data
            except Exception as e:  # noqa: BLE001
                errors += 1
                print(f"ERR #{pid}: {e}", flush=True)
            done += 1
            if done % 50 == 0 or done == len(ids):
                print(f"  {done}/{len(ids)} (errors={errors})", flush=True)

    missing = 0
    for m in mons:
        d = got.get(m["id"])
        if not d or not d["ja"]:
            missing += 1
            continue
        m.setdefault("name", {})
        m["name"]["ja"] = d["ja"]
        if d["ja_roma"]:
            m["name"]["ja-roma"] = d["ja_roma"]
        m.setdefault("genus", {})
        if d["genus_ja"]:
            m["genus"]["ja"] = d["genus_ja"]

    SLIM.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {SLIM} missing={missing} errors={errors}", flush=True)
    # sample
    for want in (25, 6, 168, 375, 389):
        hit = next((m for m in mons if m["id"] == want), None)
        if hit:
            print(f"  #{want} {hit['name'].get('en')} → {hit['name'].get('ja')} ({hit['name'].get('ja-roma')})")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
