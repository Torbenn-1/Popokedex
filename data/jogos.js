import {
  JOGO_DEX_IDS,
  JOGO_DEXES,
  ids_do_jogo,
  dexes_do_jogo,
  dex_do_jogo,
} from "./jogo_dex_ids.js";

/** teto do dex nacional por geração (species id) — fallback se não houver lista do jogo */
export const DEX_CAP = {
  1: 151,
  2: 251,
  3: 386,
  4: 493,
  5: 649,
  6: 721,
  7: 809,
  8: 905,
  9: 1025,
};

export { JOGO_DEX_IDS, JOGO_DEXES, ids_do_jogo, dexes_do_jogo, dex_do_jogo };

const _sets = new Map();

function cache_key(jogo, dex) {
  return dex ? `${jogo}::${dex}` : jogo;
}

/** national_* / *_other — não entram na “dex original” do jogo */
export function dex_eh_nacional(dexEntry) {
  const s = dexEntry?.slug || "";
  return s.startsWith("national_") || s.endsWith("_other");
}

export function dexes_regionais_do_jogo(slug) {
  return dexes_do_jogo(slug).filter((d) => !dex_eh_nacional(d));
}

/** Set de species IDs — jogo inteiro, dex específica, ou só regionais. null = sem filtro. */
export function set_ids_do_jogo(slug, dexSlug = "") {
  if (!slug) return null;
  const key = cache_key(slug, dexSlug || "__all__");
  if (_sets.has(key)) return _sets.get(key);
  let ids = null;
  if (dexSlug === "__regional__") {
    ids = [];
    const seen = new Set();
    for (const d of dexes_regionais_do_jogo(slug)) {
      for (const id of d.ids) {
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
  } else if (dexSlug) {
    ids = dex_do_jogo(slug, dexSlug)?.ids || null;
  } else {
    ids = ids_do_jogo(slug);
  }
  const set = ids ? new Set(ids) : null;
  _sets.set(key, set);
  return set;
}

/** teto nacional da geração do jogo (gen atual + tudo pra trás) */
export function cap_nacional_do_jogo(slug) {
  const j = jogo_por_slug(slug);
  return DEX_CAP[j?.gen] || DEX_CAP[9];
}

export function set_ids_nacional_gen(slug) {
  if (!slug) return null;
  const key = cache_key(slug, "__national_gen__");
  if (_sets.has(key)) return _sets.get(key);
  const cap = cap_nacional_do_jogo(slug);
  const set = new Set();
  for (let i = 1; i <= cap; i++) set.add(i);
  _sets.set(key, set);
  return set;
}

/** true se o species id entra na dex do jogo (ou se não há lista). */
export function pokemon_no_jogo(slug, id, dexSlug = "") {
  const set = set_ids_do_jogo(slug, dexSlug);
  if (!set) return true;
  return set.has(Number(id));
}

function lang_curto() {
  try {
    const v = localStorage.getItem("caraio_lang");
    if (v === "en" || v === "ja" || v === "pt") return v;
  } catch (_) {}
  return "pt";
}

/** rótulo localizado da variação de Pokédex */
export function nome_da_dex(dexEntry) {
  if (!dexEntry?.name) return dexEntry?.slug || "";
  const lang = lang_curto();
  return dexEntry.name[lang] || dexEntry.name.en || dexEntry.slug;
}

/** mapa id → nº regional (1-based) pra ordenar/exibir */
export function mapa_ordem_dex(jogoSlug, dexSlug) {
  if (!dexSlug || dexSlug === "__regional__") {
    return mapa_ordem_regionais(jogoSlug);
  }
  const d = dex_do_jogo(jogoSlug, dexSlug);
  if (!d?.ids?.length) return null;
  const map = new Map();
  d.ids.forEach((id, i) => map.set(id, i + 1));
  return map;
}

/** ordem concatenada de todas as dexes regionais do jogo */
export function mapa_ordem_regionais(jogoSlug) {
  const map = new Map();
  let n = 1;
  for (const d of dexes_regionais_do_jogo(jogoSlug)) {
    for (const id of d.ids || []) {
      if (!map.has(id)) map.set(id, n++);
    }
  }
  return map.size ? map : null;
}

/** região introdutória de cada geração (filtro da dex) */
export const REGIOES = [
  { gen: 1, slug: "kanto", label: "Kanto" },
  { gen: 2, slug: "johto", label: "Johto" },
  { gen: 3, slug: "hoenn", label: "Hoenn" },
  { gen: 4, slug: "sinnoh", label: "Sinnoh" },
  { gen: 5, slug: "unova", label: "Unova" },
  { gen: 6, slug: "kalos", label: "Kalos" },
  { gen: 7, slug: "alola", label: "Alola" },
  { gen: 8, slug: "galar", label: "Galar" },
  { gen: 9, slug: "paldea", label: "Paldea" },
];

/** jogos / regiões pra planner + mapas (slugs PokéAPI) */
export const JOGOS = [
  {
    slug: "rby",
    name: "Red / Blue / Yellow",
    names: {
      en: "Red / Blue / Yellow",
      pt: "Red / Blue / Yellow",
      ja: "赤・緑・青・ピカチュウ",
    },
    gen: 1,
    region: "kanto",
    versions: ["red", "blue", "yellow"],
    version_groups: ["red-blue", "yellow"],
  },
  {
    slug: "gsc",
    name: "Gold / Silver / Crystal",
    names: {
      en: "Gold / Silver / Crystal",
      pt: "Gold / Silver / Crystal",
      ja: "金・銀・クリスタル",
    },
    gen: 2,
    region: "johto",
    versions: ["gold", "silver", "crystal"],
    version_groups: ["gold-silver", "crystal"],
  },
  {
    slug: "rse",
    name: "Ruby / Sapphire / Emerald",
    names: {
      en: "Ruby / Sapphire / Emerald",
      pt: "Ruby / Sapphire / Emerald",
      ja: "ルビー・サファイア・エメラルド",
    },
    gen: 3,
    region: "hoenn",
    versions: ["ruby", "sapphire", "emerald"],
    version_groups: ["ruby-sapphire", "emerald"],
  },
  {
    slug: "frlg",
    name: "FireRed / LeafGreen",
    names: {
      en: "FireRed / LeafGreen",
      pt: "FireRed / LeafGreen",
      ja: "ファイアレッド・リーフグリーン",
    },
    gen: 3,
    region: "kanto",
    versions: ["firered", "leafgreen"],
    version_groups: ["firered-leafgreen"],
  },
  {
    slug: "dppt",
    name: "Diamond / Pearl / Platinum",
    names: {
      en: "Diamond / Pearl / Platinum",
      pt: "Diamond / Pearl / Platinum",
      ja: "ダイヤモンド・パール・プラチナ",
    },
    gen: 4,
    region: "sinnoh",
    versions: ["diamond", "pearl", "platinum"],
    version_groups: ["diamond-pearl", "platinum"],
  },
  {
    slug: "hgss",
    name: "HeartGold / SoulSilver",
    names: {
      en: "HeartGold / SoulSilver",
      pt: "HeartGold / SoulSilver",
      ja: "ハートゴールド・ソウルシルバー",
    },
    gen: 4,
    region: "johto",
    versions: ["heartgold", "soulsilver"],
    version_groups: ["heartgold-soulsilver"],
  },
  {
    slug: "bw",
    name: "Black / White",
    names: {
      en: "Black / White",
      pt: "Black / White",
      ja: "ブラック・ホワイト",
    },
    gen: 5,
    region: "unova",
    versions: ["black", "white"],
    version_groups: ["black-white"],
  },
  {
    slug: "b2w2",
    name: "Black 2 / White 2",
    names: {
      en: "Black 2 / White 2",
      pt: "Black 2 / White 2",
      ja: "ブラック2・ホワイト2",
    },
    gen: 5,
    region: "unova",
    versions: ["black-2", "white-2"],
    version_groups: ["black-2-white-2"],
  },
  {
    slug: "xy",
    name: "X / Y",
    names: { en: "X / Y", pt: "X / Y", ja: "X・Y" },
    gen: 6,
    region: "kalos",
    versions: ["x", "y"],
    version_groups: ["x-y"],
  },
  {
    slug: "oras",
    name: "Omega Ruby / Alpha Sapphire",
    names: {
      en: "Omega Ruby / Alpha Sapphire",
      pt: "Omega Ruby / Alpha Sapphire",
      ja: "オメガルビー・アルファサファイア",
    },
    gen: 6,
    region: "hoenn",
    versions: ["omega-ruby", "alpha-sapphire"],
    version_groups: ["omega-ruby-alpha-sapphire"],
  },
  {
    slug: "sm",
    name: "Sun / Moon",
    names: {
      en: "Sun / Moon",
      pt: "Sun / Moon",
      ja: "サン・ムーン",
    },
    gen: 7,
    region: "alola",
    versions: ["sun", "moon"],
    version_groups: ["sun-moon"],
  },
  {
    slug: "usum",
    name: "Ultra Sun / Ultra Moon",
    names: {
      en: "Ultra Sun / Ultra Moon",
      pt: "Ultra Sun / Ultra Moon",
      ja: "ウルトラサン・ウルトラムーン",
    },
    gen: 7,
    region: "alola",
    versions: ["ultra-sun", "ultra-moon"],
    version_groups: ["ultra-sun-ultra-moon"],
  },
  {
    slug: "swsh",
    name: "Sword / Shield",
    names: {
      en: "Sword / Shield",
      pt: "Sword / Shield",
      ja: "ソード・シールド",
    },
    gen: 8,
    region: "galar",
    versions: ["sword", "shield"],
    version_groups: ["sword-shield"],
  },
  {
    slug: "bdsp",
    name: "Brilliant Diamond / Shining Pearl",
    names: {
      en: "Brilliant Diamond / Shining Pearl",
      pt: "Brilliant Diamond / Shining Pearl",
      ja: "ブリリアントダイヤモンド・シャイニングパール",
    },
    gen: 8,
    region: "sinnoh",
    versions: ["brilliant-diamond", "shining-pearl"],
    version_groups: ["brilliant-diamond-shining-pearl"],
  },
  {
    slug: "sv",
    name: "Scarlet / Violet",
    names: {
      en: "Scarlet / Violet",
      pt: "Scarlet / Violet",
      ja: "スカーレット・バイオレット",
    },
    gen: 9,
    region: "paldea",
    versions: ["scarlet", "violet"],
    version_groups: ["scarlet-violet"],
  },
];

export function jogo_por_slug(slug) {
  return JOGOS.find((j) => j.slug === slug) || null;
}

/** rótulo localizado do jogo (selects, displays, etc.) */
export function rotulo_jogo(slugOrJogo) {
  const j =
    typeof slugOrJogo === "string" ? jogo_por_slug(slugOrJogo) : slugOrJogo;
  if (!j) return typeof slugOrJogo === "string" ? slugOrJogo : "";
  const lang = lang_curto();
  return j.names?.[lang] || j.name || j.slug;
}

/** version-groups da PokéAPI pro movepool deste jogo */
export function version_groups_do_jogo(slug) {
  return jogo_por_slug(slug)?.version_groups || [];
}

export function dex_cap_do_jogo(slug) {
  const ids = ids_do_jogo(slug);
  if (ids?.length) return Math.max(...ids);
  const j = jogo_por_slug(slug);
  return DEX_CAP[j?.gen] || DEX_CAP[9];
}

export const TIPOS = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

/** nomes oficiais dos tipos (JA) / comuns (PT/EN) */
const TIPO_NOMES = {
  en: {
    normal: "Normal",
    fire: "Fire",
    water: "Water",
    electric: "Electric",
    grass: "Grass",
    ice: "Ice",
    fighting: "Fighting",
    poison: "Poison",
    ground: "Ground",
    flying: "Flying",
    psychic: "Psychic",
    bug: "Bug",
    rock: "Rock",
    ghost: "Ghost",
    dragon: "Dragon",
    dark: "Dark",
    steel: "Steel",
    fairy: "Fairy",
  },
  pt: {
    normal: "Normal",
    fire: "Fogo",
    water: "Água",
    electric: "Elétrico",
    grass: "Grama",
    ice: "Gelo",
    fighting: "Lutador",
    poison: "Venenoso",
    ground: "Terra",
    flying: "Voador",
    psychic: "Psíquico",
    bug: "Inseto",
    rock: "Pedra",
    ghost: "Fantasma",
    dragon: "Dragão",
    dark: "Sombrio",
    steel: "Aço",
    fairy: "Fada",
  },
  ja: {
    normal: "ノーマル",
    fire: "ほのお",
    water: "みず",
    electric: "でんき",
    grass: "くさ",
    ice: "こおり",
    fighting: "かくとう",
    poison: "どく",
    ground: "じめん",
    flying: "ひこう",
    psychic: "エスパー",
    bug: "むし",
    rock: "いわ",
    ghost: "ゴースト",
    dragon: "ドラゴン",
    dark: "あく",
    steel: "はがね",
    fairy: "フェアリー",
  },
};

export function rotulo_tipo(type) {
  const lang = lang_curto();
  const key = String(type || "").toLowerCase();
  return TIPO_NOMES[lang]?.[key] || TIPO_NOMES.en[key] || type;
}

/** chart gen6+ — quem ataca (row) vs defensor; multiplicador */
export const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
};

export function mult_ataque(atkType, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    m *= TYPE_CHART[atkType]?.[d] ?? 1;
  }
  return m;
}
