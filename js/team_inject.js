/** Shared: inject builder team into a Gen 1–5 .sav and download. */

import { t } from "./i18n.js";
import { jogo_por_slug } from "../data/jogos.js";
import { inspect_buffer } from "./save_inspect.js";
import {
  ensure_slim,
  write_party,
  download_bytes,
  patched_name,
} from "./save/write.js";
import { normaliza_moves } from "./team_moves.js";
import { normaliza_ivs, normaliza_evs } from "./team_stats.js";

export function team_gen(gameSlug) {
  return jogo_por_slug(gameSlug)?.gen || 0;
}

export function can_inject_team(gameSlug, team) {
  const gen = team_gen(gameSlug);
  return !!(team?.some(Boolean) && gen >= 1 && gen <= 5);
}

function mons_from_team(team) {
  return (team || []).filter(Boolean).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    nickname: p.name,
    shiny: !!p.shiny,
    nature: p.nature || "hardy",
    item: p.item || "",
    ivs: normaliza_ivs(p.ivs),
    evs: normaliza_evs(p.evs),
    moves: normaliza_moves(p.moves),
    level: 50,
  }));
}

/**
 * Inject current team into a user-picked save file.
 * @returns {Promise<boolean>} true if downloaded
 */
export async function inject_team_into_save_file(file, team, gameSlug) {
  if (!file) return false;
  const teamGen = team_gen(gameSlug);
  if (!(team || []).some(Boolean)) {
    alert(t("inject_need_team"));
    return false;
  }
  if (teamGen < 1 || teamGen > 5) {
    alert(t("inject_need_gen"));
    return false;
  }
  await ensure_slim();
  const buf = new Uint8Array(await file.arrayBuffer());
  const report = inspect_buffer(buf, { name: file.name, kindHint: "save" });
  const save = report.save;
  if (!save?.gen || save.gen < 1 || save.gen > 5) {
    alert(t("inject_bad_save"));
    return false;
  }
  if (save.gen !== teamGen) {
    alert(
      t("inject_gen_mismatch")
        .replace("{save}", String(save.gen))
        .replace("{team}", String(teamGen))
    );
    return false;
  }
  const next = write_party(buf, save, mons_from_team(team));
  download_bytes(next, patched_name(file.name));
  alert(t("inject_ok"));
  return true;
}

/** Wire a button + hidden file input for inject. */
export function bind_inject_controls({ btn, input, getTeam, getGameSlug, onState }) {
  const sync = () => {
    const can = can_inject_team(getGameSlug(), getTeam());
    if (btn) {
      // Keep clickable so we can explain why inject is blocked.
      btn.disabled = false;
      btn.classList.toggle("btn_disabled", !can);
      btn.setAttribute("aria-disabled", can ? "false" : "true");
      const gen = team_gen(getGameSlug());
      btn.title =
        gen > 5 ? t("inject_need_gen") : !getTeam()?.some(Boolean) ? t("inject_need_team") : "";
    }
    onState?.(can);
  };

  btn?.addEventListener("click", () => {
    if (!can_inject_team(getGameSlug(), getTeam())) {
      const gen = team_gen(getGameSlug());
      alert(gen > 5 ? t("inject_need_gen") : t("inject_need_team"));
      return;
    }
    input?.click();
  });

  input?.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      await inject_team_into_save_file(file, getTeam(), getGameSlug());
    } catch (err) {
      console.error(err);
      alert(`${t("inject_err")} ${err?.message || err}`);
    }
  });

  sync();
  return sync;
}
