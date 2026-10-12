// Test « Ta boussole d'idées », style « Glisse » : une carte par dilemme, qu'on glisse vers son choix.
// Le test est fait de plusieurs séries de 16 dilemmes (4 axes chacune) qui s'additionnent en un profil global.
// Rien n'est envoyé : les réponses vivent dans l'adresse, ce qui permet le bouton retour et le rechargement sans perdre sa place.
//   #commencer                  série 1 depuis le début (#commencer=2 pour la série 2…)
//   #q=<rep>&s=2                série 2 en cours ; <rep> = une lettre par dilemme : « a », « b » ou « 0 » (ça dépend)
//   #r=<rep>&s=2                résultat de la série 2
//   #global                     profil global, toutes séries faites additionnées
//   &t1=<rep>&t3=<rep>          séries déjà faites, portées d'un écran à l'autre
//   &defi=anbb                  portrait en 4 lettres de la personne qui invite, pour la série jouée
// Sans « s », la série est la 1 : les anciens liens (#q=…, #r=…) restent valables.
// Sur demande seulement (case « Garder sur ce téléphone »), les séries faites sont aussi gardées dans le stockage local
// du navigateur, sur l'appareil : jamais envoyées, effaçables d'un geste.
// Graphiques en étoile : etoile.js (règles de lecture expliquées en tête de ce fichier).
"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const scene = $("#scene");
  const accueil = scene.innerHTML;
  const URL_SITE = "https://republique.fr";
  const SEUIL = 4; // en dessous de 4 dilemmes comparés, un rapprochement avec un parti n'est pas lisible
  const MENTION = "Ni sondage ni consigne de vote : un résumé de tes réponses, pas de ta personne.";
  const CLE = "boussole-idees";
  const calme = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let D = null;
  // Côté de chaque option, tiré au hasard une fois par visite : la même famille d'idées n'est pas toujours à gauche.
  const inverse = {};
  // Séries dont le résultat affiché vient de réponses données dans cette page (rien n'est stocké côté serveur) :
  // un lien « #r=… » ouvert directement est signalé comme tel, pour qu'on ne fasse pas passer un résultat fabriqué pour le sien.
  const parcouru = new Set();

  const annoncer = (t) => { $("#annonce").textContent = ""; setTimeout(() => { $("#annonce").textContent = t; }, 30); };

  // ---------- Mémoire volontaire sur l'appareil ----------
  const memoire = {
    lire() { try { return JSON.parse(localStorage.getItem(CLE) || "null"); } catch { return null; } },
    garder(acquis) { try { localStorage.setItem(CLE, JSON.stringify({ acquis, date: new Date().toISOString().slice(0, 10) })); return true; } catch { return false; } },
    effacer() { try { localStorage.removeItem(CLE); } catch { /* rien à effacer */ } },
  };

  // ---------- État dans l'adresse ----------
  function lireEtat() {
    const p = {};
    decodeURIComponent(location.hash.slice(1)).split("&").filter(Boolean).forEach((x) => { const i = x.indexOf("="); if (i < 0) p[x] = ""; else p[x.slice(0, i)] = x.slice(i + 1); });
    const e = { mode: "accueil", s: 1, rep: "", acquis: {}, defi: /^[anb]{4}$/.test(p.defi || "") ? p.defi : "" };
    if (/^\d$/.test(p.s || "")) e.s = +p.s;
    for (const k of Object.keys(p)) { const m = k.match(/^t(\d)$/); if (m && /^[ab0]+$/.test(p[k])) e.acquis[+m[1]] = p[k]; }
    if ("commencer" in p) { e.mode = "q"; if (/^\d$/.test(p.commencer)) e.s = +p.commencer; }
    else if ("q" in p && /^[ab0]*$/.test(p.q)) { e.mode = "q"; e.rep = p.q; }
    else if ("r" in p && /^[ab0]+$/.test(p.r)) { e.mode = "r"; e.rep = p.r; }
    else if ("global" in p) e.mode = "global";
    return e;
  }
  let etat = lireEtat();
  // Adresse d'un écran : les séries acquises suivent toujours.
  function lien({ mode = "accueil", s = 1, rep = "", acquis = etat.acquis, defi = "" } = {}) {
    const parts = [];
    if (mode === "q") parts.push(rep ? `q=${rep}` : `commencer${s > 1 ? `=${s}` : ""}`);
    if (mode === "r") parts.push(`r=${rep}`);
    if (mode === "global") parts.push("global");
    if ((mode === "q" && rep) || mode === "r") if (s > 1) parts.push(`s=${s}`);
    Object.keys(acquis).sort().forEach((k) => { if (!(mode === "r" && +k === s)) parts.push(`t${k}=${acquis[k]}`); });
    if (defi) parts.push(`defi=${defi}`);
    return "#" + parts.join("&");
  }
  const aller = (o) => { location.hash = lien(o); };

  async function charger() {
    if (D) return D;
    const r = await fetch("donnees.json", { cache: "no-cache" });
    D = await r.json();
    D.parti = Object.fromEntries(D.partis.map((p) => [p.id, p]));
    D.series.forEach((se, i) => {
      se.n = i + 1;
      se.iAxe = Object.fromEntries(se.axes.map((a, k) => [a.id, k]));
      se.dilemmes.forEach((d) => { inverse[d.id] = Math.random() < 0.5; d.serie = se; });
    });
    return D;
  }
  const serie = (n) => D.series[n - 1];
  // Ne garde que les séries dont le nombre de réponses est juste (un lien abîmé ne casse rien).
  // Séries faites : celles de l'adresse, complétées par celles gardées sur l'appareil (si la personne l'a choisi).
  // Une série reprise de l'appareil vient de ses propres réponses : pas d'avertissement « ouvert depuis un lien ».
  function acquisComplet(acquis) {
    const m = memoire.lire()?.acquis || {};
    Object.keys(m).forEach((k) => { if (!acquis[k] || acquis[k] === m[k]) parcouru.add(+k); });
    return nettoyer({ ...m, ...acquis });
  }
  const nettoyer = (acquis) => Object.fromEntries(Object.entries(acquis).filter(([k, v]) => serie(+k) && v.length === serie(+k).dilemmes.length));

  // ---------- Calculs ----------
  // Par axe : nombre de choix « a » et « b » (0 à 4), score moyen de -1 (tout a) à +1 (tout b), état a / n / b.
  function scores(se, rep) {
    return se.axes.map((axe) => {
      let na = 0, nb = 0;
      se.dilemmes.forEach((d, i) => { if (d.axe !== axe.id) return; if (rep[i] === "a") na++; else if (rep[i] === "b") nb++; });
      const n = na + nb, s = n ? (nb - na) / n : 0;
      return { axe, na, nb, n, s, etat: s <= -0.5 ? "a" : s >= 0.5 ? "b" : "n" };
    });
  }
  // Proximité : sur les dilemmes où le parti tranche dans ses textes ET où tu as tranché, combien de choix identiques.
  // Tri lissé (accord + 1) / (comparés + 2) : un 5 sur 5 ne passe pas devant un 15 sur 16 ; le compte brut reste affiché.
  function proximites(dilemmes, rep) {
    return D.partis.map((p) => {
      let accord = 0, compares = 0;
      const cases = dilemmes.map((d, i) => {
        const pos = d.positions[p.id];
        if (!pos) return "muet";
        if (!"ab".includes(rep[i])) return "passe";
        compares++;
        if (pos.choix === rep[i]) { accord++; return "accord"; }
        return "desaccord";
      });
      return { p, accord, compares, cases, taux: compares ? accord / compares : 0, lisse: (accord + 1) / (compares + 2), faible: compares < SEUIL };
    });
  }
  const trier = (px) => [...px].sort((x, y) => (x.faible - y.faible) || (y.lisse - x.lisse) || (y.compares - x.compares));

  // ---------- Morceaux d'interface ----------
  const etoileLecteur = (se, sc, opts = {}) => Etoile.profil([
    ...(opts.avec ? [{ ...Etoile.depuisCode(opts.avec), sorte: "contour" }] : []),
    { v: sc.map((x) => [x.na, x.nb]), muet: sc.map((x) => !x.n), sorte: "plein" },
  ], { axes: se.axes, titre: opts.titre });
  const lectureAxe = (x) => (x.n ? (x.etat === "n" ? `${x.axe.nom} : des deux côtés, ${x.na} et ${x.nb}` : `${x.axe.nom} : ${x.axe[x.etat]}, ${Math.max(x.na, x.nb)} sur ${x.n}`) : `${x.axe.nom} : sans réponse`);
  const motAxe = (x) => (x.n ? (x.etat === "n" ? "Des deux côtés" : x.axe[x.etat]) : "Tu as passé");
  const tutoyer = (t) => t.replace(/^Vous penchez/, "Tu penches").replace(/\bvous\b/g, "tu").replace(/\bvos\b/g, "tes").replace(/\bvotre\b/g, "ton");
  const segments = (se, rep, i) => `<div class="segments" aria-hidden="true">${se.dilemmes.map((d, k) => `<span class="g${se.iAxe[d.axe] + 1}${k < i ? " fait" : ""}${rep[k] === "0" ? " passe" : ""}"></span>`).join("")}</div>`;
  const tuilesAxes = (sc) => `<div class="axes-res">${sc.map((x, i) => `<div class="axe-res g${i + 1}${x.etat === "n" ? " nuance" : ""}${x.n ? "" : " vide"}"><span class="nom">${esc(x.axe.nom)}</span><strong>${esc(motAxe(x))}</strong><span class="compte-axe">${x.n ? (x.etat === "n" ? `${x.na} et ${x.nb}` : `${Math.max(x.na, x.nb)} sur ${x.n}`) : "&nbsp;"}</span></div>`).join("")}</div>`;
  const nbFaites = (acquis) => Object.keys(acquis).length;

  // Liste des séries, avec leur état : faite, à faire. Sert à l'accueil et sous chaque résultat.
  function listeSeries(acquis, courante = 0) {
    return `<ol class="series">${D.series.map((se) => {
      const faite = !!acquis[se.n];
      const lienSerie = faite && se.n !== courante ? lien({ mode: "r", s: se.n, rep: acquis[se.n], acquis }) : lien({ mode: "q", s: se.n, acquis });
      return `<li class="serie${faite ? " faite" : ""}${se.n === courante ? " ici" : ""}"><a href="${lienSerie}">
        <span class="num">${se.n}</span>
        <span class="txt"><strong>${esc(se.court)}</strong><small>${se.axes.map((a) => esc(a.nom)).join(" · ")}</small></span>
        <span class="etat">${se.n === courante ? "ici" : faite ? "✓ faite" : "16 cartes →"}</span></a></li>`;
    }).join("")}</ol>`;
  }
  function blocGarder() {
    const m = memoire.lire();
    return `<label class="garder"><input type="checkbox" id="garder"${m ? " checked" : ""}><span><strong>Garder mes séries sur ce téléphone</strong><small>Pour compléter ton profil plus tard. Rien ne part sur internet ; décoche pour tout effacer.</small></span></label>`;
  }
  function brancherGarder(acquis) {
    const c = $("#garder");
    if (!c) return;
    if (c.checked) memoire.garder(acquis);
    c.addEventListener("change", () => {
      if (c.checked) { memoire.garder(acquis); annoncer("Tes séries sont gardées sur ce téléphone."); }
      else { memoire.effacer(); annoncer("Effacé de ce téléphone."); }
    });
  }

  // ---------- Écrans ----------
  async function dessinerAccueil() {
    scene.innerHTML = accueil;
    document.title = "Ta boussole d'idées · République des mots 2027";
    const zone = scene.querySelector(".accueil");
    if (etat.defi) {
      const b = document.createElement("p");
      b.className = "bandeau";
      b.innerHTML = `<strong>On te lance un défi.</strong> Fais le test : à la fin, tu verras où vos deux boussoles divergent. Aucun parti dans la comparaison, rien n'est enregistré.`;
      zone.prepend(b);
      scene.querySelector('a[href="#commencer"]').setAttribute("href", `#commencer&defi=${etat.defi}`);
    }
    try { await charger(); } catch { return; }
    const m = memoire.lire();
    const acquis = acquisComplet(etat.acquis);
    etat.acquis = acquis;
    const n = nbFaites(acquis);
    const bloc = document.createElement("div");
    bloc.className = "bloc-series";
    bloc.innerHTML = `<h2>${n ? `Ton profil : ${n} série${n > 1 ? "s" : ""} sur ${D.series.length}` : `${D.series.length} séries qui s'additionnent`}</h2>
      <p class="note">Chaque série a 16 cartes et ses propres axes. Plus tu en fais, plus ton profil global est fin.</p>
      ${listeSeries(acquis)}
      ${n >= 2 ? `<a class="gros-bouton" href="${lien({ mode: "global", acquis })}">Voir mon profil global</a>` : ""}
      ${m ? `<p class="note">Séries gardées sur ce téléphone le ${esc(m.date)}. <button class="lien" id="oublier">Les effacer</button></p>` : ""}`;
    zone.querySelector(".gros-bouton").after(bloc);
    if (n) { const b = zone.querySelector(".gros-bouton"); b.textContent = acquis[1] ? "Refaire la série 1" : "Commencer"; }
    $("#oublier")?.addEventListener("click", () => { memoire.effacer(); etat.acquis = {}; location.hash = ""; dessinerAccueil(); });
  }

  function carteHTML(se, i, dessous) {
    const d = se.dilemmes[i], k = se.iAxe[d.axe], tot = se.dilemmes.length;
    const g = inverse[d.id] ? "b" : "a", dr = g === "a" ? "b" : "a";
    return `<div class="carte g${k + 1}${dessous ? " dessous" : ""}"${dessous ? ' aria-hidden="true"' : ""} data-g="${g}" data-d="${dr}">
      <div class="theme"><span>${esc(se.axes[k].nom)}</span><span>${i + 1}/${tot}</span></div>
      <div class="icone" aria-hidden="true">${esc(d.icone || "")}</div>
      <h1 class="question"${dessous ? "" : ' id="q-titre"'}>${esc(d.question)}</h1>
      <div class="opts"${dessous ? "" : ' role="group" aria-labelledby="q-titre"'}>
        <button class="option" data-sens="g" data-r="${g}"${dessous ? ' tabindex="-1"' : ""}><b aria-hidden="true">←</b>${esc(d[g])}</button>
        <button class="option droite" data-sens="d" data-r="${dr}"${dessous ? ' tabindex="-1"' : ""}><b aria-hidden="true">→</b>${esc(d[dr])}</button>
      </div>
      ${dessous ? "" : `<span class="tampon g" aria-hidden="true">Ce choix</span><span class="tampon d" aria-hidden="true">Ce choix</span><span class="tampon h" aria-hidden="true">Ça dépend</span>`}
    </div>`;
  }

  function dessinerQuestion() {
    const se = serie(etat.s) || serie(1), rep = etat.rep, i = rep.length, tot = se.dilemmes.length;
    if (i >= tot) return aller({ mode: "r", s: se.n, rep, defi: etat.defi });
    const d = se.dilemmes[i], axe = se.axes[se.iAxe[d.axe]];
    document.title = `Série ${se.n} · ${se.court} · Ta boussole d'idées`;
    scene.innerHTML = `<section class="questionnaire">
      <div class="haut-q">${i ? `<button class="lien" id="q-retour">← Précédent</button>` : `<a class="lien" href="${lien({ defi: etat.defi })}">← Accueil</a>`}<span class="compte">${se.n > 1 || D.series.length > 1 ? `<small>Série ${se.n} · </small>` : ""}${i + 1} / ${tot}</span></div>
      ${segments(se, rep, i)}
      <div class="pile">${i < tot - 1 ? carteHTML(se, i + 1, true) : ""}${carteHTML(se, i, false)}</div>
      <div class="actions">
        <button class="rond" data-sens="g" aria-label="Choisir l'option de gauche">←</button>
        <button class="rond neutre" data-sens="h" data-r="0">Ça dépend</button>
        <button class="rond" data-sens="d" aria-label="Choisir l'option de droite">→</button>
      </div>
      <p class="aide">Glisse la carte vers ton choix, ou touche une option. Aucun parti avant la fin.</p>
    </section>`;
    const c = scene.querySelector(".carte:not(.dessous)");
    const tg = $(".tampon.g", c), td = $(".tampon.d", c), th = $(".tampon.h", c);
    let x0 = 0, y0 = 0, dx = 0, dy = 0, actif = false, fini = false;
    const peindre = () => {
      c.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      tg.style.opacity = Math.max(0, -dx / 90); td.style.opacity = Math.max(0, dx / 90); th.style.opacity = Math.max(0, -dy / 90 - Math.abs(dx) / 120);
    };
    const partir = (sens) => {
      if (fini) return;
      fini = true; parcouru.add(se.n);
      const r = sens === "g" ? c.dataset.g : sens === "d" ? c.dataset.d : "0";
      c.style.transition = "transform .26s ease-out";
      c.style.transform = sens === "h" ? "translateY(-120%)" : `translateX(${sens === "g" ? -130 : 130}%) rotate(${sens === "g" ? -18 : 18}deg)`;
      setTimeout(() => aller({ mode: "q", s: se.n, rep: rep + r, defi: etat.defi }), calme() ? 0 : 220);
    };
    // Glisser la carte au doigt ou à la souris ; un simple toucher sur une option la choisit aussi.
    c.addEventListener("pointerdown", (e) => { if (e.button) return; actif = true; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; c.style.transition = "none"; });
    c.addEventListener("pointermove", (e) => {
      if (!actif) return;
      dx = e.clientX - x0; dy = Math.min(0, e.clientY - y0);
      if (Math.abs(dx) > 6 || dy < -6) { c.setPointerCapture?.(e.pointerId); peindre(); }
    });
    const relacher = () => {
      if (!actif) return;
      actif = false;
      if (dx < -90) return partir("g"); if (dx > 90) return partir("d"); if (dy < -100) return partir("h");
      dx = dy = 0; c.style.transition = "transform .2s ease"; peindre();
    };
    c.addEventListener("pointerup", relacher);
    c.addEventListener("pointercancel", relacher);
    scene.querySelectorAll(".carte:not(.dessous) .option, .actions [data-sens]").forEach((b) => b.addEventListener("click", (e) => {
      if (Math.abs(dx) > 6 || dy < -6) return; // c'était un glissé, pas un toucher
      e.stopPropagation(); partir(b.dataset.sens);
    }));
    $("#q-retour")?.addEventListener("click", () => history.back());
    $(".option", c).focus({ preventScroll: true });
    window.scrollTo(0, 0);
    annoncer(`Série ${se.n}, carte ${i + 1} sur ${tot}, ${axe.nom} : ${d.question}. Gauche : ${d[c.dataset.g]} Droite : ${d[c.dataset.d]}`);
  }

  function citation(id) {
    const c = D.citations[id];
    if (!c) return "";
    const page = c.pg ? `p. ${c.pg}` : "page web";
    return `<blockquote><p>« ${esc(c.c)} »</p><footer><a href="${esc(c.u)}" rel="noopener" target="_blank">${esc(c.t)}</a> · ${page} · ${esc(c.d)}${c.ar ? ` <span class="archive">archive ${esc(c.m ?? c.d.slice(0, 4))}</span>` : ""}</footer></blockquote>`;
  }
  function camp(d, o) {
    const ids = Object.keys(d.positions).filter((p) => d.positions[p].choix === o);
    if (!ids.length) return `<span class="qui-note">Aucun des huit partis ne la défend dans les textes lus.</span>`;
    return ids.map((p) => {
      const pos = d.positions[p], parti = D.parti[p];
      return `<details class="qui"><summary title="${esc(parti.nom)}">${esc(parti.sigle)}</summary><p class="qui-note"><strong>${esc(parti.nom)}</strong>${pos.nuance ? ` (${esc(pos.nuance)})` : ""}</p>${pos.appuis.map(citation).join("")}</details>`;
    }).join("");
  }
  // Le détail des cartes d'une série, avec les partis cachés jusqu'à la révélation.
  const detailsSerie = (se, rep) => se.dilemmes.map((d, i) => `<article class="carte-d g${se.iAxe[d.axe] + 1}">
      <h3><span aria-hidden="true">${esc(d.icone || "")}</span> ${esc(d.question)}</h3>
      ${["a", "b"].map((o) => `<div class="opt-d${rep[i] === o ? " vous" : ""}"><p>${rep[i] === o ? `<span class="badge-vous">toi</span>` : ""}${esc(d[o])}</p><div class="qui-liste" data-cache="1" hidden>${camp(d, o)}</div></div>`).join("")}
      ${rep[i] === "0" ? `<p class="qui-note">Toi : ça dépend.</p>` : ""}
      <p class="qui-note" data-cache="1" hidden>${(() => { const absents = D.partis.filter((p) => !d.positions[p.id]); return absents.length ? `Ne tranchent pas dans les textes lus : ${absents.map((p) => esc(p.sigle)).join(", ")}. ` : ""; })()}<a href="../#concept-${esc(d.notion)}">La fiche complète</a></p>
    </article>`).join("");

  function blocDefi(se, sc) {
    const autre = etat.defi;
    const memes = sc.filter((x, i) => x.n && x.etat === autre[i]);
    const ecarts = sc.filter((x, i) => x.n && x.etat !== autre[i]);
    return `<div class="bloc defi">
      <h2>Vos deux boussoles</h2>
      ${etoileLecteur(se, sc, { avec: autre, titre: "Ton étoile, en trait plein, et celle de la personne qui t'a défié, en pointillés." })}
      <p class="legende-defi"><span><i></i>toi</span><span><i class="ami"></i>ton défi</span></p>
      <p class="gros-chiffre">Même côté sur ${memes.length} axe${memes.length > 1 ? "s" : ""} sur ${sc.filter((x) => x.n).length}</p>
      ${ecarts.length ? `<ul class="ecarts">${ecarts.map((x) => { const i = se.axes.indexOf(x.axe); return `<li class="g${i + 1}"><strong>${esc(x.axe.nom)}</strong> : toi, ${esc(motAxe(x).toLowerCase())} ; ton défi, ${esc(autre[i] === "n" ? "des deux côtés" : x.axe[autre[i]].toLowerCase())}.</li>`; }).join("")}</ul>
      <p class="note">De quoi discuter : les dilemmes de ces axes sont plus bas, avec ce qu'en disent les textes.</p>` : `<p class="note">Vous penchez du même côté partout où tu as répondu. Le détail des cartes montre peut-être des nuances.</p>`}
    </div>`;
  }

  function dessinerResultat() {
    const se = serie(etat.s) || serie(1), rep = etat.rep, tot = se.dilemmes.length;
    if (rep.length !== tot) return aller(rep ? { mode: "q", s: se.n, rep } : {});
    const acquis = { ...acquisComplet(etat.acquis), [se.n]: rep };
    const sc = scores(se, rep), code = sc.map((x) => x.etat).join("");
    const titreTexte = sc.map((x) => x.axe[x.etat]).join(" · ");
    const lecture = sc.filter((x) => x.etat !== "n").map((x) => tutoyer(x.axe[x.etat + "_long"])).join(" ")
      || "Aucun axe ne domine : sur chaque grande question, tes réponses se partagent entre les deux côtés.";
    const tranches = [...rep].filter((r) => r !== "0").length;
    const suivante = D.series.find((x) => !acquis[x.n]);
    const n = nbFaites(acquis);
    document.title = `Ma boussole d'idées : ${titreTexte}`;

    scene.innerHTML = `<section class="resultat">
      ${parcouru.has(se.n) ? "" : `<p class="bandeau alerte">Ce résultat a été ouvert depuis un lien : il ne vient peut-être pas de tes réponses. <a href="${lien({ mode: "q", s: se.n, acquis: {} })}"><strong>Faire le test</strong></a></p>`}
      <div><p class="surtitre-serie">Série ${se.n} · ${esc(se.court)}</p><h1>Ta boussole</h1><p class="sous">${tranches} cartes tranchées sur ${tot}${tot - tranches ? `, ${tot - tranches} « ça dépend »` : ""}</p></div>
      <figure class="bloc" style="margin:0">
        ${etoileLecteur(se, sc, { titre: `Étoile de tes réponses. ${sc.map(lectureAxe).join(". ")}.` })}
        <figcaption class="note" style="text-align:center;margin-top:4px">Chaque branche compte tes réponses vers un pôle, de 0 à 4. Les deux pôles d'un axe se font face.</figcaption>
      </figure>
      ${tuilesAxes(sc)}
      <details class="lecture bloc"><summary>Ta boussole en mots</summary><p>${esc(lecture)}</p></details>

      ${etat.defi ? blocDefi(se, sc) : ""}

      <div class="revelation" id="revelation">
        <button class="gros-bouton" id="reveler">Qui défend mes choix ?</button>
        <div id="partis" hidden></div>
      </div>

      <div class="bloc suite">
        <h2>${suivante ? "Affine ton profil" : "Ton profil est complet"}</h2>
        <p class="note">${suivante ? `Chaque série ajoute 4 axes. Tes réponses s'additionnent${n >= 2 ? " : ton profil global compte déjà " + n + " séries." : "."}` : `Tu as fait les ${D.series.length} séries : ${D.series.length * 4} axes, ${D.series.reduce((t, x) => t + x.dilemmes.length, 0)} dilemmes.`}</p>
        ${listeSeries(acquis, se.n)}
        ${suivante ? `<a class="gros-bouton" href="${lien({ mode: "q", s: suivante.n, acquis })}">Série ${suivante.n} : ${esc(suivante.court)}</a>` : ""}
        ${n >= 2 ? `<a class="pilule noire" href="${lien({ mode: "global", acquis })}">Voir mon profil global</a>` : ""}
        ${blocGarder()}
      </div>

      ${blocPartage(se.n === 1 ? code : `${se.n}-${code}`, titreTexte)}

      <details class="tout bloc"><summary><h2>Mes ${tot} cartes, et qui défend quoi</h2></summary>
        <p class="note" id="details-note">Les partis de chaque option apparaissent une fois révélés.</p>
        <div id="details">${detailsSerie(se, rep)}</div>
      </details>

      <p class="avert">${esc(D.note_methode)} ${esc(MENTION)} Beaucoup de textes cités sont les programmes de 2022 (marqués « archive ») tant que ceux de 2027 ne sont pas publiés.</p>
      <div class="fin"><a class="pilule" href="${lien({ mode: "q", s: se.n, acquis })}">Refaire la série ${se.n}</a> <a class="pilule" href="../">Explorer les programmes</a></div>
    </section>`;

    brancherPartage({ portrait: se.n === 1 ? code : `${se.n}-${code}`, titreTexte });
    brancherGarder(acquis);
    $("#reveler").addEventListener("click", () => reveler([{ se, rep }]));
    window.scrollTo(0, 0);
    scene.focus({ preventScroll: true });
  }

  // Profil global : toutes les séries faites, additionnées.
  function dessinerGlobal() {
    const acquis = acquisComplet(etat.acquis);
    const faites = D.series.filter((se) => acquis[se.n]);
    if (!faites.length) return aller({});
    const total = faites.reduce((t, se) => t + se.dilemmes.length, 0);
    const tranches = faites.reduce((t, se) => t + [...acquis[se.n]].filter((r) => r !== "0").length, 0);
    const marques = faites.flatMap((se) => scores(se, acquis[se.n]).filter((x) => x.etat !== "n"));
    document.title = "Mon profil global · Ta boussole d'idées";
    scene.innerHTML = `<section class="resultat global">
      <div><p class="surtitre-serie">${faites.length} série${faites.length > 1 ? "s" : ""} sur ${D.series.length} · ${faites.length * 4} axes</p><h1>Ton profil global</h1><p class="sous">${tranches} cartes tranchées sur ${total}</p></div>
      <div class="bloc">
        <h2>En un coup d'œil</h2>
        <p class="note">Les axes où tu penches nettement d'un côté (au moins 3 réponses sur 4 dans le même sens, ou toutes tes réponses).</p>
        ${marques.length ? `<ul class="nets">${marques.map((x) => { const se = faites.find((s) => s.axes.includes(x.axe)); return `<li class="g${se.axes.indexOf(x.axe) + 1}"><span>${esc(x.axe.nom)}</span><strong>${esc(x.axe[x.etat])}</strong></li>`; }).join("")}</ul>` : `<p>Aucun axe ne domine : tes réponses se partagent partout entre les deux côtés.</p>`}
      </div>
      ${faites.map((se) => { const sc = scores(se, acquis[se.n]); return `<details class="bloc serie-res"${faites.length < 3 ? " open" : ""}><summary><h2><span class="num">${se.n}</span> ${esc(se.court)}</h2></summary>
        ${etoileLecteur(se, sc, { titre: `Série ${se.n}. ${sc.map(lectureAxe).join(". ")}.` })}
        ${tuilesAxes(sc)}
      </details>`; }).join("")}
      ${faites.length < D.series.length ? `<div class="bloc suite"><h2>À compléter</h2>${listeSeries(acquis)}</div>` : ""}
      <div class="revelation" id="revelation">
        <button class="gros-bouton" id="reveler">Qui défend mes choix, toutes séries ?</button>
        <div id="partis" hidden></div>
      </div>
      <div class="bloc">${blocGarder()}
        <p class="note">Ce lien rouvre ton profil sur n'importe quel appareil. Il contient tes réponses : garde-le pour toi.</p>
        <div class="boutons"><button class="pilule" id="copier-profil">Copier le lien de mon profil</button></div>
      </div>
      ${blocPartage(null, "")}
      <p class="avert">${esc(D.note_methode)} ${esc(MENTION)}</p>
      <div class="fin"><a class="pilule" href="${lien({ acquis })}">Accueil du test</a> <a class="pilule" href="../">Explorer les programmes</a></div>
    </section>`;
    brancherPartage({ portrait: null, global: faites.length });
    brancherGarder(acquis);
    $("#copier-profil").addEventListener("click", async (e) => {
      const u = `${URL_SITE}/test/${lien({ mode: "global", acquis })}`;
      try { await navigator.clipboard.writeText(u); e.target.textContent = "Lien copié ✓"; annoncer("Lien copié."); } catch { prompt("Copie ce lien :", u); }
    });
    $("#reveler").addEventListener("click", () => reveler(faites.map((se) => ({ se, rep: acquis[se.n] }))));
    window.scrollTo(0, 0);
    scene.focus({ preventScroll: true });
  }

  function blocPartage(portrait, titreTexte) {
    return `<div class="bloc partage">
        <h2>Partager</h2>
        ${portrait ? `<div class="choix-partage" role="radiogroup" aria-label="Que partager ?">
          <label><input type="radio" name="quoi" value="invitation" checked>Inviter au test<small>sans ta boussole</small></label>
          <label><input type="radio" name="quoi" value="portrait">Défier avec ma boussole<small>tes 4 côtés, sans parti</small></label>
        </div>` : ""}
        <p class="note" id="p-note"></p>
        <img id="p-image" width="1200" height="630" alt="" loading="lazy">
        <div class="boutons">
          ${navigator.share ? `<button class="pilule noire" id="p-natif">Partager…</button>` : ""}
          <button class="pilule" id="p-copier">Copier le lien</button>
          <a class="pilule" id="p-telecharger" download="boussole-idees.png">Image</a>
        </div>
        <div class="reseaux" id="p-reseaux"></div>
      </div>`;
  }
  function brancherPartage({ portrait, titreTexte, global }) {
    let lienP = "", texte = "";
    const maj = () => {
      const quoi = scene.querySelector('input[name="quoi"]:checked')?.value || "invitation";
      if (quoi === "portrait") {
        lienP = `${URL_SITE}/test/p/${portrait}.html`;
        texte = `Sur 16 dilemmes tirés des programmes, j'ai penché vers : ${titreTexte}. D'accord avec moi ? Fais le test et comparons nos boussoles.`;
        $("#p-note").textContent = "Partager ta boussole rend publique une orientation politique. Le lien ne contient ni tes réponses détaillées ni aucun parti ; la personne verra où vos boussoles divergent.";
        $("#p-image").src = `og/${portrait}.png`;
        $("#p-image").alt = `Image partagée : ${titreTexte}`;
        $("#p-telecharger").href = `og/${portrait}.png`;
      } else {
        lienP = `${URL_SITE}/test/`;
        texte = global
          ? `J'ai fait ${global} séries de la boussole d'idées : des dilemmes tirés des programmes, aucun nom de parti avant la fin. Et toi, tu glisses de quel côté ?`
          : "16 dilemmes tirés des programmes, 3 minutes, aucun nom de parti avant la fin. Et toi, tu glisses de quel côté ?";
        $("#p-note").textContent = global ? "L'invitation ne dit rien de ton profil : il reste à toi." : "L'invitation ne dit rien de tes réponses.";
        $("#p-image").src = "og/test.png";
        $("#p-image").alt = "Image partagée : invitation au test";
        $("#p-telecharger").href = "og/test.png";
      }
      const u = encodeURIComponent(lienP), t = encodeURIComponent(texte);
      $("#p-reseaux").innerHTML = [
        ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
        ["WhatsApp", `https://wa.me/?text=${t}%20${u}`],
        ["Bluesky", `https://bsky.app/intent/compose?text=${t}%20${u}`],
        ["X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
        ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
      ].map(([nom, h]) => `<a href="${h}" target="_blank" rel="noopener">${nom}</a>`).join("");
      $("#p-copier").textContent = "Copier le lien";
    };
    scene.querySelectorAll('input[name="quoi"]').forEach((r) => r.addEventListener("change", maj));
    maj();
    $("#p-natif")?.addEventListener("click", () => navigator.share({ title: "Ta boussole d'idées", text: texte, url: lienP }).catch(() => {}));
    $("#p-copier").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(lienP); e.target.textContent = "Lien copié ✓"; annoncer("Lien copié."); }
      catch { prompt("Copie ce lien :", lienP); }
    });
  }

  // Révélation : l'étoile des affinités, puis une carte par parti à faire défiler du doigt.
  // blocs : [{ se, rep }] — une série pour un résultat, toutes les séries faites pour le profil global.
  function reveler(blocs) {
    const dilemmes = blocs.flatMap((b) => b.se.dilemmes), rep = blocs.map((b) => b.rep).join("");
    const px = proximites(dilemmes, rep), tries = trier(px), zone = $("#partis");
    const forts = tries.filter((x) => !x.faible);
    const egaux = forts.filter((x) => x.accord === forts[0]?.accord && x.compares === forts[0]?.compares);
    const tranchesPar = (x) => x.cases.filter((c) => c !== "muet").length;
    const etiquette = { accord: "même choix", desaccord: "choix opposé", muet: "ses textes ne tranchent pas", passe: "tu as dit ça dépend" };
    const plusieurs = blocs.length > 1;
    // Cases d'un parti, rangées par série quand il y en a plusieurs, avec le compte de chaque série.
    const casesParti = (x) => {
      let k = 0;
      return blocs.map((b) => {
        const cs = x.cases.slice(k, k + b.se.dilemmes.length), ds = dilemmes.slice(k, k + b.se.dilemmes.length);
        k += b.se.dilemmes.length;
        const acc = cs.filter((c) => c === "accord").length, cmp = cs.filter((c) => c === "accord" || c === "desaccord").length;
        return `${plusieurs ? `<span class="ligne-serie">Série ${b.se.n} · ${cmp ? `${acc} sur ${cmp}` : "–"}</span>` : ""}<div class="cases" role="img" aria-label="${plusieurs ? `Série ${b.se.n} : ` : ""}${["accord", "desaccord", "muet", "passe"].map((c) => `${cs.filter((v) => v === c).length} ${etiquette[c]}`).join(", ")}">${cs.map((c, i) => `<i class="${c} g${b.se.iAxe[ds[i].axe] + 1}" title="${esc(ds[i].question)} : ${etiquette[c]}"></i>`).join("")}</div>`;
      }).join("");
    };
    zone.innerHTML = `<div class="bloc">
        <h2>Qui défend tes choix</h2>
        ${Etoile.affinites(px.map((x) => ({ etiquette: x.p.sigle, detail: x.compares ? `${x.accord}/${x.compares}` : "–", taux: x.taux, faible: x.faible })),
          { titre: `Étoile des affinités, un rayon par parti dans l'ordre alphabétique. ${px.map((x) => `${x.p.nom} : même choix sur ${x.accord} dilemmes sur ${x.compares} comparés`).join(". ")}.` })}
        <p class="note" style="text-align:center">Un rayon par parti, toujours dans l'ordre alphabétique. Plus le point s'éloigne du centre, plus ses textes ont fait les mêmes choix que toi${plusieurs ? `, sur les ${dilemmes.length} dilemmes` : ""}.</p>
      </div>
      <div class="paquet" id="paquet" tabindex="0" aria-label="Une carte par parti, à faire défiler">${tries.map((x, k) => `<article class="carte-parti${x.faible ? " faible" : ""}${plusieurs ? " multi" : ""}" style="--k:${k}">
          <span class="sigle-g">${esc(x.p.sigle)}</span>
          <span class="nom-parti">${esc(x.p.nom)}</span>
          ${casesParti(x)}
          <span class="chiffre">${x.compares ? `${x.accord}<small>sur ${x.compares}</small>` : "–"}</span>
          ${x.faible ? `<span class="peu">Ses textes tranchent trop peu de ces dilemmes pour conclure.</span>` : `<span class="peu">dilemmes où ses textes ont fait ton choix</span>`}
        </article>`).join("")}</div>
      <p class="compteur-paquet">Fais défiler les 8 cartes →</p>
      <div class="legende-cases"><span><span class="cases"><i class="accord"></i></span>même choix</span><span><span class="cases"><i class="desaccord"></i></span>choix opposé</span><span><span class="cases"><i class="muet"></i></span>ne tranche pas</span><span><span class="cases"><i class="passe"></i></span>tu as dit ça dépend</span></div>
      ${egaux.length > 1 ? `<p class="note"><strong>Le test ne départage pas</strong> ${egaux.map((x) => esc(x.p.nom)).join(", ")} : même nombre d'accords sur le même nombre de dilemmes.</p>` : ""}
      <p class="note">Ces dilemmes portent sur des désaccords nets. Certains partis en tranchent peu dans leurs textes (${[...px].sort((a, b) => tranchesPar(a) - tranchesPar(b)).slice(0, 3).map((x) => `${esc(x.p.sigle)} : ${tranchesPar(x)} sur ${dilemmes.length}`).join(", ")}) : peu présent ici ne veut pas dire centriste, seulement que ses textes ne tranchent pas ces questions. L'ordre des cartes suit le nombre d'accords, l'étoile suit l'alphabet.</p>
      <p class="avert">${esc(MENTION)} · republique.fr/test</p>`;
    zone.hidden = false;
    $("#reveler").hidden = true;
    document.querySelectorAll("[data-cache]").forEach((el) => { el.hidden = false; });
    if ($("#details-note")) $("#details-note").hidden = true;
    zone.setAttribute("tabindex", "-1");
    zone.focus();
  }

  async function rendre() {
    etat = lireEtat();
    if (etat.mode === "accueil") return dessinerAccueil();
    try { await charger(); }
    catch { scene.innerHTML = `<p class="bandeau alerte">Le test n'a pas pu se charger. Vérifie ta connexion et recharge la page.</p>`; return; }
    if (!serie(etat.s)) etat.s = 1;
    if (etat.mode === "q") dessinerQuestion();
    else if (etat.mode === "global") dessinerGlobal();
    else dessinerResultat();
  }
  window.addEventListener("hashchange", rendre);
  // Clavier : flèches gauche et droite pour choisir, flèche haut pour « ça dépend ».
  document.addEventListener("keydown", (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || !scene.querySelector(".questionnaire")) return;
    const sens = { ArrowLeft: "g", ArrowRight: "d", ArrowUp: "h" }[ev.key];
    if (sens) { ev.preventDefault(); scene.querySelector(`.actions [data-sens="${sens}"]`).click(); }
  });
  rendre();
})();
