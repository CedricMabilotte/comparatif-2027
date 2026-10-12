// Test « Votre boussole d'idées » : 16 dilemmes, 4 axes, résultat calculé dans le navigateur.
// Rien n'est envoyé ni stocké : les réponses vivent dans l'adresse (#q=… pendant le test, #r=… au résultat),
// ce qui permet le bouton retour du téléphone et le rechargement sans perdre sa place.
// Codage des réponses : « a », « b » ou « 0 » (sans avis), une lettre par dilemme dans l'ordre de donnees.json.
"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const scene = $("#scene");
  const accueil = scene.innerHTML;
  const URL_SITE = "https://republique.fr";
  let D = null;
  // Ordre d'affichage des deux options, tiré au hasard une fois par visite : l'option de gauche n'est pas toujours la même famille d'idées.
  const inverse = {};

  const annoncer = (t) => { $("#annonce").textContent = ""; setTimeout(() => { $("#annonce").textContent = t; }, 30); };
  const lireEtat = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h === "commencer") return { mode: "q", rep: "" };
    const m = h.match(/^([qr])=([ab0]*)$/);
    return m ? { mode: m[1], rep: m[2] } : { mode: "accueil" };
  };
  const aller = (h) => { location.hash = h; };

  async function charger() {
    if (D) return D;
    const r = await fetch("donnees.json", { cache: "no-cache" });
    D = await r.json();
    D.parti = Object.fromEntries(D.partis.map((p) => [p.id, p]));
    D.dilemmes.forEach((d) => { inverse[d.id] = Math.random() < 0.5; });
    return D;
  }

  // ---------- Calculs ----------
  function scores(rep) {
    return D.axes.map((axe) => {
      let somme = 0, n = 0;
      D.dilemmes.forEach((d, i) => { if (d.axe !== axe.id) return; const r = rep[i]; if (r === "a") { somme -= 1; n++; } else if (r === "b") { somme += 1; n++; } });
      const s = n ? somme / n : 0;
      return { axe, s, n, etat: s <= -0.5 ? "a" : s >= 0.5 ? "b" : "n" };
    });
  }
  function proximites(rep) {
    return D.partis.map((p) => {
      let accord = 0, compares = 0;
      D.dilemmes.forEach((d, i) => { const pos = d.positions[p.id]; if (!pos || !"ab".includes(rep[i])) return; compares++; if (pos.choix === rep[i]) accord++; });
      return { p, accord, compares, taux: compares ? accord / compares : 0 };
    }).sort((x, y) => (y.compares >= 4) - (x.compares >= 4) || y.taux - x.taux);
  }

  // ---------- Écrans ----------
  function dessinerAccueil() {
    scene.innerHTML = accueil;
    document.title = "Votre boussole d'idées · République des mots 2027";
  }

  function dessinerQuestion(rep) {
    const i = rep.length;
    if (i >= D.dilemmes.length) return aller(`r=${rep}`);
    const d = D.dilemmes[i], ia = D.axes.findIndex((a) => a.id === d.axe), axe = D.axes[ia];
    const ordre = inverse[d.id] ? ["b", "a"] : ["a", "b"];
    scene.innerHTML = `<section class="questionnaire g${ia + 1}">
      <div class="compteur"><span class="theme">${esc(axe.nom)}</span><span>${i + 1} / ${D.dilemmes.length}</span></div>
      <div class="progression" role="progressbar" aria-valuemin="0" aria-valuemax="${D.dilemmes.length}" aria-valuenow="${i}" aria-label="Progression"><span style="width:${(i / D.dilemmes.length) * 100}%"></span></div>
      <h1 class="question" id="q-titre">${esc(d.question)}</h1>
      <div class="options" role="group" aria-labelledby="q-titre">
        ${ordre.map((o, k) => `<button class="option" data-r="${o}"><span class="lettre" aria-hidden="true">${k ? "2" : "1"}</span><span>${esc(d[o])}</span></button>`).join("")}
      </div>
      <div class="navigation">
        ${i ? `<button class="lien" id="q-retour">← Question précédente</button>` : `<a class="lien" href="#">← Accueil</a>`}
        <button class="lien" data-r="0">Sans avis</button>
      </div>
    </section>`;
    scene.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => aller(`q=${rep}${b.dataset.r}`)));
    $("#q-retour")?.addEventListener("click", () => history.back());
    $(".option", scene).focus({ preventScroll: true });
    window.scrollTo(0, 0);
    annoncer(`Question ${i + 1} sur ${D.dilemmes.length} : ${d.question}`);
  }

  function citation(id) {
    const c = D.citations[id];
    if (!c) return "";
    const page = c.pg ? `p. ${c.pg}` : "page web";
    return `<blockquote><p>« ${esc(c.c)} »</p><footer><a href="${esc(c.u)}" rel="noopener" target="_blank">${esc(c.t)}</a> · ${page} · ${esc(c.d)}${c.ar ? ` <span class="archive">archive ${esc(c.m ?? c.d.slice(0, 4))}</span>` : ""}</footer></blockquote>`;
  }
  function camp(d, o) {
    const ids = Object.keys(d.positions).filter((p) => d.positions[p].choix === o);
    if (!ids.length) return `<p class="camp"><em>Aucun des huit partis ne la défend dans les textes lus.</em></p>`;
    return ids.map((p) => {
      const pos = d.positions[p], parti = D.parti[p];
      return `<details><summary><span class="sigle">${esc(parti.sigle)}</span>${esc(parti.nom)}${pos.nuance ? ` (${esc(pos.nuance)})` : ""}</summary>${pos.appuis.map(citation).join("")}</details>`;
    }).join("");
  }

  function dessinerResultat(rep) {
    if (rep.length !== D.dilemmes.length) return aller(rep ? `q=${rep}` : "");
    const sc = scores(rep), code = sc.map((x) => x.etat).join("");
    const lignes = sc.map((x, i) => `<span class="g${i + 1}${x.etat === "n" ? " nuance" : ""}">${esc(x.axe[x.etat])}</span>`).join(" ");
    const titreTexte = sc.map((x) => x.axe[x.etat]).join(" · ");
    const lecture = sc.filter((x) => x.etat !== "n").map((x) => x.axe[x.etat + "_long"]).join(" ")
      || "Aucun axe ne domine : sur chaque grande question, vos réponses se partagent entre les deux orientations.";
    const lienPortrait = `${URL_SITE}/test/p/${code}.html`;
    const texte = `Ma boussole d'idées face aux programmes 2027 : ${titreTexte}. Et vous ? 16 dilemmes, 3 minutes, sans nom de parti avant la fin.`;
    const u = encodeURIComponent(lienPortrait), t = encodeURIComponent(texte);
    const repondus = [...rep].filter((r) => r !== "0").length;
    document.title = `Ma boussole d'idées : ${titreTexte}`;

    scene.innerHTML = `<section class="resultat">
      <p class="surtitre">Votre boussole d'idées · ${repondus} réponses sur ${D.dilemmes.length}</p>
      <h1>${lignes}</h1>
      <ul class="axes">${sc.map((x, i) => `<li class="axe g${i + 1}"><span class="nom">${esc(x.axe.nom)}</span>
        <span class="piste" aria-hidden="true"><span class="point" style="left:${50 + x.s * 38}%"></span></span>
        <span class="poles"><span${x.etat === "a" ? ' class="actif"' : ""}>${esc(x.axe.a)}</span><span${x.etat === "b" ? ' class="actif"' : ""}>${esc(x.axe.b)}</span></span>
        <span class="lu">${x.n ? `${Math.round(Math.abs(x.s) * 100)} % vers ${esc(x.s < 0 ? x.axe.a : x.axe.b)}` : "sans réponse"}${x.etat === "n" ? ", entre-deux" : ""}</span></li>`).join("")}</ul>
      <p class="lecture-portrait">${esc(lecture)}</p>

      <div class="partage">
        <h2 style="margin-top:0">Partager votre boussole</h2>
        <img src="og/${code}.png" width="1200" height="630" alt="Image partagée : ${esc(titreTexte)}" loading="lazy">
        <p class="petit">Le lien partagé montre ce portrait et invite à faire le test. Il ne contient ni vos réponses détaillées ni les partis.</p>
        <div class="boutons">
          ${navigator.share ? `<button class="btn principal" id="p-natif">Partager…</button>` : ""}
          <a class="btn" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>
          <a class="btn" href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn" href="https://bsky.app/intent/compose?text=${t}%20${u}" target="_blank" rel="noopener">Bluesky</a>
          <a class="btn" href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener">X</a>
          <a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener">LinkedIn</a>
          <button class="btn" id="p-copier">Copier le lien</button>
          <a class="btn" href="og/${code}.png" download="ma-boussole-idees.png">Télécharger l'image</a>
        </div>
      </div>

      <div class="revelation" id="revelation">
        <h2 style="margin-top:0">Et les partis ?</h2>
        <p>Vos réponses comparées à ce que disent les programmes. Chaque rapprochement s'appuie sur une citation vérifiée, à lire plus bas.</p>
        <p><button class="btn principal" id="reveler">Révéler les partis</button></p>
        <div id="partis" hidden></div>
      </div>

      <h2>Vos 16 réponses, et qui défend quoi</h2>
      <div id="details">${D.dilemmes.map((d, i) => `<div class="detail">
        <h3>${i + 1}. ${esc(d.question)}</h3>
        <p class="votre">Vous : <strong>${rep[i] === "0" ? "sans avis" : esc(d[rep[i]])}</strong></p>
        ${["a", "b"].map((o) => `<p class="camp"><strong>« ${esc(d[o])} »</strong></p><div class="partis-camp" data-cache="1" hidden>${camp(d, o)}</div>`).join("")}
        <p class="petit partis-camp" data-cache="1" hidden>${(() => { const absents = D.partis.filter((p) => !d.positions[p.id]); return absents.length ? `Ne se prononcent pas dans les textes lus : ${absents.map((p) => esc(p.sigle)).join(", ")}.` : ""; })()} <a href="../#concept-${esc(d.notion)}">La fiche complète</a></p>
      </div>`).join("")}</div>

      <p class="avert">${esc(D.note_methode)} Ce n'est pas un sondage ni une consigne de vote. Beaucoup de textes cités sont les programmes de 2022 (marqués « archive ») tant que ceux de 2027 ne sont pas publiés.</p>
      <p><a class="btn" href="#commencer">Refaire le test</a> <a class="btn" href="../">Explorer les programmes</a></p>
    </section>`;

    $("#p-natif")?.addEventListener("click", () => navigator.share({ title: "Ma boussole d'idées", text: texte, url: lienPortrait }).catch(() => {}));
    $("#p-copier").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(lienPortrait); e.target.textContent = "Lien copié ✓"; annoncer("Lien copié."); }
      catch { prompt("Copiez ce lien :", lienPortrait); }
    });
    $("#reveler").addEventListener("click", () => {
      const px = proximites(rep), zone = $("#partis");
      zone.innerHTML = `<ul class="partis">${px.map((x) => `<li class="${x.compares < 4 ? "peu" : ""}">
          <span class="nom-parti"><span class="sigle">${esc(x.p.sigle)}</span>${esc(x.p.nom)}</span>
          <span class="score">${x.compares ? `d'accord sur ${x.accord} / ${x.compares}` : "aucun point de comparaison"}</span>
          <span class="jauge" aria-hidden="true"><span style="width:${x.taux * 100}%"></span></span></li>`).join("")}</ul>
        <p class="petit">« D'accord sur 3 / 4 » : sur combien des dilemmes où le parti s'exprime dans ses textes vous avez fait le même choix. En grisé, les partis qui s'expriment sur moins de 4 dilemmes : trop peu pour conclure. Un parti absent d'un dilemme n'est ni pour ni contre, ses textes n'en disent rien.</p>`;
      zone.hidden = false;
      $("#reveler").closest("p").hidden = true;
      document.querySelectorAll("[data-cache]").forEach((el) => { el.hidden = false; });
      zone.querySelector(".partis").setAttribute("tabindex", "-1");
      zone.querySelector(".partis").focus();
    });
    window.scrollTo(0, 0);
    scene.focus({ preventScroll: true });
  }

  async function rendre() {
    const e = lireEtat();
    if (e.mode === "accueil") return dessinerAccueil();
    try { await charger(); }
    catch { scene.innerHTML = `<p class="avert">Le test n'a pas pu se charger. Vérifiez votre connexion et rechargez la page.</p>`; return; }
    if (e.mode === "q") dessinerQuestion(e.rep);
    else dessinerResultat(e.rep);
  }
  window.addEventListener("hashchange", rendre);
  // Touches 1 et 2 pour répondre au clavier.
  document.addEventListener("keydown", (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const opts = scene.querySelectorAll(".option");
    if (opts.length && (ev.key === "1" || ev.key === "2")) opts[+ev.key - 1].click();
  });
  rendre();
})();
