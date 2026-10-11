// Accueil (trois portes), recherche unique dans le bandeau, fiche d'une proposition (#prop-<id>)
// et page « Vie privée ».
"use strict";
R.DEVISE = "Les idées d'abord, les noms ensuite.";
R.module("accueil", (R) => {
  const { $, esc, C, cand, NOTIONS, VOCAB } = R;
  $("#devise").textContent = R.DEVISE;

  // Les 30 concepts « essentiels » : ceux que le plus de partis abordent, puis les plus cités.
  // Critère automatique et affiché, pour ne pas faire de choix éditorial caché.
  const essentiels = [...NOTIONS].sort((a, b) => R.abordePar(b) - R.abordePar(a) || b.propositions.length - a.propositions.length).slice(0, 30);
  R.essentiels = essentiels;
  const jour = Math.floor(Date.now() / 864e5);
  const duJour = essentiels[jour % essentiels.length];
  const tuile = (n) => `<a class="tuile" href="#concept-${n.id}">${esc(n.nom)}<small>${R.abordePar(n)}/${C.candidatures.length} partis · ${esc(n.categorie || "")}</small></a>`;
  const nbDocs = (C.documents || []).length;

  function dessiner() {
    const p = R.melange(C.propositions.filter((x) => x.citation.length < 220))[0];
    $("#accueil").innerHTML = `
      <div class="heros">
        <h1>République des mots <em>2027</em></h1>
        <p class="chapo">${esc(R.DEVISE)} Lisez les programmes des huit principales forces politiques côte à côte, comprenez les concepts et les mots du débat, et jugez les propositions avant de savoir de qui elles viennent.</p>
        <p class="chiffres"><span><b>${C.propositions.length.toLocaleString("fr")}</b> citations vérifiées</span><span><b>${C.candidatures.length}</b> forces politiques</span><span><b>${nbDocs}</b> documents officiels</span><span><b>${NOTIONS.length}</b> concepts</span><span><b>${VOCAB.length}</b> mots du débat</span></p>
      </div>
      <div class="portes">
        <a class="porte" href="#concept-${duJour.id}"><h3>Découvrir</h3><p>Un concept par jour, expliqué simplement, avec ce qu'en dit chaque parti. Aujourd'hui : <strong>${esc(duJour.nom)}</strong>.</p><span class="lien-fleche">Lire la fiche →</span></a>
        <a class="porte" href="#jouer"><h3>Jouer</h3><p>Pour ou contre ? Jugez une proposition sans savoir qui l'a écrite, puis découvrez de qui elle vient. Quiz, défis et test de proximité.</p><span class="lien-fleche">Commencer à l'aveugle →</span></a>
        <a class="porte" href="#matrice"><h3>Comparer</h3><p>Tous les programmes en un tableau, ou deux partis en duel, thème par thème, citation par citation.</p><span class="lien-fleche">Ouvrir la matrice →</span></a>
        <a class="porte" href="#groupes"><h3>Animer</h3><p>Une soirée, une classe, une association ? Quatre séances clés en main, un mode projection et les votes de la salle sur les téléphones.</p><span class="lien-fleche">Préparer une séance →</span></a>
      </div>
      <div class="scene"><p class="compteur">Une minute pour essayer · pour ou contre ?</p><p class="citation">« ${esc(p.citation)} »</p>
        <div class="choix"><button class="btn pour" data-essai="pour">Pour</button><button class="btn partage" data-essai="partage">Partagé</button><button class="btn contre" data-essai="contre">Contre</button></div>
        <div id="essai-rev" class="revelation" hidden><p>Cette proposition vient de <span class="sigle">${esc(cand[p.candidature].sigle)}</span> <strong>${esc(cand[p.candidature].nom)}</strong>. Vous attendiez-vous à ce nom ?</p><div class="choix"><a class="btn principal" href="#jouer/aveugle">Continuer à l'aveugle</a><a class="btn" href="#prop-${p.id}">Voir la source</a></div></div></div>
      <div class="titre-section"><h2>Les 30 concepts les plus partagés</h2><a class="lien-partage" href="#lexique">Les ${NOTIONS.length} concepts</a></div>
      <p class="aide">Les concepts que le plus de partis abordent dans leurs textes : le bon point de départ pour comprendre où ils s'accordent et où ils s'opposent.</p>
      <div class="grille-tuiles">${essentiels.map(tuile).join("")}</div>
      <div class="titre-section"><h2>Les partis</h2><a class="lien-partage" href="#partis">Toutes les fiches</a></div>
      <div class="grille-tuiles">${C.candidatures.map((c) => `<a class="tuile" href="#parti-${c.id}"><span><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</span><small>${esc(c.candidat)}</small></a>`).join("")}</div>`;
    const v = p.id;
    $("#accueil").querySelectorAll("[data-essai]").forEach((b) => b.onclick = () => { R.voter?.(v, b.dataset.essai); $("#essai-rev").hidden = false; b.parentElement.querySelectorAll("button").forEach((x) => { x.disabled = true; }); });
  }
  R.route("accueil", () => { dessiner(); R.montrer("accueil"); });

  // Recherche unique : concepts, mots, partis et propositions, depuis n'importe quelle page
  const index = [
    ...NOTIONS.map((n) => ({ type: "Concept", nom: n.nom, cle: [n.nom, ...(n.variantes || [])].join(" "), h: `concept-${n.id}` })),
    ...VOCAB.map((v) => ({ type: "Mot du débat", nom: v.terme, cle: [v.terme, ...(v.variantes || [])].join(" "), h: `terme-${v.id}` })),
    ...C.candidatures.map((c) => ({ type: "Parti", nom: c.nom, cle: [c.nom, c.sigle, c.candidat].join(" "), h: `parti-${c.id}` })),
    ...C.concepts.map((k) => ({ type: "Grande notion", nom: k.nom, cle: k.nom, h: "lexique/grandes" })),
  ].map((e) => ({ ...e, n: R.sansAccent(e.cle) }));
  const champ = $("#recherche"), boite = $("#resultats");
  let selection = 0, trouves = [];
  function chercher() {
    const q = R.sansAccent(champ.value.trim());
    if (q.length < 2) { boite.hidden = true; return; }
    const debut = index.filter((e) => e.n.split(/\s+/).some((m) => m.startsWith(q)) || e.n.startsWith(q));
    const dedans = index.filter((e) => !debut.includes(e) && e.n.includes(q));
    const props = C.propositions.filter((p) => R.sansAccent(p.citation + " " + (p.intitule || "")).includes(q));
    trouves = [...debut, ...dedans].slice(0, 9);
    selection = 0;
    boite.innerHTML = trouves.map((e, i) => `<a href="#${e.h}" aria-selected="${i === 0}"><small>${e.type}</small>${esc(e.nom)}</a>`).join("")
      + (props.length ? `<a href="#vocab/mot/${encodeURIComponent(champ.value.trim())}"><small>Dans les textes</small>${R.pluriel(props.length, "proposition")} emploient « ${esc(champ.value.trim())} »</a>` : "")
      || `<p class="vide" style="padding:8px">Rien trouvé.</p>`;
    boite.hidden = false;
  }
  champ.addEventListener("input", chercher);
  champ.addEventListener("focus", chercher);
  champ.addEventListener("keydown", (e) => {
    const liens = [...boite.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); selection = (selection + (e.key === "ArrowDown" ? 1 : -1) + liens.length) % liens.length;
      liens.forEach((a, i) => a.setAttribute("aria-selected", i === selection));
    } else if (e.key === "Enter" && liens[selection]) { e.preventDefault(); R.aller(liens[selection].getAttribute("href")); fermer(); }
    else if (e.key === "Escape") fermer();
  });
  const fermer = () => { boite.hidden = true; champ.blur(); };
  boite.addEventListener("click", () => setTimeout(() => { boite.hidden = true; champ.value = ""; }, 0));
  document.addEventListener("click", (e) => { if (!e.target.closest(".recherche-globale")) boite.hidden = true; });

  // Une proposition seule : la citation, sa source, les concepts et les mots qu'elle touche
  const notionsDe = {}, termesDe = {};
  NOTIONS.forEach((n) => n.propositions.forEach((id) => (notionsDe[id] ??= []).push(n)));
  VOCAB.forEach((v) => v.propositions.forEach((id) => (termesDe[id] ??= []).push(v)));
  R.route(/^prop-(p[0-9a-f]+)$/, (m) => {
    const p = R.parId[m[1]]; if (!p) return false;
    const c = cand[p.candidature];
    if (!R.vueCourante) { dessiner(); R.montrer("accueil"); }
    R.ouvrirPanneau(`${c.nom} · ${R.nomTheme[p.theme] || ""}`, `<div class="fiche-prop">
      ${p.intitule ? `<p class="intitule">${esc(p.intitule)}</p>` : ""}
      <p class="citation-seule">« ${esc(p.citation)} »</p>
      <p class="ref">${R.refHTML(p.source)}</p>
      ${(notionsDe[p.id] || []).length ? `<p class="mini-titre">Concepts</p><div class="mots">${notionsDe[p.id].map((n) => `<a class="mot" href="#concept-${n.id}">${esc(n.nom)}</a>`).join("")}</div>` : ""}
      ${(termesDe[p.id] || []).length ? `<p class="mini-titre">Mots du débat</p><div class="mots">${termesDe[p.id].map((v) => `<a class="mot" href="#terme-${v.id}">${esc(v.terme)}</a>`).join("")}</div>` : ""}
      <div class="actions" data-fiche-actions="prop:${p.id}">${R.boutonPartage("prop", p.id, "Partager avec le nom du parti")}${R.boutonPartage("aveugle", p.id, "Faire deviner à quelqu'un")}<a class="lien-partage" href="#parti-${c.id}">Fiche du parti</a></div>
    </div>`);
    R.emettre("panneau", "prop", p.id);
  });
  R.partageurs.prop = (id) => {
    const p = R.parId[id]; if (!p) return null;
    const c = cand[p.candidature];
    return { surtitre: p.concepts.length ? `${c.nom} · ${R.nomConcept[p.concepts[0]]}` : c.nom, corps: `« ${p.citation} »`, pied: `${p.source.titre}, ${R.page(p.source)}`, texte: `« ${p.citation} » (${c.nom})`, ancre: `prop-${p.id}` };
  };

  // Vie privée : ce qui est retenu, où, et comment tout effacer
  function dessinerViePrivee() {
    const ch = R.choix || {};
    $("#vie-privee").innerHTML = `<div class="methode">
      <h2>Vie privée : aucun traceur</h2>
      <p>Ce site ne mesure pas les visites, n'affiche aucune publicité, ne charge aucun service tiers (même les polices de caractères sont servies d'ici) et ne dépose aucun cookie tant que vous ne le demandez pas.</p>
      <h3>Ce que votre navigateur peut retenir, si vous le voulez</h3>
      <label class="consent"><input type="checkbox" id="vp-memoire" ${ch.memoire ? "checked" : ""}> Me souvenir sur cet appareil : vos votes à l'aveugle, vos scores, vos résultats de tests et le dernier concept lu. Ces données restent dans votre navigateur et ne nous sont jamais envoyées. Sans cette case, tout disparaît à la fermeture de l'onglet.</label>
      <h3>Ce que vous pouvez confier au site, si vous le voulez</h3>
      <label class="consent"><input type="checkbox" id="vp-collectif" ${ch.collectif ? "checked" : ""}> Ajouter mes votes à la carte collective des consensus. Le site dépose alors un cookie technique contenant un numéro tiré au hasard, sans lien avec votre identité, pour ne compter qu'une fois chacun de vos votes.</label>
      <p>Un compte (adresse e-mail, lien de connexion sans mot de passe) sert seulement à retrouver vos votes sur plusieurs appareils, à recevoir la lettre ou à déclarer une séance. Il dépose un cookie de session, effacé à la déconnexion. Vos votes restent stockés séparément de votre adresse.</p>
      <div class="choix"><button class="btn" id="vp-telecharger">Télécharger ce que mon navigateur retient</button><button class="btn contre" id="vp-effacer">Tout effacer sur cet appareil</button><span class="ref" id="vp-etat" role="status"></span></div>
      <p class="ref">Seul votre choix lui-même est toujours gardé dans le navigateur, pour ne pas vous reposer la question à chaque page. Le code du site est public : chacun peut vérifier ces engagements.</p>
    </div>`;
    $("#vp-memoire").onchange = (e) => { R.choisir({ memoire: e.target.checked }); $("#vp-etat").textContent = e.target.checked ? "Votre navigateur se souviendra de vous." : "Plus rien n'est gardé après la fermeture de l'onglet."; };
    $("#vp-collectif").onchange = (e) => { R.choisir({ collectif: e.target.checked }); $("#vp-etat").textContent = e.target.checked ? "Vos prochains votes compteront dans la carte collective." : "Vos votes restent sur votre appareil."; };
    $("#vp-effacer").onclick = () => { R.oublierTout(); $("#vp-etat").textContent = "Tout est effacé sur cet appareil."; setTimeout(() => location.reload(), 900); };
    $("#vp-telecharger").onclick = () => {
      const donnees = {};
      for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) { const k = s.key(i); try { donnees[k] = JSON.parse(s.getItem(k)); } catch { donnees[k] = s.getItem(k); } }
      R.telecharger("mes-donnees-republique-des-mots.json", JSON.stringify(donnees, null, 1), "application/json");
    };
  }
  R.telecharger = (nom, contenu, type = "text/plain") => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenu], { type: `${type};charset=utf-8` })); a.download = nom;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  R.route("vie-privee", () => { dessinerViePrivee(); R.montrer("vie-privee"); });
});
