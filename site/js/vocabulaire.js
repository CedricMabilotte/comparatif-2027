// Vocabulaire : le glossaire (adresse #terme-<id>) et les statistiques des mots employés (#vocab/mot/<mot>).
"use strict";
R.module("vocabulaire", (R) => {
  const { $, esc, C, VOCAB, cand, parTerme, parNotion, parNomTerme, nomTheme } = R;
  const remplir = (sel, valeurs) => { $(sel).insertAdjacentHTML("beforeend", valeurs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")); };
  remplir("#g-registre", [...new Set(VOCAB.map((v) => v.registre).filter(Boolean))].sort().map((r) => [r, r[0].toUpperCase() + r.slice(1)]));
  remplir("#g-theme", C.themes.map((t) => [t.id, t.nom]));
  const PAR_PAGE = 48;
  let gLimite = PAR_PAGE;
  function termeHTML(v) {
    const max = Math.max(1, ...Object.values(v.usage || {}));
    const ps = v.propositions.map((id) => R.parId[id]).filter(Boolean);
    return `<article class="carte" id="terme-${v.id}">
      <h3>${esc(v.terme)}</h3>
      <p class="etiquettes">${v.registre ? `<span class="etiquette">${esc(v.registre)}</span>` : ""}${(v.themes || [v.theme]).map((t) => `<span class="etiquette">${esc(nomTheme[t] || t)}</span>`).join("")}</p>
      <p class="def" style="font-style:normal">${esc(v.definition || "")}</p>
      ${v.lecture ? `<span class="lecture">Lecture éditoriale</span><p class="def">${esc(v.lecture)}</p>` : ""}
      <p class="mini-titre">Emplois dans les textes lus</p>
      <div class="usage-partis">${C.candidatures.map((c) => { const k = v.usage?.[c.id] || 0; return `<span class="${k ? "" : "zero"}" style="${k ? `background:color-mix(in srgb, var(--accent) ${Math.round(12 + (k / max) * 40)}%, transparent)` : ""}" title="${esc(c.nom)}">${esc(c.sigle)} ${k}</span>`; }).join("")}</div>
      ${(v.concurrents || []).length ? `<p class="mini-titre">Mots concurrents</p><div class="mots">${v.concurrents.map((t) => { const id = parNomTerme[R.sansAccent(t)]; return id ? `<a class="mot" href="#terme-${id}">${esc(t)}</a>` : `<a class="mot" href="#vocab/mot/${encodeURIComponent(t)}" title="Chercher ce mot dans les textes">${esc(t)}</a>`; }).join("")}</div>` : ""}
      ${(v.notions || []).length ? `<p class="mini-titre">Concepts liés</p><div class="mots">${v.notions.map((n) => `<a class="mot" href="#concept-${n}">${esc(parNotion[n]?.nom || n)}</a>`).join("")}</div>` : ""}
      ${ps.length ? `<details><summary class="plus">Lire les ${ps.length} emploi${ps.length > 1 ? "s" : ""}</summary>${ps.map((p) => `<p class="ligne-emploi"><span class="sigle">${esc(cand[p.candidature].sigle)}</span> ${esc(p.citation)} <span class="ref">${R.refHTML(p.source)}</span></p>`).join("")}</details>` : ""}
      <div class="actions" data-fiche-actions="terme:${v.id}">${R.boutonPartage("terme", v.id)}</div>
    </article>`;
  }
  function dessinerGlossaire() {
    const q = R.sansAccent($("#g-cherche").value.trim()), reg = $("#g-registre").value, th = $("#g-theme").value;
    const liste = VOCAB.filter((v) => (!reg || v.registre === reg) && (!th || (v.themes || [v.theme]).includes(th))
      && (!q || R.sansAccent([v.terme, ...(v.variantes || []), ...(v.concurrents || [])].join(" ")).includes(q)));
    $("#g-compte").textContent = VOCAB.length ? `${liste.length} terme${liste.length > 1 ? "s" : ""} sur ${VOCAB.length}` : "";
    $("#g-liste").innerHTML = liste.slice(0, gLimite).map(termeHTML).join("");
    $("#g-plus").hidden = liste.length <= gLimite;
    R.emettre("glossaire");
  }
  ["#g-cherche", "#g-registre", "#g-theme"].forEach((sel) => $(sel).addEventListener("input", () => { gLimite = PAR_PAGE; dessinerGlossaire(); }));
  $("#g-plus").addEventListener("click", () => { gLimite += PAR_PAGE; dessinerGlossaire(); });
  dessinerGlossaire();

  // Statistiques : les mots réellement employés dans les citations, comptés par parti
  const VIDES = new Set("les des une un le la de du et en au aux pour par sur dans avec sans que qui quoi dont où est sont sera seront nous vous ils elles leur leurs son sa ses ce cet cette ces chaque tout toute tous toutes plus moins entre afin ainsi être avoir doit doivent pas ne ni ou mais donc car comme lui elle on se il y à d l qu s n c j m t abord contre très bien aussi déjà".split(" "));
  const mots = (t) => t.toLowerCase().replace(/[’']/g, " ").split(/[^a-zàâäçéèêëîïôöûùüÿœæ-]+/).map((m) => m.replace(/^-+|-+$/g, "")).filter((m) => m.length > 2 && !VIDES.has(m));
  const occ = {};
  C.propositions.forEach((p) => mots(p.citation).forEach((m) => { occ[m] ??= {}; occ[m][p.candidature] = (occ[m][p.candidature] ?? 0) + 1; }));
  const total = (m) => Object.values(occ[m]).reduce((a, b) => a + b, 0);
  const tri = Object.keys(occ).sort((a, b) => total(b) - total(a) || a.localeCompare(b, "fr"));
  const propres = (cId, n) => tri.filter((m) => (occ[m][cId] ?? 0) / total(m) >= 0.99).sort((a, b) => occ[b][cId] - occ[a][cId]).slice(0, n);
  const lienMot = (m) => `<a class="mot" href="#vocab/mot/${encodeURIComponent(m)}">${esc(m)}</a>`;
  R.vocab = { occ, total, tri, propres, lienMot, termeHTML };

  const top = tri.slice(0, 15), max = Math.max(...top.map(total));
  $("#v-table").innerHTML = `<thead><tr><th scope="col">Mot</th>${C.candidatures.map((c) => `<th scope="col"><span class="sigle">${esc(c.sigle)}</span></th>`).join("")}<th scope="col">Total</th></tr></thead><tbody>${top.map((m) => `<tr><td class="mot-col">${lienMot(m)}</td>${C.candidatures.map((c) => {
    const n = occ[m][c.id] ?? 0;
    return `<td><span class="chaleur" style="background:color-mix(in srgb, var(--accent) ${Math.round((n / max) * 45)}%, transparent)">${n || "·"}</span></td>`;
  }).join("")}<td>${total(m)}</td></tr>`).join("")}</tbody>`;
  $("#v-propres").innerHTML = C.candidatures.map((c) => `<article class="carte"><h3><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</h3><div class="mots">${propres(c.id, 10).map(lienMot).join("")}</div></article>`).join("");

  function chercher(m) {
    m = m.trim().toLowerCase(); $("#v-mot").value = m;
    if (!m) { $("#v-contexte").innerHTML = ""; return; }
    const re = new RegExp(`(${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-zàâäçéèêëîïôöûùüÿœæ]*)`, "gi");
    const ps = C.propositions.filter((p) => re.test(p.citation) && !(re.lastIndex = 0));
    const terme = parNomTerme[R.sansAccent(m)];
    $("#v-contexte").innerHTML = (terme ? `<p class="aide">Ce mot a une fiche dans le glossaire : <a href="#terme-${terme}">${esc(parTerme[terme].terme)}</a>.</p>` : "")
      + (ps.length ? `<p class="ref">${R.pluriel(ps.length, "emploi")}</p>` + ps.map((p) => `<div class="ligne-ctx"><span class="sigle" style="justify-self:start">${esc(cand[p.candidature].sigle)}</span><span>${esc(p.citation).replace(re, "<mark>$1</mark>")} <a class="ref" href="#prop-${p.id}">ouvrir</a></span></div>`).join("")
      : `<p class="vide">Aucun emploi de « ${esc(m)} » dans les textes.</p>`);
  }
  $("#v-mot").addEventListener("input", (e) => { chercher(e.target.value); history.replaceState(history.state, "", `#vocab/mot/${encodeURIComponent(e.target.value.trim())}`); });

  R.route("vocab", () => { R.montrer("vocab"); });
  R.route(/^terme-(.+)$/, (m) => {
    const v = parTerme[m[1]]; if (!v) return false;
    $("#g-cherche").value = v.terme; $("#g-registre").value = ""; $("#g-theme").value = ""; gLimite = PAR_PAGE;
    R.montrer("vocab"); dessinerGlossaire(); document.getElementById(`terme-${v.id}`)?.scrollIntoView({ block: "start" });
  });
  R.route(/^vocab\/mot\/(.*)$/, (m) => { R.montrer("vocab"); chercher(m[1]); $("#v-mot").scrollIntoView({ block: "center" }); });
  R.partageurs.terme = (id) => {
    const v = parTerme[id]; if (!v) return null;
    return { surtitre: `Vocabulaire · ${v.registre || "terme"}`, corps: `${v.terme} : ${v.definition.length > 220 ? v.definition.slice(0, 217) + "…" : v.definition}`, pied: v.concurrents?.length ? `Mots concurrents : ${v.concurrents.slice(0, 3).join(", ")}` : "Qui l'emploie, et ce que le mot met en avant", texte: `« ${v.terme} » : ce que le mot désigne, qui l'emploie dans les programmes, et les mots concurrents.`, ancre: `terme-${v.id}`, page: `t/${v.id}.html`, integrer: `t/${v.id}.html?integrer` };
  };
});
