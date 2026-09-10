#!/usr/bin/env node
/**
 * Gera data/jogo_dex_ids.js a partir das dexes do richi3f team planner
 * (../pokemon-team-planner/static/js/{games,dexes}.js).
 *
 * Inclui a união por jogo + cada variação de Pokédex (ex.: Kalos Costeira).
 */
import dex from "../../pokemon-team-planner/static/js/dexes.js";
import games from "../../pokemon-team-planner/static/js/games.js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUR = [
  "rby",
  "gsc",
  "rse",
  "frlg",
  "dppt",
  "hgss",
  "bw",
  "b2w2",
  "xy",
  "oras",
  "sm",
  "usum",
  "swsh",
  "bdsp",
  "sv",
];

/** nomes PT por slug da dex do planner */
const NAME_PT = {
  kanto: "Pokédex de Kanto",
  johto: "Nova Pokédex",
  hoenn: "Pokédex de Hoenn",
  national_rse: "Pokédex Nacional",
  national_frlg: "Pokédex Nacional",
  sinnoh: "Pokédex de Sinnoh",
  sinnoh_pt: "Expansão Platinum",
  national_dppt: "Pokédex Nacional",
  johto_hgss: "Pokédex de Johto",
  national_hgss: "Pokédex Nacional",
  unova: "Pokédex de Unova",
  white_forest: "Floresta Branca",
  national_bw: "Pokédex Nacional",
  unova_b2w2: "Nova Pokédex de Unova",
  national_b2w2: "Pokédex Nacional",
  kalos_central: "Pokédex de Kalos Central",
  kalos_coastal: "Pokédex de Kalos Costeira",
  kalos_mountain: "Pokédex de Kalos Montanha",
  national_xy: "Pokédex Nacional",
  hoenn_oras: "Pokédex de Hoenn",
  national_oras: "Pokédex Nacional",
  alola: "Pokédex de Alola",
  alola_scan: "Pokémon do Island Scan",
  national_sm: "Outros Pokémon",
  alola_usum: "Pokédex de Alola",
  alola_scan_usum: "Pokémon do Island Scan",
  alola_wormhole_usum: "Pokémon do Ultra Wormhole",
  national_usum: "Outros Pokémon",
  galar: "Pokédex de Galar",
  galar_armor: "Pokédex da Ilha da Armadura",
  galar_crown: "Pokédex da Coroa da Tundra",
  galar_other: "Outros Pokémon",
  national_bdsp: "Pokédex Nacional",
  paldea: "Pokédex de Paldea",
  paldea_kitakami: "Pokédex de Kitakami",
  paldea_blueberry: "Pokédex Blueberry",
  paldea_other: "Outros Pokémon",
};

/** ordem regional preservada; base_id único na 1ª ocorrência */
function orderedBaseIds(dexSlug) {
  const d = dex[dexSlug];
  if (!d?.order) return [];
  const out = [];
  const seen = new Set();
  const keys = Object.keys(d.order).sort((a, b) => Number(a) - Number(b));
  for (const k of keys) {
    for (const pair of d.order[k]) {
      const id = Number(Array.isArray(pair) ? pair[0] : pair);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

const JOGO_DEXES = {};
const JOGO_DEX_IDS = {};

for (const slug of OUR) {
  const g = games[slug];
  if (!g) {
    console.warn("missing game", slug);
    continue;
  }
  const dexes = [];
  const union = new Set();
  for (const ds of g.dex_slugs || []) {
    const ids = orderedBaseIds(ds);
    const en = dex[ds]?.name || ds;
    dexes.push({
      slug: ds,
      name: { en, pt: NAME_PT[ds] || en },
      ids,
    });
    for (const id of ids) union.add(id);
    console.log(slug, ds, ids.length, NAME_PT[ds] || en);
  }
  JOGO_DEXES[slug] = dexes;
  JOGO_DEX_IDS[slug] = [...union].sort((a, b) => a - b);
}

const js = `/** Dexes por jogo (richi3f team planner). Auto-gerado: scripts/build_jogo_dex_ids.mjs */
export const JOGO_DEXES = ${JSON.stringify(JOGO_DEXES)};

/** União de species IDs por jogo (todas as dexes). */
export const JOGO_DEX_IDS = ${JSON.stringify(JOGO_DEX_IDS)};

export function ids_do_jogo(slug) {
  return JOGO_DEX_IDS[slug] || null;
}

export function dexes_do_jogo(slug) {
  return JOGO_DEXES[slug] || [];
}

export function dex_do_jogo(jogoSlug, dexSlug) {
  return (JOGO_DEXES[jogoSlug] || []).find((d) => d.slug === dexSlug) || null;
}
`;
writeFileSync(join(root, "data/jogo_dex_ids.js"), js);
console.log("wrote data/jogo_dex_ids.js");
