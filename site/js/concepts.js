// Concepts : les concepts précis (une fiche par concept, adresse #concept-<id>) et les grandes notions.
"use strict";
R.module("concepts", (R) => {
  const { $, $$, esc, C, NOTIONS, VOCAB, parNotion, nomTheme } = R;

  // Grandes notions : ce que chaque parti met derrière les mots-valeurs
  let conceptActif = C.concepts[0].id;
  function dessinerLexique() {
    $("#lex-liste").innerHTML = C.concepts.map((k) => {
      const n = C.propositions.filter((p) => p.concepts.includes(k.id)).length;
      return `<button aria-pressed="${k.id === conceptActif}" data-k="${k.id}">${esc(k.nom)} <span class="n">${n}</span></button>`;
    }).join("");
    const max = Math.max(1, ...C.candidatures.map((c) => C.propositions.filter((p) => p.candidature === c.id && p.concepts.includes(conceptActif)).length));
    $("#lex-cols").innerHTML = C.candidatures.map((c) => {
      const ps = C.propositions.filter((p) => p.candidature === c.id && p.concepts.includes(conceptActif));
      return `<article class="carte"><h3><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</h3>
        ${R.lectureHTML(C.lexique[conceptActif]?.[c.id])}
        <div class="jauge"><span class="barre"><i style="width:${(ps.length / max) * 100}%"></i></span><span>${R.pluriel(ps.length, "proposition")}</span></div>
        ${ps.slice(0, 4).map((p) => R.ficheHTML(p, { mots: false })).join("")}
        ${ps.length > 4 ? `<details><summary class="plus">Voir les ${ps.length - 4} autres</summary>${ps.slice(4).map((p) => R.ficheHTML(p, { mots: false })).join("")}</details>` : ""}</article>`;
    }).join("");
  }
  $("#lex-liste").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { conceptActif = b.dataset.k; dessinerLexique(); } });
  dessinerLexique();

  // Concepts précis
  const remplir = (sel, valeurs) => { $(sel).insertAdjacentHTML("beforeend", valeurs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")); };
  remplir("#n-theme", C.themes.map((t) => [t.id, t.nom]));
  remplir("#n-cat", [...new Set(NOTIONS.map((n) => n.categorie).filter(Boolean))].sort().map((c) => [c, c[0].toUpperCase() + c.slice(1)]));
  let notionActive = R.lire("notion", null);
  const filtreNotions = () => {
    const q = R.sansAccent($("#n-cherche").value.trim()), th = $("#n-theme").value, cat = $("#n-cat").value;
    return NOTIONS.filter((n) => (!th || (n.themes || [n.theme]).includes(th)) && (!cat || n.categorie === cat)
      && (!q || R.sansAccent([n.nom, ...(n.variantes || []), n.definition || ""].join(" ")).includes(q)));
  };
  function dessinerNotions() {
    const liste = filtreNotions();
    if (!liste.some((n) => n.id === notionActive)) notionActive = liste[0]?.id ?? null;
    $("#n-liste").innerHTML = liste.length ? liste.map((n) => `<a href="#concept-${n.id}" ${n.id === notionActive ? 'aria-current="true"' : ""}><span>${esc(n.nom)}<span class="sous">${esc(n.categorie || "")}</span></span><span class="n" title="Partis qui l'abordent">${R.abordePar(n)}/${C.candidatures.length}</span></a>`).join("")
      : `<p class="vide">Aucun concept ne correspond.</p>`;
    $("#n-fiche").innerHTML = notionActive ? ficheNotionHTML(parNotion[notionActive]) : "";
    R.emettre("fiche-notion", notionActive);
  }
  function ficheNotionHTML(n) {
    const vocab = VOCAB.filter((v) => (v.notions || []).includes(n.id));
    const props = n.propositions.map((id) => R.parId[id]).filter(Boolean);
    return `<article class="fiche-notion" id="fiche-${n.id}">
      <h2>${esc(n.nom)}</h2>
      <p class="etiquettes">${n.categorie ? `<span class="etiquette">${esc(n.categorie)}</span>` : ""}${(n.themes || [n.theme]).map((t) => `<span class="etiquette">${esc(nomTheme[t] || t)}</span>`).join("")}${(n.variantes || []).length ? `<span class="etiquette">aussi : ${esc(n.variantes.join(", "))}</span>` : ""}</p>
      <span class="lecture">Définition éditoriale</span><p class="def">${esc(n.definition || "")}</p>
      ${n.enjeux ? `<p class="mini-titre">Ce qui est débattu</p><p class="def">${esc(n.enjeux)}</p>` : ""}
      ${(n.reperes || []).length ? `<p class="mini-titre">Repères</p><ul class="reperes">${n.reperes.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      ${(n.liens || []).length ? `<p class="mini-titre">Voir aussi</p><div class="mots">${n.liens.map((l) => `<a class="mot" href="#concept-${l}">${esc(parNotion[l]?.nom || l)}</a>`).join("")}</div>` : ""}
      ${vocab.length ? `<p class="mini-titre">Vocabulaire associé</p><div class="mots">${vocab.map((v) => `<a class="mot" href="#terme-${v.id}">${esc(v.terme)}</a>`).join("")}</div>` : ""}
      <p class="mini-titre">Ce qu'en disent les partis</p>
      <div class="lex-cols">${C.candidatures.map((c) => {
        const pos = n.positions?.[c.id], ps = props.filter((p) => p.candidature === c.id);
        return `<article class="carte"><h3><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</h3>
          ${pos ? R.lectureHTML(pos) : ps.length ? "" : `<p class="non-aborde">Non abordé dans les textes lus.</p>`}
          ${ps.length ? `<details><summary class="plus">${ps.length} citation${ps.length > 1 ? "s" : ""} qui en parle${ps.length > 1 ? "nt" : ""}</summary>${ps.map((p) => R.ficheHTML(p, { mots: false })).join("")}</details>` : ""}</article>`;
      }).join("")}</div>
      <div class="actions" data-fiche-actions="notion:${n.id}">${R.boutonPartage("notion", n.id, "Partager ce concept")}<a class="lien-partage" href="#matrice">Comparer dans la matrice</a></div>
      <div data-contributions="notion:${n.id}"></div>
    </article>`;
  }
  function vueConcepts(v) {
    $(`input[name="vue-concepts"][value="${v}"]`).checked = true;
    $("#n-precis").hidden = v !== "precis"; $("#n-filtres").hidden = v !== "precis"; $("#n-grandes").hidden = v !== "grandes";
  }
  $$('input[name="vue-concepts"]').forEach((r) => r.addEventListener("change", (e) => R.aller(e.target.value === "grandes" ? "lexique/grandes" : "lexique")));
  ["#n-cherche", "#n-theme", "#n-cat"].forEach((sel) => $(sel).addEventListener("input", dessinerNotions));

  R.route("lexique", () => { R.montrer("lexique"); vueConcepts(NOTIONS.length ? "precis" : "grandes"); dessinerNotions(); });
  R.route("lexique/grandes", () => { R.montrer("lexique"); vueConcepts("grandes"); });
  R.route(/^concept-(.+)$/, (m) => {
    if (!parNotion[m[1]]) return false;
    notionActive = m[1]; R.ecrire("notion", notionActive);
    if (!filtreNotions().some((n) => n.id === notionActive)) { $("#n-cherche").value = ""; $("#n-theme").value = ""; $("#n-cat").value = ""; }
    R.montrer("lexique", { haut: false }); vueConcepts("precis"); dessinerNotions();
    const fiche = $("#n-fiche"), cible = fiche.getBoundingClientRect().top + window.scrollY - 140;
    if (window.scrollY > cible || window.matchMedia("(max-width: 640px)").matches) window.scrollTo(0, cible);
  });

  R.partageurs.notion = (id) => {
    const n = parNotion[id]; if (!n) return null;
    const k = R.abordePar(n);
    return { surtitre: `Concept · ${n.nom}`, corps: n.definition.length > 260 ? n.definition.slice(0, 257) + "…" : n.definition, pied: `Ce qu'en disent ${R.pluriel(k, "parti")}, citations à l'appui`, texte: `${n.nom} : la définition, les enjeux et ce qu'en disent les partis, citations à l'appui.`, ancre: `concept-${n.id}`, page: `c/${n.id}.html`, integrer: `c/${n.id}.html?integrer` };
  };
  R.concepts = { ficheNotionHTML };
});
