# Popokedex

Pokédex, mapas por jogo, montador de times. Editor de ROMs fica pra depois.

## Rodar local

```bash
cd ~/Documents/caraio-dex
python -m http.server 8765
```

Abre `http://localhost:8765/`.

Precisa de HTTP (ES modules + fetch). Grade/lista/times usam `data/dex_slim.json` (offline). Ficha detalhada e encontros ainda consultam a [PokéAPI](https://pokeapi.co/) (com cache + mirror).

Regenerar o dump slim (opcional):

```bash
python3 scripts/build_slim_dex.py
```

## GitHub Pages

Site estático — hospeda no próprio GitHub:

1. Cria um repo **novo** (não precisa ser fork).
2. Sobe os arquivos na branch `main` (ou `master`).
3. Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)`.
4. URL fica tipo `https://SEU_USER.github.io/popokedex/`.

O arquivo `.nojekyll` já está no repo pra o Pages não processar com Jekyll.

## O que tem

- **Pokédex** — ficha com stats, habilidades, golpes (filtro por método/versão), locais, grito e pegada; tema claro/escuro
- **Mapas** — overview CC0 por região + pins clicáveis; encontros da PokéAPI; link pro mapa detalhado do [PokéMaps](https://pokemaps.net/maps) (referência de UX)
- **Times** — 6 slots, pool limitado ao dex do jogo, análise de tipos, link na URL, arrastar pra reordenar
- **ROMs** — placeholder

Pegadas de veekun quando existirem. Pokémon é © Nintendo.

Inspirado no team planner do [richi3f](https://github.com/richi3f/pokemon-team-planner).
