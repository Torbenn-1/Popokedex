/** teto do dex nacional por geração (species id) */
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
    gen: 1,
    region: "kanto",
    versions: ["red", "blue", "yellow"],
  },
  {
    slug: "gsc",
    name: "Gold / Silver / Crystal",
    gen: 2,
    region: "johto",
    versions: ["gold", "silver", "crystal"],
  },
  {
    slug: "rse",
    name: "Ruby / Sapphire / Emerald",
    gen: 3,
    region: "hoenn",
    versions: ["ruby", "sapphire", "emerald"],
  },
  {
    slug: "frlg",
    name: "FireRed / LeafGreen",
    gen: 3,
    region: "kanto",
    versions: ["firered", "leafgreen"],
  },
  {
    slug: "dppt",
    name: "Diamond / Pearl / Platinum",
    gen: 4,
    region: "sinnoh",
    versions: ["diamond", "pearl", "platinum"],
  },
  {
    slug: "hgss",
    name: "HeartGold / SoulSilver",
    gen: 4,
    region: "johto",
    versions: ["heartgold", "soulsilver"],
  },
  {
    slug: "bw",
    name: "Black / White",
    gen: 5,
    region: "unova",
    versions: ["black", "white"],
  },
  {
    slug: "b2w2",
    name: "Black 2 / White 2",
    gen: 5,
    region: "unova",
    versions: ["black-2", "white-2"],
  },
  {
    slug: "xy",
    name: "X / Y",
    gen: 6,
    region: "kalos",
    versions: ["x", "y"],
  },
  {
    slug: "oras",
    name: "Omega Ruby / Alpha Sapphire",
    gen: 6,
    region: "hoenn",
    versions: ["omega-ruby", "alpha-sapphire"],
  },
  {
    slug: "sm",
    name: "Sun / Moon",
    gen: 7,
    region: "alola",
    versions: ["sun", "moon"],
  },
  {
    slug: "usum",
    name: "Ultra Sun / Ultra Moon",
    gen: 7,
    region: "alola",
    versions: ["ultra-sun", "ultra-moon"],
  },
  {
    slug: "swsh",
    name: "Sword / Shield",
    gen: 8,
    region: "galar",
    versions: ["sword", "shield"],
  },
  {
    slug: "bdsp",
    name: "Brilliant Diamond / Shining Pearl",
    gen: 8,
    region: "sinnoh",
    versions: ["brilliant-diamond", "shining-pearl"],
  },
  {
    slug: "sv",
    name: "Scarlet / Violet",
    gen: 9,
    region: "paldea",
    versions: ["scarlet", "violet"],
  },
];

export function jogo_por_slug(slug) {
  return JOGOS.find((j) => j.slug === slug) || null;
}

export function dex_cap_do_jogo(slug) {
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
