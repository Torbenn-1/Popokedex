import { api_lang_tag } from "./i18n.js";

const BASE = "https://pokeapi.co/api/v2";
/** mirror estático no GitHub — sem rate limit do pokeapi.co */
const MIRROR =
  "https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2";
const CACHE_PREFIX = "caraio_cache_v1:";
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // 2 semanas
const MAX_INFLIGHT = 5;
const MAX_RETRY = 4;

function caraioo_de_asa(key, valor) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ t: Date.now(), v: valor })
    );
  } catch (_) {
    // storage cheio: tenta liberar caches velhos
    try {
      limpa_cache_velho();
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ t: Date.now(), v: valor })
      );
    } catch (_) {
      /* foda-se */
    }
  }
}

function limpa_cache_velho() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  // apaga metade mais antiga
  const packs = keys
    .map((k) => {
      try {
        const p = JSON.parse(localStorage.getItem(k));
        return { k, t: p?.t || 0 };
      } catch (_) {
        return { k, t: 0 };
      }
    })
    .sort((a, b) => a.t - b.t);
  const cut = Math.ceil(packs.length / 2);
  for (let i = 0; i < cut; i++) localStorage.removeItem(packs[i].k);
}

function pega_do_bolso(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const pack = JSON.parse(raw);
    if (Date.now() - pack.t > TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return pack.v;
  } catch (_) {
    return null;
  }
}

let inflight = 0;
const fila = [];

