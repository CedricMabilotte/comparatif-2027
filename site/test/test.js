// Test « Votre boussole d'idées » : 16 dilemmes, 4 axes, résultat calculé dans le navigateur.
// Rien n'est envoyé ni stocké : les réponses vivent dans l'adresse (#q=… pendant le test, #r=… au résultat),
// ce qui permet le bouton retour du téléphone et le rechargement sans perdre sa place.
// Codage des réponses : « a », « b » ou « 0 » (sans avis), une lettre par dilemme dans l'ordre de donnees.json.
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
  const MENTION = "Ni sondage ni consigne de vote : un résumé de vos réponses à 16 dilemmes, pas de votre personne.";
  let D = null;
  // Ordre d'affichage des deux options, tiré au hasard une fois par visite : l'option du haut n'est pas toujours la même famille d'idées.
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
  // Même lecture pour un parti, à partir de ses positions codées ; un axe où il tranche moins de 2 dilemmes est « muet ».
  function profilParti(id) {
    const v = D.axes.map(() => [0, 0]);
    D.dilemmes.forEach((d) => { const pos = d.positions[id]; if (pos) v[D.iAxe[d.axe]][pos.choix === "a" ? 0 : 1]++; });
    return { v, muet: v.map(([a, b]) => a + b < 2) };
  }
  // Proximité : sur les dilemmes où le parti tranche dans ses textes ET où vous avez tranché, combien de choix identiques.
  // Tri lissé (accord + 1) / (comparés + 2) : un 5 sur 5 ne passe pas devant un 15 sur 16 ; le compte brut reste affiché.
  function proximites(rep) {
    return D.partis.map((p) => {
      let accord = 0, compares = 0;
      const pastilles = D.dilemmes.map((d, i) => {
        const pos = d.positions[p.id];
        if (!pos) return "muet";
        if (!"ab".includes(rep[i])) return "passe";
        compares++;
        if (pos.choix === rep[i]) { accord++; return "accord"; }
        return "desaccord";
      });
      return { p, accord, compares, pastilles, taux: compares ? accord / compares : 0, lisse: (accord + 1) / (compares + 2), faible: compares < SEUIL };
    });
  }
  const trier = (px) => [...px].sort((x, y) => (x.faible - y.faible) || (y.lisse - x.lisse) || (y.compares - x.compares));

  // ---------- Petits morceaux d'interface ----------
  const etoileLecteur = (sc, opts = {}) => Etoile.profil([
    ...(opts.avec ? [{ ...Etoile.depuisCode(opts.avec), sorte: "contour" }] : []),
    { v: sc.map((x) => [x.na, x.nb]), muet: sc.map((x) => !x.n), sorte: "plein" },
  ], { axes: D.axes, titre: opts.titre });
  const lectureAxe = (x) => (x.n ? (x.etat === "n" ? `${esc(x.axe.n)} (${x.na} contre ${x.nb})` : `${esc(x.axe[x.etat])}, ${Math.max(x.na, x.nb)} réponses sur ${x.n}`) : `${esc(x.axe.nom)} : sans réponse`);
  const segments = (rep, i) => `<div class="segments" aria-hidden="true">${D.dilemmes.map((d, k) => `<span class="g${D.iAxe[d.axe] + 1}${k < i ? " fait" : ""}${k === i ? " courant" : ""}${rep[k] === "0" ? " passe" : ""}"></span>`).join("")}</div>`;

  // ---------- Écrans ----------
  function dessinerAccueil() {
    scene.innerHTML = accueil;
    document.title = "Votre boussole d'idées · République des mots 2027";
    if (etat.defi) {
      const b = document.createElement("p");
      b.className = "bandeau-defi";
      b.innerHTML = `<strong>On vous a lancé un défi.</strong> Faites le test : à la fin, vous verrez où vos deux boussoles divergent. Aucun parti dans la comparaison, rien n'est enregistré.`;
      scene.querySelector(".accueil").prepend(b);
      scene.querySelector('a[href="#commencer"]').setAttribute("href", `#commencer&defi=${etat.defi}`);
    }
  }

  function dessinerQuestion(rep) {
    const i = rep.length;
    if (i >= D.dilemmes.length) return aller(`r=${rep}`);
    const d = D.dilemmes[i], ia = D.iAxe[d.axe], axe = D.axes[ia];
    const ordre = inverse[d.id] ? ["b", "a"] : ["a", "b"];
    scene.innerHTML = `<section class="questionnaire g${ia + 1}">
      <div class="haut">
        ${segments(rep, i)}
        <div class="compteur"><span class="theme">${esc(axe.nom)}</span><span>${i + 1} / ${D.dilemmes.length}</span></div>
      </div>
      <div class="carte-q">
        <span class="icone" aria-hidden="true">${esc(d.icone || "")}</span>
        <h1 class="question" id="q-titre">${esc(d.question)}</h1>
      </div>
      <div class="options" role="group" aria-labelledby="q-titre">
        <button class="option" data-r="${ordre[0]}"><span class="lettre" aria-hidden="true">1</span><span>${esc(d[ordre[0]])}</span></button>
        <span class="ou" aria-hidden="true">ou</span>
        <button class="option" data-r="${ordre[1]}"><span class="lettre" aria-hidden="true">2</span><span>${esc(d[ordre[1]])}</span></button>
        <button class="option neutre" data-r="0"><span class="lettre" aria-hidden="true">3</span><span>Ça dépend, ou sans avis</span></button>
      </div>
      <div class="navigation">
        ${i ? `<button class="lien" id="q-retour">← Précédent</button>` : `<a class="lien" href="#${etat.defi ? `defi=${etat.defi}` : ""}">← Accueil</a>`}
        <span class="petit">Aucun nom de parti avant la fin</span>
      </div>
    </section>`;
    scene.querySelectorAll(".option").forEach((b) => b.addEventListener("click", () => {
      if (scene.querySelector(".choisi")) return;
      b.classList.add("choisi");
      parcouru = true;
      setTimeout(() => aller(`q=${rep}${b.dataset.r}`), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
    }));
    $("#q-retour")?.addEventListener("click", () => history.back());
    $(".option", scene).focus({ preventScroll: true });
    window.scrollTo(0, 0);
    annoncer(`Question ${i + 1} sur ${D.dilemmes.length}, ${axe.nom} : ${d.question}`);
  }

  function citation(id) {
    const c = D.citations[id];
    if (!c) return "";
    const page = c.pg ? `p. ${c.pg}` : "page web";
    return `<blockquote><p>« ${esc(c.c)} »</p><footer><a href="${esc(c.u)}" rel="noopener" target="_blank">${esc(c.t)}</a> · ${page} · ${esc(c.d)}${c.ar ? ` <span class="archive">archive ${esc(c.m ?? c.d.slice(0, 4))}</span>` : ""}</footer></blockquote>`;
  }
  function camp(d, o) {
    const ids = Object.keys(d.positions).filter((p) => d.positions[p].choix === o);
    if (!ids.length) return `<p class="petit"><em>Aucun des huit partis ne la défend dans les textes lus.</em></p>`;
    return ids.map((p) => {
      const pos = d.positions[p], parti = D.parti[p];
      return `<details class="qui"><summary><span class="sigle">${esc(parti.sigle)}</span>${esc(parti.nom)}${pos.nuance ? ` <span class="petit">(${esc(pos.nuance)})</span>` : ""}</summary>${pos.appuis.map(citation).join("")}</details>`;
    }).join("");
  }

  function blocDefi(sc) {
    const autre = etat.defi;
    const memes = sc.filter((x, i) => x.n && x.etat === autre[i]);
    const ecarts = sc.filter((x, i) => x.n && x.etat !== autre[i]);
    return `<div class="defi">
      <h2>Vos deux boussoles</h2>
      ${etoileLecteur(sc, { avec: autre, titre: "Votre étoile, en couleur, et celle de la personne qui vous a défié, en pointillés." })}
      <p class="legende-defi"><span class="pastille-vous"></span> vous <span class="pastille-ami"></span> la personne qui vous a défié</p>
      <p class="gros">Même orientation sur <strong>${memes.length} axe${memes.length > 1 ? "s" : ""} sur 4</strong>.</p>
      ${ecarts.length ? `<ul class="ecarts">${ecarts.map((x) => { const i = D.axes.indexOf(x.axe); return `<li class="g${i + 1}"><strong>${esc(x.axe.nom)}</strong> : vous, ${esc(x.axe[x.etat])} ; elle ou lui, ${esc(x.axe[autre[i]])}.</li>`; }).join("")}</ul>
      <p class="petit">De quoi discuter : les dilemmes de ces axes sont plus bas, avec ce qu'en disent les textes.</p>` : `<p class="petit">Vous penchez du même côté partout où vous avez répondu. Les dilemmes détaillés, plus bas, montrent peut-être des nuances.</p>`}
    </div>`;
  }

  function dessinerResultat(rep) {
    if (rep.length !== D.dilemmes.length) return aller(rep ? `q=${rep}` : "");
    const sc = scores(rep), code = sc.map((x) => x.etat).join("");
    const titreTexte = sc.map((x) => x.axe[x.etat]).join(" · ");
    const lecture = sc.filter((x) => x.etat !== "n").map((x) => x.axe[x.etat + "_long"]).join(" ")
      || "Aucun axe ne domine : sur chaque grande question, vos réponses se partagent entre les deux orientations.";
    const repondus = [...rep].filter((r) => r !== "0").length;
    document.title = `Ma boussole d'idées : ${titreTexte}`;

    scene.innerHTML = `<section class="resultat">
      ${parcouru ? "" : `<p class="bandeau-lien">Ce résultat a été ouvert depuis un lien : il ne vient pas de vos réponses. <a href="#commencer">Faire le test vous-même</a></p>`}
      <p class="surtitre">Ma boussole d'idées · ${repondus} réponses sur ${D.dilemmes.length}</p>
      <h1 class="titre-res">Sur 16 dilemmes, j'ai penché vers…</h1>
      <figure class="hero">
        ${etoileLecteur(sc, { titre: `Étoile de vos réponses. ${sc.map(lectureAxe).join(". ")}.` })}
        <figcaption class="petit">Chaque branche compte vos réponses vers un pôle, de 0 à 4. Les deux pôles d'un axe se font face ; un axe en pointillés n'a pas de réponse.</figcaption>
      </figure>
      <ul class="puces">${sc.map((x, i) => `<li class="g${i + 1}${x.etat === "n" ? " nuance" : ""}${x.n ? "" : " vide"}"><span class="nom">${esc(x.axe.nom)}</span><strong>${x.n ? esc(x.etat === "n" ? "Entre-deux" : x.axe[x.etat]) : "Sans réponse"}</strong><span class="compte">${x.n ? (x.etat === "n" ? `${x.na} – ${x.nb}` : `${Math.max(x.na, x.nb)}/${x.n}`) : ""}</span></li>`).join("")}</ul>
      <details class="lecture"><summary>Lire mon portrait en mots</summary><p>${esc(lecture)}</p></details>

      ${etat.defi ? blocDefi(sc) : ""}

      <div class="revelation" id="revelation">
        <h2>Et les partis ?</h2>
        <p class="petit">Vos réponses comparées à ce que tranchent les textes des huit partis, citations à l'appui.</p>
        <p><button class="btn principal" id="reveler">Révéler les partis</button></p>
        <div id="partis" hidden></div>
      </div>

      <div class="partage">
        <h2>Partager</h2>
        <div class="choix-partage" role="radiogroup" aria-label="Que partager ?">
          <label><input type="radio" name="quoi" value="invitation" checked> <span><strong>Inviter au test</strong><small>sans votre portrait</small></span></label>
          <label><input type="radio" name="quoi" value="portrait"> <span><strong>Défier avec mon portrait</strong><small>vos 4 orientations, sans parti</small></span></label>
        </div>
        <p class="petit" id="p-note"></p>
        <img id="p-image" width="1200" height="630" alt="" loading="lazy">
        <div class="boutons">
          ${navigator.share ? `<button class="btn principal" id="p-natif">Partager…</button>` : ""}
          <button class="btn" id="p-copier">Copier le lien</button>
          <a class="btn" id="p-telecharger" download="ma-boussole-idees.png">Image</a>
        </div>
        <div class="reseaux" id="p-reseaux"></div>
      </div>

      <details class="tout" id="tout"><summary><h2>Mes 16 réponses, et qui défend quoi</h2></summary>
      <p class="petit" id="details-note">Les partis de chaque option apparaissent une fois révélés.</p>
      <div id="details">${D.dilemmes.map((d, i) => `<article class="carte-d g${D.iAxe[d.axe] + 1}">
        <h3><span aria-hidden="true">${esc(d.icone || "")}</span> ${esc(d.question)}</h3>
        ${["a", "b"].map((o) => `<div class="opt-d${rep[i] === o ? " vous" : ""}"><p>${rep[i] === o ? `<span class="badge-vous">vous</span> ` : ""}${esc(d[o])}</p><div class="qui-liste" data-cache="1" hidden>${camp(d, o)}</div></div>`).join("")}
        ${rep[i] === "0" ? `<p class="petit">Vous : ça dépend, ou sans avis.</p>` : ""}
        <p class="petit" data-cache="1" hidden>${(() => { const absents = D.partis.filter((p) => !d.positions[p.id]); return absents.length ? `Ne tranchent pas dans les textes lus : ${absents.map((p) => esc(p.sigle)).join(", ")}. ` : ""; })()}<a href="../#concept-${esc(d.notion)}">La fiche complète</a></p>
      </article>`).join("")}</div></details>

      <p class="avert">${esc(D.note_methode)} ${esc(MENTION)} Beaucoup de textes cités sont les programmes de 2022 (marqués « archive ») tant que ceux de 2027 ne sont pas publiés.</p>
      <p class="fin"><a class="btn" href="#commencer">Refaire le test</a> <a class="btn" href="../">Explorer les programmes</a></p>
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
        texte = `Sur 16 dilemmes tirés des programmes, j'ai penché vers : ${titreTexte}. D'accord avec moi ? Faites le test et comparons nos boussoles.`;
        $("#p-note").textContent = "Partager votre portrait rend publique une orientation politique. Le lien ne contient ni vos réponses détaillées ni aucun parti ; votre ami verra où vos boussoles divergent.";
        $("#p-image").src = `og/${code}.png`;
        $("#p-image").alt = `Image partagée : ${titreTexte}`;
        $("#p-telecharger").href = `og/${code}.png`;
      } else {
        lien = `${URL_SITE}/test/`;
        texte = "16 dilemmes tirés des programmes, 3 minutes, aucun nom de parti avant la fin. Et vous, vous choisissez quoi ?";
        $("#p-note").textContent = "L'invitation ne dit rien de vos réponses.";
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
      catch { prompt("Copiez ce lien :", lien); }
    });
  }

  function reveler(rep) {
    const px = proximites(rep), tries = trier(px), zone = $("#partis");
    const forts = tries.filter((x) => !x.faible);
    const egaux = forts.filter((x) => x.accord === forts[0]?.accord && x.compares === forts[0]?.compares);
    const PAST = { accord: "●", desaccord: "○", muet: "·", passe: "–" };
    zone.innerHTML = `<div class="cadre-capture">
        <p class="surtitre">Mes affinités avec les textes des partis · republique.fr/test</p>
        ${Etoile.affinites(px.map((x) => ({ etiquette: x.p.sigle, detail: x.compares ? `${x.accord}/${x.compares}` : "—", taux: x.taux, faible: x.faible })),
          { titre: `Étoile des affinités, un rayon par parti dans l'ordre alphabétique. ${px.map((x) => `${x.p.nom} : d'accord sur ${x.accord} dilemmes sur ${x.compares} comparés`).join(". ")}.` })}
        <ol class="partis">${tries.map((x, k) => `<li class="${x.faible ? "peu" : ""}" style="--k:${k}">
          <span class="nom-parti"><span class="sigle">${esc(x.p.sigle)}</span>${esc(x.p.nom)}</span>
          <span class="score">${x.compares ? `${x.accord} sur ${x.compares}` : "rien à comparer"}</span>
          <span class="pastilles" aria-label="${x.pastilles.filter((p) => p === "accord").length} accords, ${x.pastilles.filter((p) => p === "desaccord").length} désaccords, ${x.pastilles.filter((p) => p === "muet").length} dilemmes non tranchés par ses textes">${x.pastilles.map((p) => `<i class="${p}">${PAST[p]}</i>`).join("")}</span>
          ${x.faible ? `<span class="petit trop-peu">Ses textes tranchent trop peu de ces dilemmes pour conclure.</span>` : ""}</li>`).join("")}</ol>
        <p class="petit legende-pastilles"><i class="accord">●</i> même choix <i class="desaccord">○</i> choix opposé <i class="muet">·</i> ses textes ne tranchent pas <i class="passe">–</i> vous étiez sans avis</p>
        <p class="avert">${esc(MENTION)}</p>
      </div>
      ${egaux.length > 1 ? `<p class="petit"><strong>Le test ne départage pas</strong> ${egaux.map((x) => esc(x.p.nom)).join(", ")} : même nombre d'accords sur le même nombre de dilemmes.</p>` : ""}
      <p class="petit">Ces 16 dilemmes portent sur des désaccords nets. Certains partis en tranchent peu dans leurs textes (${[...px].sort((a, b) => a.pastilles.filter((p) => p !== "muet").length - b.pastilles.filter((p) => p !== "muet").length).slice(0, 3).map((x) => `${esc(x.p.sigle)} : ${x.pastilles.filter((p) => p !== "muet").length}`).join(", ")}) : peu présent ici ne veut pas dire centriste, seulement que ses textes ne tranchent pas ces questions. L'étoile suit l'ordre alphabétique, jamais le classement.</p>`;
    zone.hidden = false;
    $("#reveler").closest("p").hidden = true;
    document.querySelectorAll("[data-cache]").forEach((el) => { el.hidden = false; });
    $("#details-note").hidden = true;
    zone.setAttribute("tabindex", "-1");
    zone.focus();
  }

  async function rendre() {
    etat = lireEtat();
    if (etat.mode === "accueil") return dessinerAccueil();
    try { await charger(); }
    catch { scene.innerHTML = `<p class="avert">Le test n'a pas pu se charger. Vérifiez votre connexion et rechargez la page.</p>`; return; }
    if (etat.mode === "q") dessinerQuestion(etat.rep);
    else dessinerResultat(etat.rep);
  }
  window.addEventListener("hashchange", rendre);
  // Touches 1, 2 et 3 pour répondre au clavier.
  document.addEventListener("keydown", (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const opts = scene.querySelectorAll(".option");
    if (opts.length && ["1", "2", "3"].includes(ev.key)) opts[+ev.key - 1].click();
  });
  rendre();
})();
