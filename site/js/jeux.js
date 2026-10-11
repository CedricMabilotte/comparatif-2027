// Jouer : une grille de jeux (#jouer), puis À l'aveugle, Qui a dit ça ?, Qui emploie ce mot ?,
// Paires de mots, Votre profil d'idées et le défi entre amis. Adresses #jouer/<jeu>/<réglages>.
// R.jeux.ajouter(id, nom, { afficher(args), etat(), resume, duree, cache }) déclare un jeu :
// un sous-onglet (sauf s'il est caché), une tuile sur la grille et un panneau #jeu-<id>.
"use strict";
R.module("jeux", (R) => {
  const { $, $$, esc, C, cand } = R;
  const jeux = [];
  const VOTE = { pour: "pour", partage: "partagé", contre: "contre" };
  const NIVEAUX = { facile: { nom: "facile", n: 2, aide: "2 réponses possibles" }, moyen: { nom: "moyen", n: 4, aide: "4 réponses possibles" }, expert: { nom: "expert", n: 8, aide: "les 8 forces" } };
  const IDS = C.candidatures.map((c) => c.id);

  // Progression gardée par la mémoire volontaire : dernier jeu ouvert, records, profil fait.
  const progres = R.lire("jeux-progres", {});
  const noter = (k, v) => { progres[k] = v; R.ecrire("jeux-progres", progres); };

  // ---------- Cadre commun : navigation, grille, outils ----------
  $("#jeux-nav").insertAdjacentHTML("afterend", `<div class="jeu" id="jeux-grille" hidden></div>`);
  function dessinerNav(actif, args) {
    $("#jeux-nav").innerHTML = jeux.filter((j) => !j.cache || j.id === actif).map((j) => {
      const h = `#jouer/${j.id}${j.id === actif && j.cache && args ? "/" + esc(args) : ""}`;
      return `<a href="${h}" data-jeu="${j.id}"${j.id === actif ? ' aria-current="page"' : ""}>${esc(j.nom)}</a>`;
    }).join("");
  }
  R.jeux = {
    ajouter(id, nom, options = {}) {
      if (!$(`#jeu-${id}`)) $("#jouer").insertAdjacentHTML("beforeend", `<div class="jeu" id="jeu-${id}" hidden></div>`);
      jeux.push({ id, nom, ...options });
      dessinerNav();
    },
  };
  function montrerJeu(id, args) {
    const j = jeux.find((x) => x.id === id);
    R.montrer("jouer");
    $$("#jouer > .jeu").forEach((d) => { d.hidden = d.id !== `jeu-${j.id}`; });
    dessinerNav(j.id, args);
    j.afficher?.(args);
    if (!j.cache) noter("dernier", { id: j.id, args: args || "" });
  }
  function montrerGrille() {
    R.montrer("jouer");
    $$("#jouer > .jeu").forEach((d) => { d.hidden = d.id !== "jeux-grille"; });
    dessinerNav();
    const d = progres.dernier, j = d && jeux.find((x) => x.id === d.id), etat = j?.etat?.();
    $("#jeux-grille").innerHTML = `${etat ? `<p class="carte reprendre"><span class="mini-titre">Reprendre là où vous en étiez</span>
        <a href="#jouer/${j.id}${d.args ? "/" + esc(d.args) : ""}">${esc(j.nom)}</a><span class="ref">${esc(etat)}</span></p>` : ""}
      <div class="grille-jeux">${jeux.filter((x) => !x.cache).map((x) => {
        const e = x.etat?.();
        return `<a class="tuile tuile-jeu" href="#jouer/${x.id}"><b>${esc(x.nom)}</b><span class="tuile-texte">${esc(x.resume || "")}</span><small>${esc(x.duree || "")}${e ? " · " + esc(e) : ""}</small></a>`;
      }).join("")}</div>`;
  }
  R.route("jouer", montrerGrille);
  R.route(/^jouer\/([\w-]+)(?:\/(.*))?$/, (m) => { if (!jeux.some((j) => j.id === m[1])) return false; montrerJeu(m[1], m[2]); });
  R.route("aveugle", () => R.aller("jouer/aveugle"));
  R.route("quiz", () => R.aller("jouer/quiz"));

  const tirer = (liste, n) => R.melange(liste).slice(0, n);
  const courte = (p, max = 200) => p.citation.length >= 25 && p.citation.length <= max;
  // Lisible seule : commence par une majuscule et n'est pas écrite tout en capitales.
  const lisible = (p) => /^[A-ZÀ-Ý«]/.test(p.citation) && p.citation !== p.citation.toUpperCase();
  const tronque = (t, n = 110) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);
  const sigle = (c) => `<span class="sigle" title="${esc(cand[c].nom)}">${esc(cand[c].sigle)}</span>`;
  const nomParti = (c) => `${sigle(c)} <strong>${esc(cand[c].nom)}</strong>`;
  const notionsDe = {};
  R.NOTIONS.forEach((n) => (n.propositions || []).forEach((id) => (notionsDe[id] ??= []).push(n)));
  // Rebonds : un ou deux liens vers la suite logique d'une révélation.
  const rebonds = (liens) => {
    const l = liens.filter(Boolean).slice(0, 3);
    return l.length ? `<p class="rebonds"><span class="mini-titre">Et ensuite</span>${l.map(([h, t]) => `<a href="#${h}">${esc(t)}</a>`).join("")}</p>` : "";
  };
  const rebondsProp = (p) => [[`prop-${p.id}`, "Lire la source"], notionsDe[p.id]?.[0] ? [`concept-${notionsDe[p.id][0].id}`, `Le concept : ${notionsDe[p.id][0].nom}`] : [`parti-${p.candidature}`, "La fiche du parti"]];
  const boutonsVote = () => `<div class="choix">${["pour", "partage", "contre"].map((v) => `<button class="btn ${v}" data-v="${v}">${v === "partage" ? "Partagé" : v === "pour" ? "Pour" : "Contre"}</button>`).join("")}</div>`;
  const annonce = (id) => `<p class="lecteur-seul" aria-live="polite" id="annonce-${id}"></p>`;
  const annoncer = (id, t) => { const a = $(`#annonce-${id}`); if (a) a.textContent = t; };
  const focaliser = (sel) => requestAnimationFrame(() => $(sel)?.focus({ preventScroll: true }));
  const date = (d = new Date()) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const partager = (o) => R.partager({ defi: true, ...o });

  // La case « carte collective », sous les boutons de vote : elle lit et écrit R.choix.collectif.
  const caseCollectif = () => `<label class="consent case-collectif"><input type="checkbox" data-collectif ${R.choix?.collectif ? "checked" : ""}>
    <span>Ajouter mes votes, sans mon nom, à la carte collective. <span class="ref">Le site garde alors un numéro tiré au hasard, sans lien avec vous, pour ne compter chaque vote qu'une fois. Seuls vos prochains votes sont envoyés.</span></span></label>`;
  document.addEventListener("change", (e) => { if (e.target.matches("[data-collectif]")) R.choisir({ collectif: e.target.checked }); });
  R.on("choix", (ch) => $$("[data-collectif]").forEach((c) => { c.checked = !!ch?.collectif; }));

  // Votes : R.voter et R.votes viennent du noyau s'il les fournit, sinon d'ici.
  const votes = (R.votes ??= R.lire("votes", {}));
  R.voter ??= (id, valeur) => {
    votes[id] = valeur; R.ecrire("votes", votes);
    if (R.choix?.collectif) R.api("vote", { proposition: id, valeur });
    R.emettre("vote", id, valeur);
  };
  const nbVotes = () => Object.keys(votes).length;

  // ---------- À l'aveugle ----------
  $("#jeu-aveugle").innerHTML = `
    <p class="aide">Jugez chaque proposition seule. Le nom de la force qui l'a écrite n'apparaît qu'après votre vote.</p>
    <nav class="puces-defile" id="av-themes" aria-label="Thème des propositions"></nav>
    <div class="scene" id="scene-aveugle"></div>${annonce("aveugle")}
    <section class="carte bloc-jeu" id="av-surprises" aria-labelledby="av-surprises-titre"></section>
    <section class="carte bloc-jeu" id="av-defi" aria-labelledby="av-defi-titre"></section>
    <h2>Votre lecture</h2>
    <p class="aide">Ce que vous avez soutenu, une fois les noms révélés. Personne d'autre ne voit ce bilan.</p>
    <div class="bilan" id="bilan"></div>
    <div class="legende"><span><b style="background:var(--pour)"></b>Pour</span><span><b style="background:var(--partage)"></b>Partagé</span><span><b style="background:var(--contre)"></b>Contre</span></div>`;
  const av = { theme: null, file: [], revele: null, pret: false };
  function remplirFile(theme) {
    av.theme = theme; av.revele = null; av.pret = true;
    av.file = R.melange(C.propositions.filter((p) => !votes[p.id] && (!theme || p.theme === theme)));
  }
  function dessinerThemes() {
    const lien = (id, nom) => `<a class="puce" href="#jouer/aveugle${id ? "/" + id : ""}" data-actif="${av.theme === id}"${av.theme === id ? ' aria-current="true"' : ""}>${esc(nom)}</a>`;
    $("#av-themes").innerHTML = lien(null, "Tous les thèmes") + C.themes.map((t) => lien(t.id, t.nom)).join("");
  }
  function dessinerVote() {
    const s = $("#scene-aveugle"), fait = nbVotes();
    while (!av.revele && av.file.length && votes[av.file[0].id]) av.file.shift(); // déjà jugée ailleurs
    const p = av.revele ? R.parId[av.revele] : av.file[0];
    const surtitre = `${av.theme ? esc(R.nomTheme[av.theme]) + " · " : ""}${fait ? R.pluriel(fait, "proposition jugée", "propositions jugées") : "Première proposition"}`;
    if (!p) {
      s.innerHTML = `<p class="compteur">${surtitre}</p><p class="citation">Vous avez jugé toutes les propositions${av.theme ? " de ce thème" : ""}.</p>
        <div class="choix">${av.theme ? `<a class="btn principal" href="#jouer/aveugle">Tous les thèmes</a>` : `<button class="btn" id="raz">Effacer mes votes et recommencer</button>`}</div>`;
      $("#raz")?.addEventListener("click", () => { for (const k in votes) delete votes[k]; R.ecrire("votes", votes); remplirFile(null); dessinerAveugle(); });
      return;
    }
    s.innerHTML = `<p class="compteur">${surtitre}</p><p class="citation">« ${esc(p.citation)} »</p>
      ${av.revele ? `<div class="revelation">
        <p>Vous avez voté <strong>${VOTE[votes[p.id]]}</strong>. Cette proposition vient de ${nomParti(p.candidature)}.</p>
        <p class="ref">${R.refHTML(p.source)}</p>
        ${fait % 10 === 0 ? `<p class="palier">${fait} votes. <button class="lien-partage" data-defiler="av-surprises">Voir ce qui vous a surpris</button></p>` : ""}
        <div class="choix"><button class="btn principal" id="suivante">Proposition suivante</button><button class="btn" data-partage="aveugle:${p.id}">Faire deviner à quelqu'un</button></div>
        ${rebonds(rebondsProp(p))}</div>` : boutonsVote()}
      ${caseCollectif()}`;
    if (av.revele) $("#suivante").onclick = () => { av.file.shift(); av.revele = null; dessinerVote(); focaliser("#scene-aveugle [data-v]"); };
    else s.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => {
      R.voter(p.id, b.dataset.v); av.revele = p.id;
      dessinerAveugle(); focaliser("#suivante");
      annoncer("aveugle", `Vous avez voté ${VOTE[b.dataset.v]}. Cette proposition vient de ${cand[p.candidature].nom}.`);
    });
  }
  // « Ce qui vous a surpris » : des idées approuvées venant des forces dont la personne rejette
  // le plus souvent les propositions, et l'inverse. Calculé ici, jamais envoyé.
  function surprises() {
    const parC = {};
    for (const [id, v] of Object.entries(votes)) {
      const p = R.parId[id]; if (!p) continue;
      const s = (parC[p.candidature] ??= { pour: 0, partage: 0, contre: 0, n: 0 }); s[v]++; s.n++;
    }
    const groupe = (v, w) => new Set(Object.keys(parC).filter((c) => parC[c].n >= 2 && parC[c][v] / parC[c].n >= 0.5 && parC[c][v] > parC[c][w]));
    const rejetees = groupe("contre", "pour"), approuvees = groupe("pour", "contre");
    const ids = Object.keys(votes).reverse().filter((id) => R.parId[id]);
    return {
      approuve: ids.filter((id) => votes[id] === "pour" && rejetees.has(R.parId[id].candidature)).slice(0, 4),
      rejete: ids.filter((id) => votes[id] === "contre" && approuvees.has(R.parId[id].candidature)).slice(0, 4),
    };
  }
  const listeIdees = (ids) => `<ul class="liste-idees">${ids.map((id) => { const p = R.parId[id]; return `<li><a href="#prop-${p.id}">« ${esc(tronque(p.citation))} »</a> ${sigle(p.candidature)}</li>`; }).join("")}</ul>`;
  function dessinerSurprises() {
    const fait = nbVotes(), b = $("#av-surprises");
    let corps;
    if (fait < 10) corps = `<p class="aide">Encore ${R.pluriel(10 - fait, "vote")} pour voir apparaître ce bilan.</p>`;
    else {
      const s = surprises();
      corps = (s.approuve.length ? `<p class="mini-titre">Vous avez approuvé ces idées, qui viennent de forces dont vous rejetez souvent les propositions</p>${listeIdees(s.approuve)}` : "")
        + (s.rejete.length ? `<p class="mini-titre">À l'inverse, vous avez rejeté ces idées, qui viennent de forces dont vous approuvez souvent les propositions</p>${listeIdees(s.rejete)}` : "")
        + (!s.approuve.length && !s.rejete.length ? `<p class="aide">Aucun écart de ce genre pour l'instant : continuez, il apparaît souvent après une vingtaine de votes.</p>` : "")
        + `<p class="ref">Ce bilan porte sur vos ${fait} votes. Il ne dit rien de vos priorités ni de votre avis sur les personnes.</p>`;
    }
    b.innerHTML = `<h2 id="av-surprises-titre">Ce qui vous a surpris</h2><p class="aide">Un bilan privé, calculé dans votre navigateur.</p>${corps}`;
  }
  function dessinerDefiBloc() {
    const fait = nbVotes();
    $("#av-defi").innerHTML = `<h2 id="av-defi-titre">Défier un ami</h2>
      <p class="aide">Envoyez vos 5 derniers votes. Votre ami juge les mêmes idées à l'aveugle, puis découvre sur combien vous êtes d'accord, avec les auteurs et les sources. Tout tient dans le lien : le site n'enregistre rien.</p>
      <div class="choix"><button class="btn" id="av-defier" ${fait < 5 ? "disabled" : ""}>Préparer le défi</button>${fait < 5 ? `<span class="ref">Encore ${R.pluriel(5 - fait, "vote")}.</span>` : ""}</div>`;
    $("#av-defier").onclick = () => partagerDefi(Object.keys(votes).filter((id) => R.parId[id]).slice(-5).map((id) => [id, votes[id]]));
  }
  function dessinerBilan() {
    const lignes = C.candidatures.map((c) => {
      const v = C.propositions.filter((p) => p.candidature === c.id && votes[p.id]).map((p) => votes[p.id]);
      const n = v.length || 1, f = (x) => (v.filter((y) => y === x).length / n) * 100, k = (x) => v.filter((y) => y === x).length;
      return `<div class="bilan-ligne"><span>${sigle(c.id)} ${esc(c.nom)}</span>
        <span class="empile" role="img" aria-label="${k("pour")} pour, ${k("partage")} partagé, ${k("contre")} contre">
        <i style="width:${f("pour")}%;background:var(--pour)"></i><i style="width:${f("partage")}%;background:var(--partage)"></i><i style="width:${f("contre")}%;background:var(--contre)"></i></span>
        <span class="ref">${v.length} jugée${v.length > 1 ? "s" : ""}</span></div>`;
    }).join("");
    $("#bilan").innerHTML = nbVotes() ? lignes : `<p class="aide">Votez sur une première proposition pour voir apparaître votre bilan.</p>`;
  }
  function dessinerAveugle() { dessinerVote(); dessinerSurprises(); dessinerDefiBloc(); dessinerBilan(); }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-defiler]"); if (!b) return;
    document.getElementById(b.dataset.defiler)?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  R.jeux.ajouter("aveugle", "À l'aveugle", {
    resume: "Pour ou contre ? Jugez une idée avant de savoir de qui elle vient.", duree: "À votre rythme",
    etat: () => (nbVotes() ? R.pluriel(nbVotes(), "proposition jugée", "propositions jugées") : null),
    afficher(args) {
      const theme = R.nomTheme[args] ? args : null;
      if (!av.pret || av.theme !== theme) remplirFile(theme);
      dessinerThemes(); dessinerAveugle();
    },
  });

  // ---------- Défi entre amis : tout est dans l'adresse #jouer/defi/<code> ----------
  // Code : pour chaque proposition, son identifiant sans le « p » suivi d'une lettre de vote (o, s, n).
  const LETTRE = { pour: "o", partage: "s", contre: "n" }, DE_LETTRE = { o: "pour", s: "partage", n: "contre" };
  const coder = (paires) => paires.map(([id, v]) => id.slice(1) + LETTRE[v]).join(".");
  function decoder(code) {
    const items = String(code || "").split(".").map((s) => s.match(/^([0-9a-f]{3,12})([osn])$/)).filter(Boolean)
      .map((m) => ({ p: R.parId["p" + m[1]], v: DE_LETTRE[m[2]] })).filter((x) => x.p);
    return items.length >= 3 && items.length <= 10 ? items : null;
  }
  function partagerDefi(paires) {
    partager({ surtitre: "Défi à l'aveugle", corps: `J'ai jugé ${paires.length} idées sans savoir qui les a écrites. Serons-nous d'accord ?`,
      pied: "Votez à votre tour, puis découvrez nos réponses, les auteurs et les sources.",
      texte: `Je vous défie : ${paires.length} idées des programmes 2027, à juger sans savoir de qui elles viennent. Serons-nous d'accord ?`,
      ancre: `jouer/defi/${coder(paires)}` });
  }
  let df = R.lire("defi-en-cours", null);
  function afficherDefi(code) {
    const items = decoder(code), s = () => $("#jeu-defi");
    if (!items) {
      s().innerHTML = `<div class="scene"><p class="citation">Ce lien de défi est incomplet.</p><p class="aide">Demandez à la personne de vous le renvoyer, ou jouez seul.</p><div class="choix"><a class="btn principal" href="#jouer/aveugle">Jouer à l'aveugle</a></div></div>`;
      return;
    }
    if (df?.code !== code) { df = { code, rep: {} }; R.ecrire("defi-en-cours", df); }
    const i = items.findIndex((x) => !df.rep[x.p.id]);
    if (i >= 0) {
      const x = items[i];
      s().innerHTML = `<p class="aide">Quelqu'un vous défie : jugez ces ${items.length} idées sans savoir qui les a écrites. Vous verrez ensuite ses réponses.</p>
        <div class="scene"><p class="compteur">Idée ${i + 1} sur ${items.length}</p><p class="citation">« ${esc(x.p.citation)} »</p>${boutonsVote()}${caseCollectif()}</div>${annonce("defi")}`;
      s().querySelectorAll("[data-v]").forEach((b) => b.onclick = () => {
        df.rep[x.p.id] = b.dataset.v; R.ecrire("defi-en-cours", df); R.voter(x.p.id, b.dataset.v);
        afficherDefi(code); focaliser("#jeu-defi [data-v], #defi-renvoyer"); annoncer("defi", `Vote enregistré : ${VOTE[b.dataset.v]}.`);
      });
      return;
    }
    const accord = items.filter((x) => df.rep[x.p.id] === x.v).length;
    s().innerHTML = `<div class="scene"><p class="compteur">Résultat du défi</p>
      <p class="citation" aria-live="polite">Vous êtes d'accord sur ${accord} idée${accord > 1 ? "s" : ""} sur ${items.length}.</p>
      <ol class="defi-liste">${items.map((x) => `<li class="${df.rep[x.p.id] === x.v ? "accord" : ""}">
        <p>« ${esc(x.p.citation)} »</p>
        <p class="votes-compares">Vous : <b class="vote-${df.rep[x.p.id]}">${VOTE[df.rep[x.p.id]]}</b> · La personne qui vous défie : <b class="vote-${x.v}">${VOTE[x.v]}</b>${df.rep[x.p.id] === x.v ? ` <span class="etiquette">d'accord</span>` : ""}</p>
        <p>Cette idée vient de ${nomParti(x.p.candidature)}. <a href="#prop-${x.p.id}">Lire la source</a></p>
        <p class="ref">${R.refHTML(x.p.source)}</p></li>`).join("")}</ol>
      <p class="ref">Ce score compare ${items.length} votes. Il ne dit rien de vos raisons ni de vos priorités.</p>
      <div class="choix"><button class="btn principal" id="defi-renvoyer">Défier quelqu'un avec mes réponses</button><a class="btn" href="#jouer/aveugle">Continuer à l'aveugle</a></div>
      ${rebonds([["jouer/profil", "Votre profil d'idées en 24 votes"]])}</div>`;
    $("#defi-renvoyer").onclick = () => partagerDefi(items.map((x) => [x.p.id, df.rep[x.p.id]]));
  }

  // ---------- Qui a dit ça ? ----------
  $("#jeu-quiz").innerHTML = `<p class="aide">Devinez quelle force politique a écrit chaque proposition. Dix questions, par thème et par niveau.</p><div class="scene" id="scene-quiz"></div>${annonce("quiz")}`;
  let q = R.lire("quiz-partie", null);
  const sauverQuiz = () => R.ecrire("quiz-partie", q);
  const records = () => progres.quiz || {};
  // Une question par force tirée au hasard, pour ne pas surreprésenter les programmes les plus longs.
  function serieEquilibree(pool, n) {
    const parC = {}; pool.forEach((p) => (parC[p.candidature] ??= []).push(p));
    const out = [], forces = Object.keys(parC);
    for (let k = 0; out.length < n && k < n * 5; k++) {
      const liste = parC[forces[Math.floor(Math.random() * forces.length)]];
      const p = liste[Math.floor(Math.random() * liste.length)];
      if (!out.includes(p)) out.push(p);
    }
    return out;
  }
  function nouveauQuiz(niveau, theme, aBattre) {
    const liste = serieEquilibree(C.propositions.filter((p) => (theme === "tous" || p.theme === theme) && courte(p, 240) && lisible(p)), 10);
    const n = NIVEAUX[niveau].n;
    q = { cle: `${niveau}/${theme}`, niveau, theme, aBattre, ids: liste.map((p) => p.id), i: 0, score: 0, repondu: null,
      options: liste.map((p) => (n >= 8 ? IDS : R.melange([p.candidature, ...tirer(IDS.filter((c) => c !== p.candidature), n - 1)]))) };
    sauverQuiz();
  }
  function dessinerReglagesQuiz() {
    const r = records(), enCours = q && q.i < q.ids.length;
    $("#scene-quiz").innerHTML = `<form class="reglages-jeu" id="quiz-reglages">
      <fieldset><legend class="mini-titre">Niveau</legend><div class="choix">${Object.entries(NIVEAUX).map(([k, v], i) => `<label class="puce"><input type="radio" name="quiz-niveau" value="${k}" ${(q?.niveau || "moyen") === k ? "checked" : ""}> ${v.nom[0].toUpperCase() + v.nom.slice(1)} · ${v.aide}${r[k] != null ? ` · record ${r[k]}/10` : ""}</label>`).join("")}</div></fieldset>
      <label class="mini-titre" for="quiz-theme">Thème</label>
      <select id="quiz-theme" class="champ"><option value="tous">Tous les thèmes</option>${C.themes.map((t) => `<option value="${t.id}" ${q?.theme === t.id ? "selected" : ""}>${esc(t.nom)}</option>`).join("")}</select>
      <div class="choix"><button class="btn principal" type="submit">Commencer</button>${enCours ? `<a class="btn" href="#jouer/quiz/${q.cle}">Reprendre la partie (question ${q.i + 1} sur 10)</a>` : ""}</div></form>`;
    $("#quiz-reglages").onsubmit = (e) => {
      e.preventDefault();
      const niv = $('input[name="quiz-niveau"]:checked').value, th = $("#quiz-theme").value;
      if (q?.cle === `${niv}/${th}`) q = null; // « Commencer » lance toujours une nouvelle partie
      R.aller(`jouer/quiz/${niv}/${th}`);
    };
  }
  function dessinerQuiz() {
    const s = $("#scene-quiz"), niv = NIVEAUX[q.niveau];
    const contexte = `niveau ${niv.nom}${q.theme !== "tous" ? " · " + esc(R.nomTheme[q.theme]) : ""}`;
    if (q.i >= q.ids.length) {
      const r = { ...records() }; r[q.niveau] = Math.max(r[q.niveau] ?? 0, q.score); noter("quiz", r);
      const sc = q.score, tot = q.ids.length;
      s.innerHTML = `<p class="compteur">Terminé · ${contexte}</p><p class="citation" aria-live="polite">${R.pluriel(sc, "bonne réponse", "bonnes réponses")} sur ${tot}.</p>
        <p class="aide">Votre meilleur score au niveau ${niv.nom} : ${r[q.niveau]} sur 10.${q.aBattre != null ? ` Le score à battre était ${q.aBattre}.` : ""}</p>
        <div class="choix"><button class="btn principal" id="q-partager">Défier quelqu'un de faire mieux</button><button class="btn" id="rejouer">Rejouer</button><a class="btn" href="#jouer/quiz">Changer de niveau ou de thème</a></div>
        ${rebonds([["jouer/mots", "Jeu suivant : Qui emploie ce mot ?"]])}`;
      $("#rejouer").onclick = () => { nouveauQuiz(q.niveau, q.theme, null); dessinerQuiz(); focaliser("#scene-quiz [data-c]"); };
      $("#q-partager").onclick = () => partager({ surtitre: "Qui a dit ça ?", corps: `J'ai reconnu ${sc} propositions sur ${tot} au niveau ${niv.nom}. Ferez-vous mieux ?`,
        pied: "Devinez quelle force politique a écrit chaque proposition des programmes 2027.",
        texte: `J'ai reconnu ${sc}/${tot} propositions au quiz « Qui a dit ça ? », niveau ${niv.nom}. Ferez-vous mieux ?`, ancre: `jouer/quiz/${q.cle}/${sc}` });
      return;
    }
    const p = R.parId[q.ids[q.i]];
    s.innerHTML = `<p class="compteur">Question ${q.i + 1} sur ${q.ids.length} · score ${q.score} · ${contexte}${q.aBattre != null ? ` · à battre : ${q.aBattre}` : ""}</p>
      <p class="citation">« ${esc(p.citation)} »</p>
      <div class="choix">${q.options[q.i].map((c) => {
        let cl = "btn";
        if (q.repondu) cl += c === p.candidature ? " juste" : c === q.repondu ? " faux" : "";
        return `<button class="${cl}" data-c="${c}" ${q.repondu ? "disabled" : ""}>${sigle(c)} ${esc(cand[c].nom)}</button>`;
      }).join("")}</div>
      ${q.repondu ? `<div class="revelation"><p>${q.repondu === p.candidature ? "Bonne réponse." : `C'était ${nomParti(p.candidature)}.`}</p>
        <p class="ref">${R.refHTML(p.source)}</p>
        <div class="choix"><button class="btn principal" id="q-suite">${q.i + 1 < q.ids.length ? "Question suivante" : "Voir le score"}</button></div>
        ${rebonds(rebondsProp(p))}</div>` : ""}`;
    if (q.repondu) $("#q-suite").onclick = () => { q.i++; q.repondu = null; sauverQuiz(); dessinerQuiz(); focaliser("#scene-quiz [data-c]:not([disabled]), #q-partager"); };
    else s.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => {
      q.repondu = b.dataset.c; if (q.repondu === p.candidature) q.score++; sauverQuiz(); dessinerQuiz(); focaliser("#q-suite");
      annoncer("quiz", q.repondu === p.candidature ? "Bonne réponse." : `C'était ${cand[p.candidature].nom}.`);
    });
  }
  R.jeux.ajouter("quiz", "Qui a dit ça ?", {
    resume: "Une citation, plusieurs forces : laquelle l'a écrite ? Par thème, en trois niveaux.", duree: "3 minutes",
    etat() {
      if (q && q.i < q.ids.length) return `partie en cours, question ${q.i + 1} sur 10`;
      const r = records(), k = Object.keys(NIVEAUX).filter((x) => r[x] != null);
      return k.length ? "records : " + k.map((x) => `${x} ${r[x]}/10`).join(", ") : null;
    },
    afficher(args) {
      const [niv, th = "tous", ab] = (args || "").split("/");
      if (!NIVEAUX[niv]) return dessinerReglagesQuiz();
      const theme = R.nomTheme[th] ? th : "tous", aBattre = /^\d+$/.test(ab || "") ? Math.min(10, +ab) : null;
      if (!q || q.cle !== `${niv}/${theme}`) nouveauQuiz(niv, theme, aBattre);
      else if (aBattre != null) q.aBattre = aBattre;
      dessinerQuiz();
    },
  });

  // ---------- Qui emploie ce mot ? ----------
  // Des termes du glossaire employés par plusieurs forces, avec une force qui l'emploie nettement le plus.
  const usageDe = (v) => Object.entries(v.usage || {}).filter(([, n]) => n > 0);
  const totalUsage = (v) => usageDe(v).reduce((a, [, n]) => a + n, 0);
  const TERMES_JEU = R.VOCAB.filter((v) => {
    const u = usageDe(v), tot = totalUsage(v); if (u.length < 2 || tot < 3) return false;
    const max = Math.max(...u.map((x) => x[1]));
    return u.filter((x) => x[1] === max).length === 1 && max / tot <= 0.8;
  });
  const plusUsant = (v) => usageDe(v).sort((a, b) => b[1] - a[1])[0][0];
  function barresUsage(v, max = Math.max(1, ...usageDe(v).map((x) => x[1]))) {
    return `<ul class="usage-barres">${C.candidatures.map((c) => { const n = v.usage?.[c.id] || 0;
      return `<li class="${n ? "" : "zero"}">${sigle(c.id)}<span class="barre"><i style="width:${(n / max) * 100}%"></i></span><span class="n">${n}</span></li>`; }).join("")}</ul>`;
  }
  const exempleTerme = (v, c) => (v.propositions || []).map((id) => R.parId[id]).filter(Boolean).sort((a, b) => (b.candidature === c) - (a.candidature === c))[0];
  let mt = R.lire("mots-partie", null);
  const sauverMots = () => R.ecrire("mots-partie", mt);
  function nouveauxMots() {
    const edl = TERMES_JEU.filter((v) => v.registre === "élément de langage");
    const choisis = [...tirer(edl, 6)]; choisis.push(...tirer(TERMES_JEU.filter((v) => !choisis.includes(v)), 8 - choisis.length));
    mt = { ids: R.melange(choisis).map((v) => v.id), i: 0, score: 0, repondu: null,
      options: [] };
    mt.options = mt.ids.map((id) => {
      const v = R.parTerme[id], bon = plusUsant(v), autresUsants = usageDe(v).map((x) => x[0]).filter((c) => c !== bon);
      const un = tirer(autresUsants, 1);
      return R.melange([bon, ...un, ...tirer(IDS.filter((c) => c !== bon && !un.includes(c)), 3 - un.length)]);
    });
    sauverMots();
  }
  function dessinerMots() {
    const s = $("#scene-mots");
    if (mt.i >= mt.ids.length) {
      const record = Math.max(progres.mots ?? 0, mt.score); noter("mots", record);
      const sc = mt.score;
      s.innerHTML = `<p class="compteur">Terminé</p><p class="citation" aria-live="polite">${R.pluriel(sc, "mot trouvé", "mots trouvés")} sur ${mt.ids.length}.</p>
        <p class="aide">Votre meilleur score : ${record} sur ${mt.ids.length}.</p>
        <div class="choix"><button class="btn principal" id="m-partager">Défier quelqu'un</button><button class="btn" id="m-rejouer">Huit autres mots</button></div>
        ${rebonds([["jouer/paires", "Jeu suivant : Paires de mots"], ["vocab", "Tout le vocabulaire"]])}`;
      $("#m-rejouer").onclick = () => { nouveauxMots(); dessinerMots(); focaliser("#scene-mots [data-c]"); };
      $("#m-partager").onclick = () => partager({ surtitre: "Qui emploie ce mot ?", corps: `J'ai trouvé ${sc} mots sur ${mt.ids.length}. Les mots des programmes 2027 disent-ils qui parle ?`,
        pied: "Devinez quelle force emploie le plus chaque mot, puis lisez les citations.", texte: `J'ai trouvé ${sc}/${mt.ids.length} au jeu « Qui emploie ce mot ? ». À vous de jouer.`, ancre: "jouer/mots" });
      return;
    }
    const v = R.parTerme[mt.ids[mt.i]], bon = plusUsant(v), ex = exempleTerme(v, bon);
    s.innerHTML = `<p class="compteur">Mot ${mt.i + 1} sur ${mt.ids.length} · score ${mt.score}</p>
      <p class="mot-vedette">${esc(v.terme)}</p>
      ${(v.variantes || []).length ? `<p class="ref">Aussi : ${v.variantes.map(esc).join(", ")}</p>` : ""}
      <p class="aide">Quelle force l'emploie le plus dans ses textes ?</p>
      <div class="choix">${mt.options[mt.i].map((c) => {
        let cl = "btn";
        if (mt.repondu) cl += c === bon ? " juste" : c === mt.repondu ? " faux" : "";
        return `<button class="${cl}" data-c="${c}" ${mt.repondu ? "disabled" : ""}>${sigle(c)} ${esc(cand[c].nom)}</button>`;
      }).join("")}</div>
      ${mt.repondu ? `<div class="revelation"><p>${mt.repondu === bon ? "Bien vu." : `C'est ${nomParti(bon)} qui l'emploie le plus.`} ${esc(v.definition || "")}</p>
        <p class="mini-titre">Emplois relevés dans les textes, par force</p>${barresUsage(v)}
        ${ex ? `<p class="mini-titre">Un exemple</p><p class="exemple">« ${esc(ex.citation)} » ${sigle(ex.candidature)}</p><p class="ref">${R.refHTML(ex.source)}</p>` : ""}
        <div class="choix"><button class="btn principal" id="m-suite">${mt.i + 1 < mt.ids.length ? "Mot suivant" : "Voir le score"}</button></div>
        ${rebonds([[`terme-${v.id}`, "La fiche du mot"], v.notions?.[0] && R.parNotion[v.notions[0]] ? [`concept-${v.notions[0]}`, `Le concept : ${R.parNotion[v.notions[0]].nom}`] : null])}</div>` : ""}`;
    if (mt.repondu) $("#m-suite").onclick = () => { mt.i++; mt.repondu = null; sauverMots(); dessinerMots(); focaliser("#scene-mots [data-c]:not([disabled]), #m-partager"); };
    else s.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => {
      mt.repondu = b.dataset.c; if (mt.repondu === bon) mt.score++; sauverMots(); dessinerMots(); focaliser("#m-suite");
      annoncer("mots", mt.repondu === bon ? "Bien vu." : `C'est ${cand[bon].nom} qui l'emploie le plus.`);
    });
  }
  R.jeux.ajouter("mots", "Qui emploie ce mot ?", {
    resume: "Huit mots du débat public : devinez quelle force les emploie le plus.", duree: "3 minutes",
    etat: () => (mt && mt.i < mt.ids.length ? `partie en cours, mot ${mt.i + 1} sur 8` : progres.mots != null ? `record ${progres.mots}/8` : null),
    afficher() {
      if (!$("#scene-mots")) $("#jeu-mots").innerHTML = `<p class="aide">Les mots ne sont pas neutres. Pour chacun, devinez quelle force l'emploie le plus dans ses textes, puis lisez les comptages et un exemple.</p><div class="scene" id="scene-mots"></div>${annonce("mots")}`;
      if (!mt || mt.ids.some((id) => !R.parTerme[id])) nouveauxMots();
      dessinerMots();
    },
  });

  // ---------- Paires de mots ----------
  // Deux termes concurrents, tous deux au glossaire, employés par des forces différentes.
  const PAIRES = [];
  { const vues = new Set(), forces = (v) => usageDe(v).map((x) => x[0]).sort().join();
    R.VOCAB.forEach((v) => (v.concurrents || []).forEach((t) => {
      const w = R.parTerme[R.parNomTerme[R.sansAccent(t)]];
      if (!w || w.id === v.id) return;
      const k = [v.id, w.id].sort().join("|");
      if (vues.has(k) || totalUsage(v) < 2 || totalUsage(w) < 2 || forces(v) === forces(w)) return;
      vues.add(k); PAIRES.push([v.id, w.id]);
    })); }
  let pr = R.lire("paires-partie", null);
  const sauverPaires = () => R.ecrire("paires-partie", pr);
  function nouvellesPaires() {
    pr = { paires: tirer(PAIRES, 5).map((x) => R.melange(x)), i: 0, score: 0, total: 0, choix: { 0: [], 1: [] }, revele: false };
    sauverPaires();
  }
  function dessinerPaires() {
    const s = $("#scene-paires");
    if (pr.i >= pr.paires.length) {
      const record = Math.max(progres.paires ?? 0, pr.score); noter("paires", record);
      const sc = pr.score, tot = pr.total;
      s.innerHTML = `<p class="compteur">Terminé</p><p class="citation" aria-live="polite">Vous avez vu juste ${sc} fois sur ${tot}.</p>
        <p class="aide">Chaque case compte : une force cochée qui emploie le mot, ou laissée vide et qui ne l'emploie pas. Votre meilleur score : ${record} sur ${tot}.</p>
        <div class="choix"><button class="btn principal" id="pa-partager">Défier quelqu'un</button><button class="btn" id="pa-rejouer">Cinq autres paires</button></div>
        ${rebonds([["jouer/profil", "Jeu suivant : votre profil d'idées"], ["vocab", "Tout le vocabulaire"]])}`;
      $("#pa-rejouer").onclick = () => { nouvellesPaires(); dessinerPaires(); };
      $("#pa-partager").onclick = () => partager({ surtitre: "Paires de mots", corps: `Deux mots pour une même chose : qui dit lequel ? J'ai vu juste ${sc} fois sur ${tot}.`,
        pied: "Devinez quelles forces emploient chaque mot, puis comparez ce que chacun met en avant.", texte: `Deux mots pour une même chose : qui dit lequel ? J'ai vu juste ${sc} fois sur ${tot}. À vous.`, ancre: "jouer/paires" });
      return;
    }
    const [a, b] = pr.paires[pr.i].map((id) => R.parTerme[id]), mots = [a, b];
    const colonne = (v, k) => `<div class="paire-mot duel-${k ? "b" : "a"}"><p class="mot-vedette">${esc(v.terme)}</p>
      ${pr.revele ? `<span class="lecture">Ce que le mot met en avant</span><p class="def">${esc(v.lecture || v.definition || "")}</p><p><a href="#terme-${v.id}">La fiche de ce mot</a></p>`
      : `<p class="def">${esc(v.definition || "")}</p><p class="mini-titre" id="pa-q-${k}">Qui l'emploie ? Cochez une ou plusieurs forces.</p>
        <div class="choix" role="group" aria-labelledby="pa-q-${k}">${IDS.map((c) => `<button class="puce" data-cote="${k}" data-c="${c}" aria-pressed="${pr.choix[k].includes(c)}" data-actif="${pr.choix[k].includes(c)}">${esc(cand[c].sigle)}<span class="lecteur-seul"> ${esc(cand[c].nom)}</span></button>`).join("")}</div>`}</div>`;
    // Révélation en miroir : une ligne par force, le premier mot à gauche, le second à droite,
    // et une phrase qui dit d'abord qui emploie quoi.
    let tableau = "";
    if (pr.revele) {
      const max = Math.max(1, ...mots.flatMap((v) => usageDe(v).map((x) => x[1])));
      const qui = (v) => { const u = usageDe(v).sort((x, y) => y[1] - x[1]); return u.length ? u.slice(0, 3).map(([c]) => esc(cand[c].nom)).join(", ") + (u.length > 3 ? ` et ${u.length - 3} autre${u.length > 4 ? "s" : ""}` : "") : "aucune force"; };
      const marque = (k, c) => { const n = mots[k].usage?.[c] || 0, coche = pr.choix[k].includes(c), juste = coche === n > 0;
        return `<span class="pm-marque ${juste ? "ok" : "ko"}" title="${coche ? "Vous l'aviez coché" : "Vous ne l'aviez pas coché"}${juste ? "" : ", à revoir"}">${juste ? "✓" : "✗"}<span class="lecteur-seul">${juste ? " bonne réponse" : " erreur"}</span></span>`; };
      const ligne = (c) => { const na = a.usage?.[c] || 0, nb = b.usage?.[c] || 0;
        return `<div class="pm-ligne${na || nb ? "" : " pm-vide"}">
          ${marque(0, c)}<span class="pm-n">${na || ""}</span><span class="pm-barre pm-a"><i style="width:${(na / max) * 100}%"></i></span>
          <span class="pm-force">${sigle(c)}</span>
          <span class="pm-barre pm-b"><i style="width:${(nb / max) * 100}%"></i></span><span class="pm-n">${nb || ""}</span>${marque(1, c)}</div>`; };
      tableau = `<p class="pm-phrase"><strong>« ${esc(a.terme)} »</strong> revient surtout chez ${qui(a)}. <strong>« ${esc(b.terme)} »</strong> revient surtout chez ${qui(b)}.</p>
        <div class="pm" role="img" aria-label="Nombre d'emplois de chaque mot, force par force">
          <div class="pm-ligne pm-tete"><span></span><span></span><span class="pm-mot pm-a">${esc(a.terme)}</span><span></span><span class="pm-mot pm-b">${esc(b.terme)}</span><span></span><span></span></div>
          ${IDS.map(ligne).join("")}</div>
        <p class="ref">Longueur des barres : nombre d'emplois dans les textes lus. ✓ votre réponse correspond aux textes, ✗ elle ne correspond pas.</p>`;
    }
    s.innerHTML = `<p class="compteur">Paire ${pr.i + 1} sur ${pr.paires.length} · score ${pr.score}${pr.total ? " sur " + pr.total : ""}</p>
      <div class="duel-cols paire">${colonne(a, 0)}${colonne(b, 1)}</div>
      ${pr.revele ? `<div class="revelation">${tableau}<div class="choix"><button class="btn principal" id="pa-suite">${pr.i + 1 < pr.paires.length ? "Paire suivante" : "Voir le score"}</button></div></div>`
      : `<div class="choix"><button class="btn principal" id="pa-reveler">Révéler</button></div>`}`;
    s.querySelectorAll("[data-cote]").forEach((bt) => bt.onclick = () => {
      const l = pr.choix[bt.dataset.cote], c = bt.dataset.c, i = l.indexOf(c);
      if (i >= 0) l.splice(i, 1); else l.push(c);
      bt.setAttribute("aria-pressed", i < 0); bt.dataset.actif = i < 0; sauverPaires();
    });
    $("#pa-reveler")?.addEventListener("click", () => {
      let justes = 0;
      mots.forEach((v, k) => IDS.forEach((c) => { if (pr.choix[k].includes(c) === (v.usage?.[c] || 0) > 0) justes++; }));
      pr.score += justes; pr.total += 16; pr.revele = true; sauverPaires(); dessinerPaires(); focaliser("#pa-suite");
      annoncer("paires", `Vous avez vu juste sur ${justes} cases sur 16.`);
    });
    $("#pa-suite")?.addEventListener("click", () => { pr.i++; pr.revele = false; pr.choix = { 0: [], 1: [] }; sauverPaires(); dessinerPaires(); $("#scene-paires").scrollIntoView({ block: "start" }); });
  }
  R.jeux.ajouter("paires", "Paires de mots", {
    resume: "Deux mots pour une même réalité : qui dit lequel, et qu'est-ce que chacun met en avant ?", duree: "4 minutes",
    etat: () => (pr && pr.i < pr.paires.length ? `partie en cours, paire ${pr.i + 1} sur 5` : progres.paires != null ? `record ${progres.paires}/80` : null),
    afficher() {
      if (!$("#scene-paires")) $("#jeu-paires").innerHTML = `<p class="aide">Deux mots concurrents, côte à côte. Cochez les forces qui emploient chacun, puis comparez les comptages et ce que chaque mot met en avant.</p><div class="scene scene-large" id="scene-paires"></div>${annonce("paires")}`;
      if (!pr || pr.paires.flat().some((id) => !R.parTerme[id])) nouvellesPaires();
      dessinerPaires();
    },
  });

  // ---------- Votre profil d'idées ----------
  // 24 propositions courtes, 3 par force, réparties sur les 9 thèmes ; vote à l'aveugle.
  function tirerProfil() {
    const themes = R.melange(C.themes.map((t) => t.id)), compte = Object.fromEntries(themes.map((t) => [t, 0])), ids = [];
    let k = 0;
    for (const c of R.melange(IDS)) {
      const pris = new Set();
      for (let j = 0; j < 3; j++) {
        const ordre = [themes[k++ % themes.length], ...[...themes].sort((x, y) => compte[x] - compte[y])].filter((t) => !pris.has(t));
        let p = null;
        for (const [max, net] of [[180, true], [260, true], [260, false], [2000, false]]) {
          for (const t of ordre) {
            const pool = C.propositions.filter((x) => x.candidature === c && x.theme === t && courte(x, max) && (!net || lisible(x)) && !ids.includes(x.id));
            if (pool.length) { p = pool[Math.floor(Math.random() * pool.length)]; break; }
          }
          if (p) break;
        }
        if (p) { ids.push(p.id); pris.add(p.theme); compte[p.theme]++; }
      }
    }
    return R.melange(ids);
  }
  let pf = R.lire("profil-test", null);
  const sauverProfil = () => R.ecrire("profil-test", pf);
  const NE_MESURE_PAS = "Ce test porte sur 24 idées parmi plus de 3 000. Il ne mesure ni vos priorités, ni votre avis sur les personnes.";
  function resultatsProfil() {
    const items = pf.ids.map((id) => R.parId[id]).filter(Boolean);
    const themes = C.themes.map((t) => ({ t, items: items.filter((p) => p.theme === t.id) })).filter((x) => x.items.length);
    const parForce = IDS.map((c) => ({ c, n: items.filter((p) => p.candidature === c && pf.rep[p.id] === "pour").length, sur: items.filter((p) => p.candidature === c).length }));
    return { items, themes, parForce };
  }
  const titreIdee = (p) => p.intitule || tronque(p.citation, 90);
  function texteProfil() {
    const { themes, parForce } = resultatsProfil();
    const groupes = [...new Set(parForce.map((x) => x.n))].sort((a, b) => b - a);
    return [`Votre profil d'idées, établi le ${date(new Date(pf.fini || Date.now()))} sur République des mots.`,
      `${pf.ids.length} propositions des programmes 2027 jugées à l'aveugle, 3 par force politique.`, "",
      ...themes.flatMap(({ t, items }) => [t.nom.toUpperCase(), ...items.map((p) => `- ${VOTE[pf.rep[p.id]][0].toUpperCase() + VOTE[pf.rep[p.id]].slice(1)} : « ${p.citation} »\n  ${cand[p.candidature].nom} ; ${p.source.titre}, ${R.page(p.source)}, ${p.source.date}`), ""]),
      "LES FORCES DONT VOUS AVEZ APPROUVÉ LE PLUS D'IDÉES DANS CE TEST",
      ...groupes.map((n) => `${n} sur 3 : ${parForce.filter((x) => x.n === n).map((x) => cand[x.c].nom).join(", ")}`), "",
      NE_MESURE_PAS].join("\n").replace(/https?:\/\/|www\./gi, ""); // l'envoi par e-mail refuse les liens
  }
  function htmlProfil() {
    const { themes, parForce } = resultatsProfil(), groupes = [...new Set(parForce.map((x) => x.n))].sort((a, b) => b - a);
    return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Mon profil d'idées · République des mots</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:2em auto;padding:0 16px;line-height:1.5;color:#1b2130}h1,h2{font-family:system-ui,sans-serif}li{margin:.6em 0}.ref{font-size:.85em;color:#5a6275}b.pour{color:#1f7a52}b.contre{color:#b4372f}b.partage{color:#8a6d12}</style>
<h1>Mon profil d'idées</h1><p>Établi le ${date(new Date(pf.fini || Date.now()))} sur <a href="https://republique.fr/#jouer/profil">République des mots</a>. ${pf.ids.length} propositions des programmes 2027 jugées à l'aveugle, 3 par force politique.</p>
${themes.map(({ t, items }) => `<h2>${esc(t.nom)}</h2><ul>${items.map((p) => `<li><b class="${pf.rep[p.id]}">${VOTE[pf.rep[p.id]]}</b> · « ${esc(p.citation)} »<br><span class="ref">${esc(cand[p.candidature].nom)} · ${R.refHTML(p.source)}</span></li>`).join("")}</ul>`).join("")}
<h2>Les forces dont vous avez approuvé le plus d'idées dans ce test</h2><ul>${groupes.map((n) => `<li>${n} sur 3 : ${parForce.filter((x) => x.n === n).map((x) => esc(cand[x.c].nom)).join(", ")}</li>`).join("")}</ul>
<p class="ref">${esc(NE_MESURE_PAS)}</p></html>`;
  }
  // Graphique en étoile : un rayon par force, dans l'ordre fixe du site (jamais trié), de 0 à 3 idées approuvées.
  function radarProfil(parForce) {
    const n = parForce.length, R0 = 110, cx = 170, cy = 150, ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))].map((v) => v.toFixed(1)).join(",");
    const anneaux = [1, 2, 3].map((k) => `<polygon points="${parForce.map((_, i) => pt(i, (R0 * k) / 3)).join(" ")}" class="rd-anneau"/>`).join("");
    const rayons = parForce.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R0).split(",")[0]}" y2="${pt(i, R0).split(",")[1]}" class="rd-rayon"/>`).join("");
    const forme = `<polygon points="${parForce.map((x, i) => pt(i, (R0 * x.n) / 3)).join(" ")}" class="rd-forme"/>`;
    const points = parForce.map((x, i) => { const [px, py] = pt(i, (R0 * x.n) / 3).split(","); return `<circle cx="${px}" cy="${py}" r="4" class="rd-point"><title>${esc(cand[x.c].nom)} : ${x.n} sur ${x.sur}</title></circle>`; }).join("");
    const etiquettes = parForce.map((x, i) => {
      const [lx, ly] = pt(i, R0 + 24).split(",").map(Number), ancre = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
      return `<text x="${lx}" y="${ly + 4}" text-anchor="${ancre}" class="rd-etiquette">${esc(cand[x.c].sigle)} <tspan class="rd-n">${x.n}/${x.sur}</tspan></text>`;
    }).join("");
    const graduations = [1, 2, 3].map((k) => `<text x="${cx + 4}" y="${cy - (R0 * k) / 3 + 3}" class="rd-grad">${k}</text>`).join("");
    return `<figure class="radar"><svg viewBox="0 0 340 300" role="img" aria-labelledby="rd-desc">${anneaux}${rayons}${forme}${points}${graduations}${etiquettes}</svg>
      <figcaption id="rd-desc" class="ref">Un rayon par force politique, toujours dans le même ordre. Plus le point s'éloigne du centre, plus vous avez approuvé d'idées de cette force (de 0 à 3). ${parForce.map((x) => `${esc(cand[x.c].nom)} : ${x.n} sur ${x.sur}`).join(" ; ")}.</figcaption></figure>`;
  }
  function dessinerProfil() {
    const s = $("#scene-profil");
    if (!pf) {
      s.innerHTML = `<p class="compteur">Environ 6 minutes</p>
        <p class="citation">De quelles idées êtes-vous proche ?</p>
        <p>Établissez votre profil d'idées : 24 propositions tirées des programmes, 3 par force politique, réparties sur les 9 thèmes. Vous votez sans savoir qui les a écrites. Le résultat montre, thème par thème, les idées que vous avez approuvées.</p>
        <p class="ref">${esc(NE_MESURE_PAS)}</p>
        <div class="choix"><button class="btn principal" id="pf-commencer">Commencer</button></div>`;
      $("#pf-commencer").onclick = () => { pf = { ids: tirerProfil(), rep: {}, debut: Date.now() }; sauverProfil(); dessinerProfil(); focaliser("#scene-profil [data-v]"); };
      return;
    }
    const i = pf.ids.findIndex((id) => !pf.rep[id]);
    if (i >= 0) {
      const p = R.parId[pf.ids[i]];
      s.innerHTML = `<p class="compteur">Idée ${i + 1} sur ${pf.ids.length} · ${esc(R.nomTheme[p.theme] || "")}</p>
        <div class="progression" role="progressbar" aria-valuemin="0" aria-valuemax="${pf.ids.length}" aria-valuenow="${i}" aria-label="Avancement du test"><i style="width:${(i / pf.ids.length) * 100}%"></i></div>
        <p class="citation">« ${esc(p.citation)} »</p>${boutonsVote()}
        <div class="choix">${i > 0 ? `<button class="lien-partage" id="pf-retour">Revenir à l'idée précédente</button>` : ""}<button class="lien-partage" id="pf-abandon">Recommencer avec d'autres idées</button></div>
        ${caseCollectif()}`;
      s.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => {
        pf.rep[p.id] = b.dataset.v; R.voter(p.id, b.dataset.v);
        if (pf.ids.every((id) => pf.rep[id])) { pf.fini = Date.now(); noter("profil", { fait: new Date().toISOString().slice(0, 10) }); }
        sauverProfil(); dessinerProfil(); focaliser("#scene-profil [data-v], #pf-telecharger");
        annoncer("profil", `Vote enregistré : ${VOTE[b.dataset.v]}.`);
      });
      $("#pf-retour")?.addEventListener("click", () => { delete pf.rep[pf.ids[i - 1]]; sauverProfil(); dessinerProfil(); });
      $("#pf-abandon").onclick = () => { pf = null; sauverProfil(); dessinerProfil(); };
      return;
    }
    const { themes, parForce } = resultatsProfil(), groupes = [...new Set(parForce.map((x) => x.n))].sort((a, b) => b - a);
    const voteLabel = (v) => `<b class="vote-${v}">${VOTE[v]}</b>`;
    s.innerHTML = `<p class="compteur">Votre profil d'idées · ${date(new Date(pf.fini || Date.now()))}</p>
      <p class="citation" aria-live="polite">Thème par thème, les idées que vous avez approuvées.</p>
      <div class="profil-themes">${themes.map(({ t, items }) => {
        const ok = items.filter((p) => pf.rep[p.id] === "pour");
        return `<article class="carte"><h3>${esc(t.nom)}</h3>
          <p>${ok.length ? `Sur ce thème, vous avez approuvé surtout : ${ok.map((p) => `<strong>${esc(titreIdee(p))}</strong>`).join(" ; ")}.` : "Sur ce thème, vous n'avez approuvé aucune des idées proposées."}</p>
          <ul class="liste-idees">${items.map((p) => `<li>${voteLabel(pf.rep[p.id])} « ${esc(tronque(p.citation, 140))} » ${sigle(p.candidature)} <a href="#prop-${p.id}">source</a></li>`).join("")}</ul></article>`;
      }).join("")}</div>
      <section class="carte bloc-jeu" aria-labelledby="pf-forces"><h3 id="pf-forces">Les forces dont vous avez approuvé le plus d'idées dans ce test</h3>
        ${radarProfil(parForce)}
        <details><summary class="plus">Voir en liste</summary><ul class="profil-forces">${groupes.map((n) => `<li><span class="n">${n} sur 3</span><span>${parForce.filter((x) => x.n === n).map((x) => `${sigle(x.c)} ${esc(cand[x.c].nom)}`).join(", ")}</span></li>`).join("")}</ul></details>
        <p class="ref">Trois idées par force : l'échantillon est petit, et une idée approuvée ne dit pas qu'on approuve tout un programme.</p></section>
      <p class="ref">${esc(NE_MESURE_PAS)}</p>
      <div class="choix"><button class="btn principal" id="pf-telecharger">Télécharger mes résultats</button><button class="btn" id="pf-courriel" aria-expanded="false" aria-controls="pf-email">Recevoir par e-mail</button><button class="btn" id="pf-partager">Partager</button><button class="btn" id="pf-refaire">Refaire avec 24 autres idées</button></div>
      <form class="carte bloc-jeu" id="pf-email" hidden>
        <label class="mini-titre" for="pf-adresse">Votre adresse e-mail</label>
        <input class="champ" type="email" id="pf-adresse" required autocomplete="email">
        <p class="ref">Votre adresse sert seulement à cet envoi, elle n'est pas gardée. Le message contient vos votes, les citations et leurs sources.</p>
        <div class="choix"><button class="btn principal" type="submit">Envoyer</button><span class="ref" id="pf-email-etat" role="status"></span></div>
      </form>
      ${rebonds([["jouer/aveugle", "Continuer à l'aveugle"], ["matrice", "Comparer les programmes thème par thème"]])}`;
    $("#pf-telecharger").onclick = () => R.telecharger?.(`profil-idees-${new Date(pf.fini || Date.now()).toISOString().slice(0, 10)}.html`, htmlProfil(), "text/html");
    $("#pf-courriel").onclick = (e) => { const f = $("#pf-email"); f.hidden = !f.hidden; e.target.setAttribute("aria-expanded", !f.hidden); if (!f.hidden) $("#pf-adresse").focus(); };
    $("#pf-email").onsubmit = async (e) => {
      e.preventDefault();
      const etat = $("#pf-email-etat"); etat.textContent = "Envoi…";
      const r = await R.api("resultats-email", { email: $("#pf-adresse").value.trim(), resume: texteProfil() });
      etat.textContent = !r ? "L'envoi n'est pas possible pour le moment. Vous pouvez télécharger vos résultats." : r.ok ? "C'est envoyé. Votre adresse n'a pas été gardée." : r.erreur || "L'envoi a échoué.";
      if (r?.ok) $("#pf-adresse").value = "";
    };
    $("#pf-partager").onclick = () => partager({ surtitre: "Votre profil d'idées", corps: "J'ai jugé 24 idées à l'aveugle. Et vous ?",
      pied: "24 propositions des programmes 2027, sans le nom de leurs auteurs. Le résultat, thème par thème.",
      texte: "J'ai jugé 24 idées des programmes 2027 à l'aveugle, sans savoir qui les a écrites. Et vous ?", ancre: "jouer/profil" });
    $("#pf-refaire").onclick = () => { pf = null; sauverProfil(); dessinerProfil(); };
  }
  R.jeux.ajouter("profil", "Votre profil d'idées", {
    resume: "24 idées à l'aveugle, puis le profil des idées que vous avez approuvées, thème par thème.", duree: "6 minutes",
    etat() {
      if (pf && !pf.fini) return `idée ${Object.keys(pf.rep).length + 1} sur 24`;
      return progres.profil?.fait ? `fait le ${date(new Date(progres.profil.fait))}` : null;
    },
    afficher() {
      if (!$("#scene-profil")) $("#jeu-profil").innerHTML = `<div class="scene scene-large" id="scene-profil"></div>${annonce("profil")}`;
      if (pf && pf.ids.some((id) => !R.parId[id])) pf = null;
      dessinerProfil();
    },
  });

  // Le défi arrive par un lien reçu : son onglet n'apparaît que lorsqu'il est ouvert.
  R.jeux.ajouter("defi", "Défi", { cache: true, afficher: afficherDefi });

  R.partageurs.aveugle = (id) => {
    const p = R.parId[id]; if (!p) return null;
    return { surtitre: "Pour ou contre ?", corps: `« ${p.citation} »`, pied: "Devinez quel parti l'a proposé, puis votez à l'aveugle.", texte: `Pour ou contre ? « ${p.citation} » Devinez quel parti l'a proposé.`, ancre: "jouer/aveugle", defi: true };
  };
});
