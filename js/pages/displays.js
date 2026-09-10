import { monta_shell } from "../boot.js";
import { t } from "../i18n.js";
import {
  lista_displays,
  apaga_display,
  baixa_html,
  html_display_card,
  css_display,
  nome_jogo,
} from "../team_display.js";

monta_shell({ active: "team" });

const galeria = document.getElementById("galeria");
const status = document.getElementById("status");

function garante_css() {
  if (document.getElementById("td-display-css")) return;
  const s = document.createElement("style");
  s.id = "td-display-css";
  s.textContent = css_display();
  document.head.appendChild(s);
}

function pinta() {
  garante_css();
  const list = lista_displays();
  if (!list.length) {
    status.textContent = t("display_empty");
    galeria.innerHTML = "";
    return;
  }
  status.textContent = `${list.length}`;
  galeria.innerHTML = list
    .map((d) => {
      const when = d.updated || d.created
        ? new Date(d.updated || d.created).toLocaleString()
        : "";
      return `<section class="display-gallery__item" data-id="${d.id}">
        <div class="display-gallery__actions">
          <div>
            <strong>${d.title || "Team"}</strong>
            <div class="muted">${nome_jogo(d.game)}${when ? ` · ${when}` : ""}</div>
          </div>
          <div class="toolbar" style="margin:0">
            <button type="button" class="btn btn_ghost" data-dl>${t("display_download")}</button>
            <button type="button" class="btn btn_ghost" data-del>${t("display_delete")}</button>
          </div>
        </div>
        ${html_display_card(d)}
      </section>`;
    })
    .join("");

  galeria.querySelectorAll(".display-gallery__item").forEach((el) => {
    const id = el.dataset.id;
    const d = list.find((x) => x.id === id);
    el.querySelector("[data-dl]")?.addEventListener("click", () => {
      if (d) baixa_html(d);
    });
    el.querySelector("[data-del]")?.addEventListener("click", () => {
      if (!confirm(t("display_delete_confirm"))) return;
      apaga_display(id);
      pinta();
    });
  });
}

pinta();