function dorme(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function enfileira(fn) {
  return new Promise((resolve, reject) => {
    fila.push({ fn, resolve, reject });
    drena_fila();
  });
}

function drena_fila() {
  while (inflight < MAX_INFLIGHT && fila.length) {
    const job = fila.shift();
    inflight++;
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .finally(() => {
        inflight--;
        drena_fila();
      });
  }
}

function path_pra_mirror(key) {
  // pokemon/25 → pokemon/25/index.json
  const clean = key.replace(/\/$/, "").replace(/\?.*$/, "");
  if (clean.includes("?")) {
    // listagens com query não batem 1:1 no mirror; só paths simples
    return null;
  }
  return `${MIRROR}/${clean}/index.json`;
}

async function fetch_json(url, attempt = 0) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRY) throw new Error(`HTTP ${res.status} @ ${url}`);
    const ra = Number(res.headers.get("Retry-After"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800 * 2 ** attempt;
    await dorme(wait);
    return fetch_json(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.json();
}

/** fetch + cache + fila + retry. nome interno: buceta */
export async function buceta(path) {
  const key = path.replace(/^\//, "");
  const hit = pega_do_bolso(key);
  if (hit != null) return hit;

  return enfileira(async () => {
    // double-check cache (outro job pode ter preenchido)
    const again = pega_do_bolso(key);
    if (again != null) return again;

    const primary = path.startsWith("http") ? path : `${BASE}/${key}`;
    try {
      const data = await fetch_json(primary);
      caraioo_de_asa(key, data);
      return data;
    } catch (err) {
      // fallback: mirror estático do PokeAPI/api-data
      const mir = !path.startsWith("http") ? path_pra_mirror(key) : null;
      if (!mir) throw err;
      try {
        const data = await fetch_json(mir);
        caraioo_de_asa(key, data);
        return data;
      } catch (_) {
        throw err;
      }
    }
  });
}

/** roda promises em lotes (pra UI não estourar a API) */
export async function mapa_em_lotes(items, worker, tamanho = 4) {
  const out = [];
  for (let i = 0; i < items.length; i += tamanho) {
    const slice = items.slice(i, i + tamanho);
    const part = await Promise.all(slice.map(worker));
    out.push(...part);
  }
  return out;
}

export function nome_localizado(lista, fallback = "") {
  if (!Array.isArray(lista) || !lista.length) return fallback;
  const want = api_lang_tag();
  const hit =
    lista.find((n) => n.language?.name === want) ||
    lista.find((n) => n.language?.name === "en");
  return hit?.name || fallback;
}

export function flavor_localizado(entries) {
  if (!Array.isArray(entries) || !entries.length) return "";
  const want = api_lang_tag();
  const pool = entries.filter((e) => e.language?.name === want);
  const en = entries.filter((e) => e.language?.name === "en");
  const pick = (pool.length ? pool : en).at(-1);
  return (pick?.flavor_text || "").replace(/\f|\n|\r/g, " ");
}

export function efeito_localizado(entries) {
  if (!Array.isArray(entries) || !entries.length) return "";
  const want = api_lang_tag() === "pt-br" ? "en" : api_lang_tag();
  const hit =
    entries.find((e) => e.language?.name === "en") ||
    entries.find((e) => e.language?.name === want);
  return hit?.short_effect || hit?.effect || "";
}

export async function lista_species(limit = 1025) {
  return buceta(`pokemon-species?limit=${limit}`);
}

export async function pega_pokemon(idOuSlug) {
  return buceta(`pokemon/${idOuSlug}`);
}

export async function pega_species(idOuSlug) {
  return buceta(`pokemon-species/${idOuSlug}`);
}

export async function pega_form(idOuSlug) {
  return buceta(`pokemon-form/${idOuSlug}`);
}

/** rótulo curto da forma (A, B, Meadow, …) */
export function rotulo_forma(form) {
  const fn = form?.form_name || "";
  if (!fn) return "";
  if (fn === "exclamation") return "!";
  if (fn === "question") return "?";
  if (fn.length === 1) return fn.toUpperCase();
  return fn
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** detalhes das formas cosméticas (Unown, Vivillon, …) */
export async function carrega_formas(formSlugs) {
  if (!formSlugs?.length) return [];
  return mapa_em_lotes(
    formSlugs,
    async (slug) => {
      try {
        const f = await pega_form(slug);
        const label =
          rotulo_forma(f) ||
          nome_localizado(f.names, slug).replace(/^.*?\s/, "") ||
          slug;
        return {
          slug: f.name,
          form_name: f.form_name || "",
          label,
          is_default: !!f.is_default,
          sprites: {
            front: f.sprites?.front_default || "",
            shiny: f.sprites?.front_shiny || f.sprites?.front_default || "",
          },
        };
      } catch (_) {
        return null;
      }
    },
    6
  ).then((rows) => rows.filter(Boolean));
}

export async function pega_ability(idOuSlug) {
  return buceta(`ability/${idOuSlug}`);
}

export async function pega_move(idOuSlug) {
  return buceta(`move/${idOuSlug}`);
}

export async function pega_encontros(id) {
  return buceta(`pokemon/${id}/encounters`);
}

export async function pega_evo_chain(urlOuId) {
  if (typeof urlOuId === "string" && urlOuId.includes("http")) {
    const id = urlOuId.replace(/\/$/, "").split("/").pop();
    return buceta(`evolution-chain/${id}`);
  }
  return buceta(`evolution-chain/${urlOuId}`);
}

export async function pega_regiao(slug) {
  return buceta(`region/${slug}`);
}

export async function pega_location(slug) {
  return buceta(`location/${slug}`);
}

export async function pega_location_area(slug) {
  return buceta(`location-area/${slug}`);
}

export async function pega_type(slug) {
  return buceta(`type/${slug}`);
}

/** monta ficha gorda pra UI */
export async function caraioo_ficha(idOuSlug) {
  const mon = await pega_pokemon(idOuSlug);
  const sp = await pega_species(mon.species.name);

  const abilities = await mapa_em_lotes(
    mon.abilities,
    async (a) => {
      const ab = await pega_ability(a.ability.name);
      return {
        slug: a.ability.name,
        name: nome_localizado(ab.names, a.ability.name),
        hidden: a.is_hidden,
        effect: efeito_localizado(ab.effect_entries),
      };
    },
    3
  );

  let evo = null;
  if (sp.evolution_chain?.url) {
    try {
      evo = await pega_evo_chain(sp.evolution_chain.url);
    } catch (_) {
      evo = null;
    }
  }

  let encounters = [];
  try {
    encounters = await pega_encontros(mon.id);
  } catch (_) {
    encounters = [];
  }

  return {
    id: mon.id,
    slug: mon.name,
    name: nome_localizado(sp.names, mon.name),
    types: mon.types.map((t) => t.type.name),
    height: mon.height,
    weight: mon.weight,
    stats: Object.fromEntries(mon.stats.map((s) => [s.stat.name, s.base_stat])),
    sprites: {
      front:
        mon.sprites.other?.home?.front_default ||
        mon.sprites.other?.["official-artwork"]?.front_default ||
        mon.sprites.front_default,
      shiny:
        mon.sprites.other?.home?.front_shiny ||
        mon.sprites.other?.["official-artwork"]?.front_shiny ||
        mon.sprites.front_shiny,
      default: mon.sprites.front_default,
    },
    cries: mon.cries || {},
    flavor: flavor_localizado(sp.flavor_text_entries),
    genus: nome_localizado(
      (sp.genera || []).map((g) => ({ language: g.language, name: g.genus })),
      ""
    ),
    habitat: sp.habitat?.name || "",
    generation: sp.generation?.name || "",
    abilities,
    moves_raw: mon.moves,
    encounters,
    evo,
    species_id: sp.id,
    species_slug: sp.name,
    form_slugs: (mon.forms || []).map((f) => f.name),
    varieties: (sp.varieties || []).map((v) => ({
      slug: v.pokemon.name,
      is_default: !!v.is_default,
    })),
    sprites_all: {
      home: mon.sprites.other?.home?.front_default || "",
      home_shiny: mon.sprites.other?.home?.front_shiny || "",
      artwork: mon.sprites.other?.["official-artwork"]?.front_default || "",
      artwork_shiny: mon.sprites.other?.["official-artwork"]?.front_shiny || "",
      pixel: mon.sprites.front_default || "",
      pixel_shiny: mon.sprites.front_shiny || "",
    },
  };
}

export function footprint_url(speciesId) {
  return `https://veekun.com/dex/media/pokemon/footprints/${speciesId}.png`;
}

export function sprite_url(id, { shiny = false } = {}) {
  const base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  return shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
}

export function art3d_url(id, { shiny = false } = {}) {
  const base =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home";
  return shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
}

export function artwork_url(id, { shiny = false } = {}) {
  const base =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
  return shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
}

export function gen_from_species_url(genName) {
  const map = {
    "generation-i": 1,
    "generation-ii": 2,
    "generation-iii": 3,
    "generation-iv": 4,
    "generation-v": 5,
    "generation-vi": 6,
    "generation-vii": 7,
    "generation-viii": 8,
    "generation-ix": 9,
  };
  return map[genName] || 0;
}
