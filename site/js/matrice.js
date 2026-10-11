// Comparer : la matrice (tableau), la vue en cartes à balayer (téléphone) et le duel entre deux partis.
// Adresses : #matrice, #matrice/cartes, #matrice/duel/<parti>/<parti>.
"use strict";
R.module("matrice", (R) => {
  const { $, $$, esc, C, cand } = R;
  const etat = { cands: new Set(C.candidatures.map((c) => c.id)), axe: "themes", mot: null, vue: null, duel: [C.candidatures[0].id, C.candidatures[1].id], ligneCartes: null };
  const PAR_CELLULE = 3;
  const notionsMatrice = R.NOTIONS.filter((n) => n.propositions.length).map((n) => ({ id: n.id, nom: n.nom, ids: new Set(n.propositions) }));
  const ouvertes = new Set();
  const etroit = () => window.matchMedia("(max-width: 720px)").matches;

  // Réglages : vue, candidatures, axe, filtres
  $("#matrice .aide").insertAdjacentHTML("afterend", `<div class="reglages"><fieldset id="f-vue"><legend>Vue</legend>
    <label class="puce"><input type="radio" name="vue-m" value="tableau"> Tableau</label>
    <label class="puce"><input type="radio" name="vue-m" value="cartes"> Cartes à balayer</label>
    <label class="puce"><input type="radio" name="vue-m" value="duel"> Duel</label></fieldset>
    <fieldset id="f-duel" hidden><legend>Duel</legend><select id="duel-a" aria-label="Premier parti"></select><span class="ref">contre</span><select id="duel-b" aria-label="Second parti"></select>${R.boutonPartage("duel", "courant", "Partager ce duel")}</fieldset></div>`);
  const opts = C.candidatures.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join("");
  $("#duel-a").innerHTML = opts; $("#duel-b").innerHTML = opts;
  const fCand = $("#f-cand");
  C.candidatures.forEach((c) => {
    const l = document.createElement("label");
    l.className = "puce"; l.dataset.actif = "true";
    l.innerHTML = `<input type="checkbox" id="c-${c.id}" checked> <span class="sigle">${esc(c.sigle)}</span> <span class="nom-c">${esc(c.nom)}</span>`; l.title = c.nom;
    l.querySelector("input").addEventListener("change", (e) => {
      e.target.checked ? etat.cands.add(c.id) : etat.cands.delete(c.id);
      l.dataset.actif = e.target.checked; dessiner();
    });
    fCand.appendChild(l);
  });
  $$('input[name="axe"]').forEach((r) => r.addEventListener("change", (e) => { etat.axe = e.target.value; dessiner(); }));
  $$('input[name="vue-m"]').forEach((r) => r.addEventListener("change", (e) => R.aller(e.target.value === "duel" ? `matrice/duel/${etat.duel.join("/")}` : `matrice/${e.target.value}`)));
  ["#duel-a", "#duel-b"].forEach((s, i) => $(s).addEventListener("change", (e) => { etat.duel[i] = e.target.value; history.replaceState(history.state, "", `#matrice/duel/${etat.duel.join("/")}`); dessiner(); }));

  // Le tableau tient dans la hauteur de l'écran : l'ascenseur horizontal reste toujours visible,
  // les en-têtes de colonnes et de lignes restent collés, et deux flèches font défiler colonne par colonne.
  const conteneur = $("#tab-matrice").parentElement;
  conteneur.classList.add("matrice-cadre");
  conteneur.insertAdjacentHTML("beforebegin", `<div class="defile-barre" id="m-defile"><button class="btn" data-pas="-1" aria-label="Colonnes précédentes">◀</button><span class="ref" id="m-position"></span><button class="btn" data-pas="1" aria-label="Colonnes suivantes">▶</button></div>`);
  conteneur.insertAdjacentHTML("afterend", `<div id="m-cartes" hidden></div><div id="m-duel" hidden></div>`);
  $("#m-defile").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pas]"); if (!b) return;
    const col = $("#tab-matrice thead th:nth-child(2)")?.offsetWidth || 300;
    conteneur.scrollBy({ left: Number(b.dataset.pas) * col, behavior: "smooth" });
  });
  const position = () => {
    const max = conteneur.scrollWidth - conteneur.clientWidth;
    $("#m-defile").hidden = max <= 4;
    $("#m-position").textContent = max > 4 ? `${Math.round((conteneur.scrollLeft / max) * 100)} % · faites défiler vers la droite pour voir tous les partis` : "";
  };
  conteneur.addEventListener("scroll", position, { passive: true });
  window.addEventListener("resize", position);

  const lignesAxe = () => etat.axe === "themes" ? C.themes : etat.axe === "notions" ? notionsMatrice : C.concepts;
  const filtreTexte = () => R.sansAccent($("#m-texte").value.trim());
  const props = (l, cId) => {
    const f = filtreTexte();
    return C.propositions.filter((p) => p.candidature === cId && (etat.axe === "themes" ? p.theme === l.id : etat.axe === "notions" ? l.ids.has(p.id) : p.concepts.includes(l.id))
      && (!f || R.sansAccent(p.citation + " " + (p.intitule || "")).includes(f)));
  };
  const celluleHTML = (l, c, cle) => {
    const ps = props(l, c.id), ouverte = ouvertes.has(cle);
    const vues = ouverte ? ps : ps.slice(0, PAR_CELLULE), reste = ps.length - vues.length;
    return `<div class="cellule">${ps.length ? `<span class="compte-cellule">${R.pluriel(ps.length, "proposition")}</span>` + vues.map((p) => R.ficheHTML(p, { motActif: etat.mot })).join("")
      + (reste ? `<button class="plus" data-cellule="${cle}">Voir les ${reste} autres</button>` : ouverte && ps.length > PAR_CELLULE ? `<button class="plus" data-cellule="${cle}">Replier</button>` : "")
      : `<span class="vide">${filtreTexte() ? "Aucune proposition avec ce mot." : "Rien dans les sources."}</span>`}</div>`;
  };

  function dessiner() {
    const vue = etat.vue || (etroit() ? "cartes" : "tableau");
    $$('input[name="vue-m"]').forEach((r) => { r.checked = r.value === vue; r.parentElement.dataset.actif = r.checked; });
    $("#f-cand").hidden = vue === "duel"; $("#f-duel").hidden = vue !== "duel";
    $("#duel-a").value = etat.duel[0]; $("#duel-b").value = etat.duel[1];
    const toutes = lignesAxe(), choix = $("#m-ligne");
    if (choix.dataset.axe !== etat.axe) {
      choix.innerHTML = `<option value="">Toutes les lignes</option>` + toutes.map((l) => `<option value="${l.id}">${esc(l.nom)}</option>`).join("");
      choix.dataset.axe = etat.axe;
    }
    const lignes = choix.value ? toutes.filter((l) => l.id === choix.value) : toutes;
    conteneur.hidden = vue !== "tableau"; $("#m-cartes").hidden = vue !== "cartes"; $("#m-duel").hidden = vue !== "duel";
    $("#m-defile").hidden = vue !== "tableau";
    if (vue === "tableau") dessinerTableau(lignes);
    else if (vue === "cartes") dessinerCartes(toutes);
    else dessinerDuel(lignes);
  }

  function dessinerTableau(lignes) {
    const cols = C.candidatures.filter((c) => etat.cands.has(c.id)), t = $("#tab-matrice");
    if (!cols.length) { t.innerHTML = `<tbody><tr><td class="vide">Cochez au moins une candidature.</td></tr></tbody>`; return; }
    let h = `<thead><tr><th scope="col">${{ themes: "Thème", notions: "Concept", concepts: "Notion" }[etat.axe]}</th>${cols.map((c) => `<th scope="col"><a href="#parti-${c.id}"><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</a></th>`).join("")}</tr></thead><tbody>`;
    for (const l of lignes) {
      h += `<tr><th scope="row">${etat.axe === "notions" ? `<a href="#concept-${l.id}">${esc(l.nom)}</a>` : esc(l.nom)}</th>`;
      for (const c of cols) h += `<td>${celluleHTML(l, c, `${etat.axe}|${l.id}|${c.id}`)}</td>`;
      h += "</tr>";
    }
    t.innerHTML = h + "</tbody>";
    requestAnimationFrame(position);
  }

  // Cartes : une ligne (thème, concept) à la fois, un parti par carte, on balaie d'un parti à l'autre.
  function dessinerCartes(toutes) {
    const l = toutes.find((x) => x.id === ($("#m-ligne").value || etat.ligneCartes)) || toutes[0];
    etat.ligneCartes = l.id;
    const cols = C.candidatures.filter((c) => etat.cands.has(c.id));
    $("#m-cartes").innerHTML = `<div class="puces-defile">${toutes.map((x) => `<button class="puce" data-ligne="${x.id}" data-actif="${x.id === l.id}">${esc(x.nom)}</button>`).join("")}</div>
      <p class="ref">${esc(l.nom)} · balayez pour passer d'un parti à l'autre</p>
      <div class="carrousel">${cols.map((c, i) => `<article class="carte carte-balayer"><h3><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)} <span class="ref">${i + 1}/${cols.length}</span></h3>${celluleHTML(l, c, `cartes|${etat.axe}|${l.id}|${c.id}`)}</article>`).join("")}</div>`;
  }

  // Duel : deux partis face à face, ligne par ligne. L'adresse du duel se partage.
  function dessinerDuel(lignes) {
    const [a, b] = etat.duel.map((id) => cand[id]);
    $("#m-duel").innerHTML = `<div class="duel-tete"><span class="duel-a"><span class="sigle">${esc(a.sigle)}</span> ${esc(a.nom)}</span><span class="ref">face à</span><span class="duel-b"><span class="sigle">${esc(b.sigle)}</span> ${esc(b.nom)}</span></div>`
      + lignes.map((l) => {
        const pa = props(l, a.id), pb = props(l, b.id);
        if (!pa.length && !pb.length) return "";
        return `<section class="duel-ligne"><h3>${esc(l.nom)}</h3><div class="duel-cols">
          <div class="duel-a">${celluleHTML(l, a, `duel|${etat.axe}|${l.id}|${a.id}`)}</div>
          <div class="duel-b">${celluleHTML(l, b, `duel|${etat.axe}|${l.id}|${b.id}`)}</div></div></section>`;
      }).join("");
  }

  $("#m-ligne").addEventListener("change", () => { etat.ligneCartes = $("#m-ligne").value || etat.ligneCartes; dessiner(); });
  let delai;
  $("#m-texte").addEventListener("input", () => { clearTimeout(delai); delai = setTimeout(dessiner, 200); });
  $("#matrice").addEventListener("click", (e) => {
    const plus = e.target.closest(".plus[data-cellule]");
    if (plus) { const k = plus.dataset.cellule; ouvertes.has(k) ? ouvertes.delete(k) : ouvertes.add(k); dessiner(); return; }
    const lg = e.target.closest("[data-ligne]");
    if (lg) { etat.ligneCartes = lg.dataset.ligne; $("#m-ligne").value = ""; dessiner(); return; }
    const b = e.target.closest(".mot[data-mot]"); if (!b) return;
    etat.mot = etat.mot === b.dataset.mot ? null : b.dataset.mot; dessiner();
  });

  R.partageurs.duel = () => {
    const [a, b] = etat.duel.map((id) => cand[id]);
    return { surtitre: "Duel de programmes", corps: `${a.nom} face à ${b.nom} : leurs propositions côte à côte, thème par thème.`, pied: "Citations exactes, sources à l'appui", texte: `${a.nom} face à ${b.nom} : leurs propositions côte à côte, thème par thème.`, ancre: `matrice/duel/${etat.duel.join("/")}` };
  };
  R.route("matrice", () => { etat.vue = null; R.montrer("matrice"); dessiner(); });
  R.route(/^matrice\/(tableau|cartes)$/, (m) => { etat.vue = m[1]; R.montrer("matrice"); dessiner(); });
  R.route(/^matrice\/duel(?:\/([\w-]+)\/([\w-]+))?$/, (m) => {
    if (m[1] && cand[m[1]] && cand[m[2]]) etat.duel = [m[1], m[2]];
    etat.vue = "duel"; R.montrer("matrice"); dessiner();
  });
  R.matrice = { dessiner };
});
