// Test « Ta boussole d'idées », style « Glisse » : une carte par dilemme, qu'on glisse vers son choix.
// Rien n'est envoyé ni stocké : les réponses vivent dans l'adresse (#q=… pendant le test, #r=… au résultat),
// ce qui permet le bouton retour du téléphone et le rechargement sans perdre sa place.
// Codage des réponses : « a », « b » ou « 0 » (ça dépend), une lettre par dilemme dans l'ordre de donnees.json.
// Défi : « &defi=anbb » (le portrait en 4 lettres de la personne qui invite) suit le parcours et ajoute une comparaison des deux boussoles, sans aucun parti.
// Graphiques en étoile : etoile.js (règles de lecture expliquées en tête de ce fichier).
"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const scene = $("#scene");
  const accueil = scene.innerHTML;
  const URL_SITE = "https://republique.fr";
  const SEUIL = 4; // en dessous de 4 dilemmes comparés, un rapprochement avec un parti n'est pas lisible
  const MENTION = "Ni sondage ni consigne de vote : un résumé de tes réponses à 16 dilemmes, pas de ta personne.";
  const COULEURS = ["var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)"];
  const calme = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let D = null;
  // Côté de chaque option, tiré au hasard une fois par visite : la même famille d'idées n'est pas toujours à gauche.
  const inverse = {};
  // Vrai seulement si le résultat affiché vient de réponses données dans cette page (rien n'est stocké) :
  // un lien « #r=… » ouvert directement est signalé comme tel, pour qu'on ne fasse pas passer un résultat fabriqué pour le sien.
  let parcouru = false;

  const annoncer = (t) => { $("#annonce").textContent = ""; setTimeout(() => { $("#annonce").textContent = t; }, 30); };
  const lireEtat = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    const defi = (h.match(/(?:^|&)defi=([anb]{4})(?:&|$)/) || [])[1] || "";
    const corps = h.replace(/(?:^|&)defi=[anb]{4}/, "").replace(/^&/, "");
    if (corps === "commencer") return { mode: "q", rep: "", defi };
    const m = corps.match(/^([qr])=([ab0]*)$/);
    return m ? { mode: m[1], rep: m[2], defi } : { mode: "accueil", defi };
  };
  let etat = { defi: "" };
  const aller = (h) => { location.hash = h + (etat.defi ? `&defi=${etat.defi}` : ""); };

  async function charger() {
    if (D) return D;
    const r = await fetch("donnees.json", { cache: "no-cache" });
    D = await r.json();
    D.parti = Object.fromEntries(D.partis.map((p) => [p.id, p]));
    D.iAxe = Object.fromEntries(D.axes.map((a, i) => [a.id, i]));
    D.dilemmes.forEach((d) => { inverse[d.id] = Math.random() < 0.5; });
    return D;
  }

  // ---------- Calculs ----------
  // Par axe : nombre de choix « a » et « b » (0 à 4), score moyen de -1 (tout a) à +1 (tout b), état a / n / b.
  function scores(rep) {
    return D.axes.map((axe) => {
      let na = 0, nb = 0;
      D.dilemmes.forEach((d, i) => { if (d.axe !== axe.id) return; if (rep[i] === "a") na++; else if (rep[i] === "b") nb++; });
      const n = na + nb, s = n ? (nb - na) / n : 0;
      return { axe, na, nb, n, s, etat: s <= -0.5 ? "a" : s >= 0.5 ? "b" : "n" };
    });
  }
  // Proximité : sur les dilemmes où le parti tranche dans ses textes ET où tu as tranché, combien de choix identiques.
  // Tri lissé (accord + 1) / (comparés + 2) : un 5 sur 5 ne passe pas devant un 15 sur 16 ; le compte brut reste affiché.
  function proximites(rep) {
    return D.partis.map((p) => {
      let accord = 0, compares = 0;
      const cases = D.dilemmes.map((d, i) => {
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
  const etoileLecteur = (sc, opts = {}) => Etoile.profil([
    ...(opts.avec ? [{ ...Etoile.depuisCode(opts.avec), sorte: "contour" }] : []),
    { v: sc.map((x) => [x.na, x.nb]), muet: sc.map((x) => !x.n), sorte: "plein" },
  ], { axes: D.axes, titre: opts.titre });
  const lectureAxe = (x) => (x.n ? (x.etat === "n" ? `${x.axe.nom} : des deux côtés, ${x.na} et ${x.nb}` : `${x.axe.nom} : ${x.axe[x.etat]}, ${Math.max(x.na, x.nb)} sur ${x.n}`) : `${x.axe.nom} : sans réponse`);
  const motAxe = (x) => (x.n ? (x.etat === "n" ? "Des deux côtés" : x.axe[x.etat]) : "Tu as passé");
  const segments = (rep, i) => `<div class="segments" aria-hidden="true">${D.dilemmes.map((d, k) => `<span class="g${D.iAxe[d.axe] + 1}${k < i ? " fait" : ""}${rep[k] === "0" ? " passe" : ""}"></span>`).join("")}</div>`;

  // ---------- Écrans ----------
  function dessinerAccueil() {
    scene.innerHTML = accueil;
    document.title = "Ta boussole d'idées · République des mots 2027";
    if (etat.defi) {
      const b = document.createElement("p");
      b.className = "bandeau";
      b.innerHTML = `<strong>On te lance un défi.</strong> Fais le test : à la fin, tu verras où vos deux boussoles divergent. Aucun parti dans la comparaison, rien n'est enregistré.`;
      scene.querySelector(".accueil").prepend(b);
      scene.querySelector('a[href="#commencer"]').setAttribute("href", `#commencer&defi=${etat.defi}`);
    }
  }

  function carteHTML(i, dessous) {
    const d = D.dilemmes[i], k = D.iAxe[d.axe];
    const g = inverse[d.id] ? "b" : "a", dr = g === "a" ? "b" : "a";
    return `<div class="carte g${k + 1}${dessous ? " dessous" : ""}"${dessous ? ' aria-hidden="true"' : ""} data-g="${g}" data-d="${dr}">
      <div class="theme"><span>${esc(D.axes[k].nom)}</span><span>${i + 1}/16</span></div>
      <div class="icone" aria-hidden="true">${esc(d.icone || "")}</div>
      <h1 class="question"${dessous ? "" : ' id="q-titre"'}>${esc(d.question)}</h1>
      <div class="opts"${dessous ? "" : ' role="group" aria-labelledby="q-titre"'}>
        <button class="option" data-sens="g" data-r="${g}"${dessous ? ' tabindex="-1"' : ""}><b aria-hidden="true">←</b>${esc(d[g])}</button>
        <button class="option droite" data-sens="d" data-r="${dr}"${dessous ? ' tabindex="-1"' : ""}><b aria-hidden="true">→</b>${esc(d[dr])}</button>
      </div>
      ${dessous ? "" : `<span class="tampon g" aria-hidden="true">Ce choix</span><span class="tampon d" aria-hidden="true">Ce choix</span><span class="tampon h" aria-hidden="true">Ça dépend</span>`}
    </div>`;
  }

  function dessinerQuestion(rep) {
    const i = rep.length;
    if (i >= D.dilemmes.length) return aller(`r=${rep}`);
    const d = D.dilemmes[i], axe = D.axes[D.iAxe[d.axe]];
    scene.innerHTML = `<section class="questionnaire">
      <div class="haut-q">${i ? `<button class="lien" id="q-retour">← Précédent</button>` : `<a class="lien" href="#${etat.defi ? `defi=${etat.defi}` : ""}">← Accueil</a>`}<span class="compte">${i + 1} / 16</span></div>
      ${segments(rep, i)}
      <div class="pile">${i < 15 ? carteHTML(i + 1, true) : ""}${carteHTML(i, false)}</div>
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
      fini = true; parcouru = true;
      const r = sens === "g" ? c.dataset.g : sens === "d" ? c.dataset.d : "0";
      c.style.transition = "transform .26s ease-out";
      c.style.transform = sens === "h" ? "translateY(-120%)" : `translateX(${sens === "g" ? -130 : 130}%) rotate(${sens === "g" ? -18 : 18}deg)`;
      setTimeout(() => aller(`q=${rep}${r}`), calme() ? 0 : 220);
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
    annoncer(`Carte ${i + 1} sur 16, ${axe.nom} : ${d.question}. Gauche : ${d[c.dataset.g]} Droite : ${d[c.dataset.d]}`);
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

  function blocDefi(sc) {
    const autre = etat.defi;
    const memes = sc.filter((x, i) => x.n && x.etat === autre[i]);
    const ecarts = sc.filter((x, i) => x.n && x.etat !== autre[i]);
    return `<div class="bloc defi">
      <h2>Vos deux boussoles</h2>
      ${etoileLecteur(sc, { avec: autre, titre: "Ton étoile, en trait plein, et celle de la personne qui t'a défié, en pointillés." })}
      <p class="legende-defi"><span><i></i>toi</span><span><i class="ami"></i>ton défi</span></p>
      <p class="gros-chiffre">Même côté sur ${memes.length} axe${memes.length > 1 ? "s" : ""} sur ${sc.filter((x) => x.n).length}</p>
      ${ecarts.length ? `<ul class="ecarts">${ecarts.map((x) => { const i = D.axes.indexOf(x.axe); return `<li class="g${i + 1}"><strong>${esc(x.axe.nom)}</strong> : toi, ${esc(motAxe(x).toLowerCase())} ; ton défi, ${esc(autre[i] === "n" ? "des deux côtés" : x.axe[autre[i]].toLowerCase())}.</li>`; }).join("")}</ul>
      <p class="note">De quoi discuter : les dilemmes de ces axes sont plus bas, avec ce qu'en disent les textes.</p>` : `<p class="note">Vous penchez du même côté partout où tu as répondu. Le détail des 16 cartes montre peut-être des nuances.</p>`}
    </div>`;
  }

  function dessinerResultat(rep) {
    if (rep.length !== D.dilemmes.length) return aller(rep ? `q=${rep}` : "");
    const sc = scores(rep), code = sc.map((x) => x.etat).join("");
    const titreTexte = sc.map((x) => x.axe[x.etat]).join(" · ");
    const lecture = sc.filter((x) => x.etat !== "n").map((x) => x.axe[x.etat + "_long"].replace(/^Vous penchez/, "Tu penches").replace(/\bvous\b/g, "tu")).join(" ")
      || "Aucun axe ne domine : sur chaque grande question, tes réponses se partagent entre les deux côtés.";
    const tranches = [...rep].filter((r) => r !== "0").length;
    document.title = `Ma boussole d'idées : ${titreTexte}`;

    scene.innerHTML = `<section class="resultat">
      ${parcouru ? "" : `<p class="bandeau alerte">Ce résultat a été ouvert depuis un lien : il ne vient pas de tes réponses. <a href="#commencer"><strong>Faire le test</strong></a></p>`}
      <div><h1>Ta boussole</h1><p class="sous">${tranches} cartes tranchées sur 16${16 - tranches ? `, ${16 - tranches} « ça dépend »` : ""}</p></div>
      <figure class="bloc" style="margin:0">
        ${etoileLecteur(sc, { titre: `Étoile de tes réponses. ${sc.map(lectureAxe).join(". ")}.` })}
        <figcaption class="note" style="text-align:center;margin-top:4px">Chaque branche compte tes réponses vers un pôle, de 0 à 4. Les deux pôles d'un axe se font face.</figcaption>
      </figure>
      <div class="axes-res">${sc.map((x, i) => `<div class="axe-res g${i + 1}${x.etat === "n" ? " nuance" : ""}${x.n ? "" : " vide"}"><span class="nom">${esc(x.axe.nom)}</span><strong>${esc(motAxe(x))}</strong><span class="compte-axe">${x.n ? (x.etat === "n" ? `${x.na} et ${x.nb}` : `${Math.max(x.na, x.nb)} sur ${x.n}`) : "&nbsp;"}</span></div>`).join("")}</div>
      <details class="lecture bloc"><summary>Ta boussole en mots</summary><p>${esc(lecture)}</p></details>

      ${etat.defi ? blocDefi(sc) : ""}

      <div class="revelation" id="revelation">
        <button class="gros-bouton" id="reveler">Qui défend mes choix ?</button>
        <div id="partis" hidden></div>
      </div>

      <div class="bloc partage">
        <h2>Partager</h2>
        <div class="choix-partage" role="radiogroup" aria-label="Que partager ?">
          <label><input type="radio" name="quoi" value="invitation" checked>Inviter au test<small>sans ta boussole</small></label>
          <label><input type="radio" name="quoi" value="portrait">Défier avec ma boussole<small>tes 4 côtés, sans parti</small></label>
        </div>
        <p class="note" id="p-note"></p>
        <img id="p-image" width="1200" height="630" alt="" loading="lazy">
        <div class="boutons">
          ${navigator.share ? `<button class="pilule noire" id="p-natif">Partager…</button>` : ""}
          <button class="pilule" id="p-copier">Copier le lien</button>
          <a class="pilule" id="p-telecharger" download="ma-boussole-idees.png">Image</a>
        </div>
        <div class="reseaux" id="p-reseaux"></div>
      </div>

      <details class="tout bloc"><summary><h2>Mes 16 cartes, et qui défend quoi</h2></summary>
        <p class="note" id="details-note">Les partis de chaque option apparaissent une fois révélés.</p>
        <div id="details">${D.dilemmes.map((d, i) => `<article class="carte-d g${D.iAxe[d.axe] + 1}">
          <h3><span aria-hidden="true">${esc(d.icone || "")}</span> ${esc(d.question)}</h3>
          ${["a", "b"].map((o) => `<div class="opt-d${rep[i] === o ? " vous" : ""}"><p>${rep[i] === o ? `<span class="badge-vous">toi</span>` : ""}${esc(d[o])}</p><div class="qui-liste" data-cache="1" hidden>${camp(d, o)}</div></div>`).join("")}
          ${rep[i] === "0" ? `<p class="qui-note">Toi : ça dépend.</p>` : ""}
          <p class="qui-note" data-cache="1" hidden>${(() => { const absents = D.partis.filter((p) => !d.positions[p.id]); return absents.length ? `Ne tranchent pas dans les textes lus : ${absents.map((p) => esc(p.sigle)).join(", ")}. ` : ""; })()}<a href="../#concept-${esc(d.notion)}">La fiche complète</a></p>
        </article>`).join("")}</div>
      </details>

      <p class="avert">${esc(D.note_methode)} ${esc(MENTION)} Beaucoup de textes cités sont les programmes de 2022 (marqués « archive ») tant que ceux de 2027 ne sont pas publiés.</p>
      <div class="fin"><a class="pilule" href="#commencer">Refaire le test</a> <a class="pilule" href="../">Explorer les programmes</a></div>
    </section>`;

    brancherPartage(code, titreTexte);
    $("#reveler").addEventListener("click", () => reveler(rep));
    window.scrollTo(0, 0);
    scene.focus({ preventScroll: true });
  }

  function brancherPartage(code, titreTexte) {
    let lien = "", texte = "";
    const maj = () => {
      const quoi = scene.querySelector('input[name="quoi"]:checked').value;
      if (quoi === "portrait") {
        lien = `${URL_SITE}/test/p/${code}.html`;
        texte = `Sur 16 dilemmes tirés des programmes, j'ai penché vers : ${titreTexte}. D'accord avec moi ? Fais le test et comparons nos boussoles.`;
        $("#p-note").textContent = "Partager ta boussole rend publique une orientation politique. Le lien ne contient ni tes réponses détaillées ni aucun parti ; la personne verra où vos boussoles divergent.";
        $("#p-image").src = `og/${code}.png`;
        $("#p-image").alt = `Image partagée : ${titreTexte}`;
        $("#p-telecharger").href = `og/${code}.png`;
      } else {
        lien = `${URL_SITE}/test/`;
        texte = "16 dilemmes tirés des programmes, 3 minutes, aucun nom de parti avant la fin. Et toi, tu glisses de quel côté ?";
        $("#p-note").textContent = "L'invitation ne dit rien de tes réponses.";
        $("#p-image").src = "og/test.png";
        $("#p-image").alt = "Image partagée : invitation au test";
        $("#p-telecharger").href = "og/test.png";
      }
      const u = encodeURIComponent(lien), t = encodeURIComponent(texte);
      $("#p-reseaux").innerHTML = [
        ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
        ["WhatsApp", `https://wa.me/?text=${t}%20${u}`],
        ["Bluesky", `https://bsky.app/intent/compose?text=${t}%20${u}`],
        ["X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
        ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
      ].map(([n, h]) => `<a href="${h}" target="_blank" rel="noopener">${n}</a>`).join("");
      $("#p-copier").textContent = "Copier le lien";
    };
    scene.querySelectorAll('input[name="quoi"]').forEach((r) => r.addEventListener("change", maj));
    maj();
    $("#p-natif")?.addEventListener("click", () => navigator.share({ title: "Ma boussole d'idées", text: texte, url: lien }).catch(() => {}));
    $("#p-copier").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(lien); e.target.textContent = "Lien copié ✓"; annoncer("Lien copié."); }
      catch { prompt("Copie ce lien :", lien); }
    });
  }

  // Révélation : l'étoile des affinités, puis une carte par parti à faire défiler du doigt, dans le même style que les dilemmes.
  function reveler(rep) {
    const px = proximites(rep), tries = trier(px), zone = $("#partis");
    const forts = tries.filter((x) => !x.faible);
    const egaux = forts.filter((x) => x.accord === forts[0]?.accord && x.compares === forts[0]?.compares);
    const tranchesPar = (x) => x.cases.filter((c) => c !== "muet").length;
    const etiquette = { accord: "même choix", desaccord: "choix opposé", muet: "ses textes ne tranchent pas", passe: "tu as dit ça dépend" };
    zone.innerHTML = `<div class="bloc">
        <h2>Qui défend tes choix</h2>
        ${Etoile.affinites(px.map((x) => ({ etiquette: x.p.sigle, detail: x.compares ? `${x.accord}/${x.compares}` : "–", taux: x.taux, faible: x.faible })),
          { titre: `Étoile des affinités, un rayon par parti dans l'ordre alphabétique. ${px.map((x) => `${x.p.nom} : même choix sur ${x.accord} dilemmes sur ${x.compares} comparés`).join(". ")}.` })}
        <p class="note" style="text-align:center">Un rayon par parti, toujours dans l'ordre alphabétique. Plus le point s'éloigne du centre, plus ses textes ont fait les mêmes choix que toi.</p>
      </div>
      <div class="paquet" id="paquet" tabindex="0" aria-label="Une carte par parti, à faire défiler">${tries.map((x, k) => `<article class="carte-parti${x.faible ? " faible" : ""}" style="--k:${k}">
          <span class="sigle-g">${esc(x.p.sigle)}</span>
          <span class="nom-parti">${esc(x.p.nom)}</span>
          <div class="cases" role="img" aria-label="${["accord", "desaccord", "muet", "passe"].map((c) => `${x.cases.filter((v) => v === c).length} ${etiquette[c]}`).join(", ")}">${x.cases.map((c, i) => `<i class="${c} g${D.iAxe[D.dilemmes[i].axe] + 1}" title="${esc(D.dilemmes[i].question)} : ${etiquette[c]}"></i>`).join("")}</div>
          <span class="chiffre">${x.compares ? `${x.accord}<small>sur ${x.compares}</small>` : "–"}</span>
          ${x.faible ? `<span class="peu">Ses textes tranchent trop peu de ces dilemmes pour conclure.</span>` : `<span class="peu">dilemmes où ses textes ont fait ton choix</span>`}
        </article>`).join("")}</div>
      <p class="compteur-paquet">Fais défiler les 8 cartes →</p>
      <div class="legende-cases"><span><span class="cases"><i class="accord"></i></span>même choix</span><span><span class="cases"><i class="desaccord"></i></span>choix opposé</span><span><span class="cases"><i class="muet"></i></span>ne tranche pas</span><span><span class="cases"><i class="passe"></i></span>tu as dit ça dépend</span></div>
      ${egaux.length > 1 ? `<p class="note"><strong>Le test ne départage pas</strong> ${egaux.map((x) => esc(x.p.nom)).join(", ")} : même nombre d'accords sur le même nombre de dilemmes.</p>` : ""}
      <p class="note">Ces 16 dilemmes portent sur des désaccords nets. Certains partis en tranchent peu dans leurs textes (${[...px].sort((a, b) => tranchesPar(a) - tranchesPar(b)).slice(0, 3).map((x) => `${esc(x.p.sigle)} : ${tranchesPar(x)}`).join(", ")}) : peu présent ici ne veut pas dire centriste, seulement que ses textes ne tranchent pas ces questions. L'ordre des cartes suit le nombre d'accords, l'étoile suit l'alphabet.</p>
      <p class="avert">${esc(MENTION)} · republique.fr/test</p>`;
    zone.hidden = false;
    $("#reveler").hidden = true;
    document.querySelectorAll("[data-cache]").forEach((el) => { el.hidden = false; });
    $("#details-note").hidden = true;
    zone.setAttribute("tabindex", "-1");
    zone.focus();
  }

  async function rendre() {
    etat = lireEtat();
    if (etat.mode === "accueil") return dessinerAccueil();
    try { await charger(); }
    catch { scene.innerHTML = `<p class="bandeau alerte">Le test n'a pas pu se charger. Vérifie ta connexion et recharge la page.</p>`; return; }
    if (etat.mode === "q") dessinerQuestion(etat.rep);
    else dessinerResultat(etat.rep);
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
