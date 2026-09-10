/** Gen 1 internal species index → pokeapi-ish slug (pret pokered). */
export const GEN1_SPECIES_SLUG = ["", "rhydon", "kangaskhan", "nidoran-m", "clefairy", "spearow", "voltorb", "nidoking", "slowbro", "ivysaur", "exeggutor", "lickitung", "exeggcute", "grimer", "gengar", "nidoran-f", "nidoqueen", "cubone", "rhyhorn", "lapras", "arcanine", "mew", "gyarados", "shellder", "tentacool", "gastly", "scyther", "staryu", "blastoise", "pinsir", "tangela", "", "", "growlithe", "onix", "fearow", "pidgey", "slowpoke", "kadabra", "graveler", "chansey", "machoke", "mr-mime", "hitmonlee", "hitmonchan", "arbok", "parasect", "psyduck", "drowzee", "golem", "", "magmar", "", "electabuzz", "magneton", "koffing", "", "mankey", "seel", "diglett", "tauros", "", "", "", "farfetchd", "venonat", "dragonite", "", "", "", "doduo", "poliwag", "jynx", "moltres", "articuno", "zapdos", "ditto", "meowth", "krabby", "", "", "", "vulpix", "ninetales", "pikachu", "raichu", "", "", "dratini", "dragonair", "kabuto", "kabutops", "horsea", "seadra", "", "", "sandshrew", "sandslash", "omanyte", "omastar", "jigglypuff", "wigglytuff", "eevee", "flareon", "jolteon", "vaporeon", "machop", "zubat", "ekans", "paras", "poliwhirl", "poliwrath", "weedle", "kakuna", "beedrill", "", "dodrio", "primeape", "dugtrio", "venomoth", "dewgong", "", "", "caterpie", "metapod", "butterfree", "machamp", "", "golduck", "hypno", "golbat", "mewtwo", "snorlax", "magikarp", "", "", "muk", "", "kingler", "cloyster", "", "electrode", "clefable", "weezing", "persian", "marowak", "", "haunter", "abra", "alakazam", "pidgeotto", "pidgeot", "starmie", "bulbasaur", "venusaur", "tentacruel", "", "goldeen", "seaking", "", "", "", "", "ponyta", "rapidash", "rattata", "raticate", "nidorino", "nidorina", "geodude", "porygon", "aerodactyl", "", "magnemite", "", "", "charmander", "squirtle", "charmeleon", "wartortle", "charizard", "", "fossil-kabutops", "fossil-aerodactyl", "mon-ghost", "oddish", "gloom", "vileplume", "bellsprout", "weepinbell", "victreebel"];

/** Ordem nacional Gen 1 — sprites PokeAPI usam estes IDs, não o índice interno RBY. */
const GEN1_NATIONAL_SLUGS = [
  "bulbasaur", "ivysaur", "venusaur", "charmander", "charmeleon", "charizard",
  "squirtle", "wartortle", "blastoise", "caterpie", "metapod", "butterfree",
  "weedle", "kakuna", "beedrill", "pidgey", "pidgeotto", "pidgeot", "rattata",
  "raticate", "spearow", "fearow", "ekans", "arbok", "pikachu", "raichu",
  "sandshrew", "sandslash", "nidoran-f", "nidorina", "nidoqueen", "nidoran-m",
  "nidorino", "nidoking", "clefairy", "clefable", "vulpix", "ninetales",
  "jigglypuff", "wigglytuff", "zubat", "golbat", "oddish", "gloom", "vileplume",
  "paras", "parasect", "venonat", "venomoth", "diglett", "dugtrio", "meowth",
  "persian", "psyduck", "golduck", "mankey", "primeape", "growlithe", "arcanine",
  "poliwag", "poliwhirl", "poliwrath", "abra", "kadabra", "alakazam", "machop",
  "machoke", "machamp", "bellsprout", "weepinbell", "victreebel", "tentacool",
  "tentacruel", "geodude", "graveler", "golem", "ponyta", "rapidash", "slowpoke",
  "slowbro", "magnemite", "magneton", "farfetchd", "doduo", "dodrio", "seel",
  "dewgong", "grimer", "muk", "shellder", "cloyster", "gastly", "haunter",
  "gengar", "onix", "drowzee", "hypno", "krabby", "kingler", "voltorb",
  "electrode", "exeggcute", "exeggutor", "cubone", "marowak", "hitmonlee",
  "hitmonchan", "lickitung", "koffing", "weezing", "rhyhorn", "rhydon",
  "chansey", "tangela", "kangaskhan", "horsea", "seadra", "goldeen", "seaking",
  "staryu", "starmie", "mr-mime", "scyther", "jynx", "electabuzz", "magmar",
  "pinsir", "tauros", "magikarp", "gyarados", "lapras", "ditto", "eevee",
  "vaporeon", "jolteon", "flareon", "porygon", "omanyte", "omastar", "kabuto",
  "kabutops", "aerodactyl", "snorlax", "articuno", "zapdos", "moltres",
  "dratini", "dragonair", "dragonite", "mewtwo", "mew",
];

const SLUG_TO_DEX = Object.fromEntries(
  GEN1_NATIONAL_SLUGS.map((slug, i) => [slug, i + 1])
);

/** Formas especiais do jogo → sprite aproximado. */
SLUG_TO_DEX["fossil-kabutops"] = 141;
SLUG_TO_DEX["fossil-aerodactyl"] = 142;
SLUG_TO_DEX["mon-ghost"] = 92;

export function gen1_slug(id) {
  return GEN1_SPECIES_SLUG[id & 0xff] || "";
}

/** Índice interno RBY → ID nacional (sprites). */
export function gen1_dex_id(id) {
  const slug = gen1_slug(id);
  return SLUG_TO_DEX[slug] || 0;
}

export function gen1_dex_from_slug(slug) {
  return SLUG_TO_DEX[slug] || 0;
}
