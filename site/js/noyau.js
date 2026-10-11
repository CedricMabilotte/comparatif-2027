// Noyau du site : données, mémoire volontaire, navigation avec retour, panneaux et partage.
// Chaque rubrique est un module (js/<rubrique>.js) qui s'enregistre avec R.module(nom, init) ;
// demarrer.js charge le corpus puis appelle les modules dans l'ordre des balises <script>.
"use strict";
const R = (window.R = { modules: [], routes: [], partageurs: {}, ecouteurs: {} });

R.$ = (s, racine = document) => racine.querySelector(s);
R.$$ = (s, racine = document) => [...racine.querySelectorAll(s)];
R.esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
R.sansAccent = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
R.melange = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
R.pluriel = (n, mot, pl = mot + "s") => `${n} ${n > 1 ? pl : mot}`;
R.module = (nom, init) => R.modules.push([nom, init]);
R.on = (evt, f) => (R.ecouteurs[evt] ??= []).push(f);
R.emettre = (evt, ...a) => (R.ecouteurs[evt] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });

// Mémoire volontaire. Par défaut rien ne survit à la fermeture de l'onglet (sessionStorage).
// Si le visiteur l'accepte, ses votes, scores et lectures restent sur son appareil (localStorage).
// Le seul élément toujours retenu est son choix lui-même, pour ne pas reposer la question à chaque page.
const CLE_CHOIX = "rdm-choix";
R.choix = (() => { try { return JSON.parse(localStorage.getItem(CLE_CHOIX)); } catch { return null; } })();
const memoire = () => (R.choix?.memoire ? localStorage : sessionStorage);
R.lire = (k, d) => { try { return JSON.parse(memoire().getItem(k)) ?? d; } catch { return d; } };
R.ecrire = (k, v) => { try { memoire().setItem(k, JSON.stringify(v)); } catch {} };
R.choisir = (nouveau) => {
  const avant = memoire();
  R.choix = { ...(R.choix || {}), ...nouveau, le: new Date().toISOString().slice(0, 10) };
  try {
    localStorage.setItem(CLE_CHOIX, JSON.stringify(R.choix));
    const apres = memoire();
    if (avant !== apres) {
      for (let i = 0; i < avant.length; i++) { const k = avant.key(i); if (k !== CLE_CHOIX) apres.setItem(k, avant.getItem(k)); }
      if (avant === localStorage) Object.keys(localStorage).filter((k) => k !== CLE_CHOIX).forEach((k) => localStorage.removeItem(k));
      else sessionStorage.clear();
    }
  } catch {}
  R.emettre("choix", R.choix);
};
R.oublierTout = () => { try { localStorage.clear(); sessionStorage.clear(); } catch {} R.choix = null; };

// API participative. Hors ligne (aperçu, API absente), le site garde tout dans le navigateur.
R.enLigne = false;
R.api = async (route, donnees, params = "") => {
  const r = await fetch(`api/index.php?r=${route}${params}`, donnees === undefined ? { credentials: "same-origin" }
    : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees) }).catch(() => null);
  if (!r || !(r.headers.get("content-type") || "").includes("json")) return null;
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
};

// Références et fiches communes à toutes les rubriques
R.archive = (s) => s.archive ? `<span class="archive">archive ${s.millesime ?? s.date.slice(0, 4)}</span>` : "";
R.page = (s) => s.page ? `p. ${s.page}` : "page web";
R.refHTML = (s) => `<a href="${R.esc(s.url)}" target="_blank" rel="noopener">${R.esc(s.titre)}</a> · ${R.page(s)} · ${s.date}${R.archive(s)}`;
R.boutonPartage = (type, id, libelle = "Partager") => `<button class="lien-partage" data-partage="${type}:${R.esc(id)}">${libelle}</button>`;
R.ficheHTML = (p, { mots = true, motActif = null } = {}) => {
  const ks = mots && p.concepts.length ? `<div class="mots">${p.concepts.map((k) => `<button class="mot" data-mot="${k}" data-actif="${motActif === k}">${R.esc(R.nomConcept[k])}</button>`).join("")}</div>` : "";
  const titre = p.intitule ? `<p class="intitule">${R.esc(p.intitule)}</p>` : "";
  return `<blockquote class="prop">${titre}<p>${R.esc(p.citation)}</p><span class="ref">${R.refHTML(p.source)}</span>${ks}<span class="actions"><a class="lien-partage" href="#prop-${p.id}">Ouvrir</a>${R.boutonPartage("prop", p.id)}</span></blockquote>`;
};
R.lectureHTML = (f) => {
  if (!f) return `<p class="def">Pas encore analysé.</p>`;
  if (typeof f === "string") return `<p class="def">${R.esc(f)}</p>`;
  const appuis = (f.appuis || []).map((id) => R.parId[id]).filter(Boolean);
  return `<span class="lecture">Lecture éditoriale</span><p class="def">${R.esc(f.texte)}</p>`
    + (appuis.length ? `<p class="ref">Appuis : ${appuis.map((p) => `<a href="#prop-${p.id}">« ${R.esc(p.citation.length > 90 ? p.citation.slice(0, 90) + "…" : p.citation)} »</a>${R.archive(p.source)}`).join(" ; ")}</p>` : "");
};

// Navigation : chaque écran a une adresse (#matrice, #concept-gpa, #jouer/quiz…), le bouton
// « Retour » du navigateur et celui du bandeau ramènent à l'écran précédent, à la même hauteur.
R.route = (motif, f) => R.routes.push([motif, f]);
R.vueCourante = null;
R.montrer = (id, { haut = true } = {}) => {
  R.$$("main > .vue").forEach((v) => { v.hidden = v.id !== id; });
  R.$$("#onglets a").forEach((a) => a.dataset.vue === id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  const lien = R.$(`#onglets a[data-vue="${id}"]`);
  lien?.scrollIntoView({ block: "nearest", inline: "nearest" });
  const titre = lien?.textContent || R.$(`#${id}`)?.getAttribute("aria-label");
  document.title = id === "accueil" ? "République des mots 2027" : `${titre} · République des mots 2027`;
  if (R.vueCourante !== id) { R.vueCourante = id; R.emettre("vue", id); }
  if (haut) window.scrollTo(0, 0);
};
R.aller = (h) => {
  h = h.replace(/^#/, "");
  if (location.hash.slice(1) === h) { naviguer(); return; }
  history.replaceState({ ...(history.state || {}), y: window.scrollY }, "");
  history.pushState({ n: (history.state?.n || 0) + 1 }, "", "#" + h);
  naviguer();
};
function naviguer() {
  const h = decodeURIComponent(location.hash.slice(1)) || "accueil";
  R.$("#retour").hidden = !(history.state?.n > 0);
  fermerPanneaux();
  for (const [motif, f] of R.routes) {
    const m = typeof motif === "string" ? (h === motif ? [h] : null) : h.match(motif);
    if (m && f(m) !== false) return restaurer();
  }
  R.montrer(R.$(`main > .vue#${CSS.escape(h)}`) ? h : "accueil");
  restaurer();
}
function restaurer() { const y = history.state?.y; if (y != null) requestAnimationFrame(() => window.scrollTo(0, y)); }
R.demarrerNavigation = () => {
  if (!history.state) history.replaceState({ n: 0 }, "");
  // Un lien interne (<a href="#…">) ajoute une entrée d'historique numérotée, comme R.aller.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.target) return;
    e.preventDefault(); R.aller(a.getAttribute("href"));
  });
  window.addEventListener("popstate", naviguer);
  R.$("#retour").addEventListener("click", () => history.back());
  naviguer();
};

// Panneau générique (fiche d'une proposition, résultats d'un test…)
R.ouvrirPanneau = (titre, html) => {
  R.$("#fi-titre").textContent = titre; R.$("#fi-corps").innerHTML = html;
  R.$("#fiche").hidden = false; R.$("#fi-fermer").focus();
};
function fermerPanneaux() { R.$("#fiche").hidden = true; R.$("#partage").hidden = true; }
// Fermer la fiche d'une proposition ramène à l'écran d'où on l'a ouverte.
function fermerFiche() {
  R.$("#fiche").hidden = true;
  if (!/^#prop-/.test(location.hash)) return;
  if (history.state?.n > 0) history.back();
  else history.replaceState(history.state, "", "#" + (R.vueCourante || "accueil"));
}
R.fermerPanneaux = fermerPanneaux;

// Partage : image en trois formats, texte et lien, envoi direct depuis un téléphone, code d'intégration.
// Un module ajoute un type partageable avec R.partageurs[type] = (id) => ({ surtitre, corps, pied, texte, ancre, integrer? }).
const FORMATS = { carre: [1080, 1080], paysage: [1200, 675], story: [1080, 1920] };
let aPartager = null, imageCourante = null;
function lignes(ctx, texte, largeur) {
  const out = []; let l = "";
  for (const m of texte.split(" ")) { const t = l ? l + " " + m : m; if (ctx.measureText(t).width > largeur && l) { out.push(l); l = m; } else l = t; }
  if (l) out.push(l); return out;
}
function dessinerImage() {
  const fmt = R.$('input[name="fmt"]:checked').value;
  const [W, H] = FORMATS[fmt], cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), m = Math.round(W * 0.08), defi = !!aPartager.defi;
  x.fillStyle = defi ? "#1b2130" : "#f4f5f7"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#3346c8"; x.fillRect(0, 0, W, Math.round(H * 0.012) + 6);
  const encre = defi ? "#f4f5f7" : "#1b2130", douce = defi ? "#aab3c8" : "#5a6275";
  x.fillStyle = defi ? "#8c9bff" : "#5a6275"; x.font = `500 ${Math.round(W * 0.03)}px "Bricolage Grotesque", sans-serif`;
  x.fillText(aPartager.surtitre.toUpperCase(), m, m + W * 0.03);
  let taille = Math.round(W * (fmt === "paysage" ? 0.048 : 0.062)), ls;
  do { x.font = `400 ${taille}px "Newsreader", Georgia, serif`; ls = lignes(x, aPartager.corps, W - 2 * m); taille -= 2; } while (ls.length * taille * 1.3 > H * 0.55 && taille > 20);
  x.fillStyle = encre; const y0 = (H - ls.length * taille * 1.3) / 2;
  ls.forEach((l, i) => x.fillText(l, m, y0 + (i + 1) * taille * 1.3));
  x.fillStyle = douce; x.font = `400 ${Math.round(W * 0.026)}px "Newsreader", Georgia, serif`;
  lignes(x, aPartager.pied, W - 2 * m).forEach((l, i, t) => x.fillText(l, m, H - m - (t.length - 1 - i) * W * 0.035 - W * 0.03));
  x.fillStyle = defi ? "#8c9bff" : "#3346c8"; x.font = `700 ${Math.round(W * 0.03)}px "Bricolage Grotesque", sans-serif`;
  x.fillText("republique.fr", m, H - m);
  imageCourante = cv;
  R.$("#pt-image").src = cv.toDataURL("image/png");
}
R.partager = (objet) => {
  aPartager = objet;
  const lien = `https://republique.fr/${objet.page ?? ""}#${objet.ancre}`, t = encodeURIComponent(objet.texte), u = encodeURIComponent(lien), tu = encodeURIComponent(`${objet.texte} ${lien}`);
  R.$("#pt-texte").value = `${objet.texte}\n${lien}`;
  R.$("#pt-etat").textContent = "";
  R.$("#pt-reseaux").innerHTML = [
    ["Bluesky", `https://bsky.app/intent/compose?text=${tu}`],
    ["X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ["Mastodon", `https://mastodonshare.com/?text=${tu}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["WhatsApp", `https://wa.me/?text=${tu}`],
    ["Telegram", `https://t.me/share/url?url=${u}&text=${t}`],
  ].map(([n, h]) => `<a class="btn" href="${h}" target="_blank" rel="noopener">${n}</a>`).join("");
  R.$("#pt-envoyer").hidden = !navigator.share;
  R.$("#pt-integrer").hidden = !objet.integrer;
  R.$("#pt-code").value = objet.integrer ? `<iframe src="https://republique.fr/integrer.html?${objet.integrer}" width="100%" height="520" style="border:1px solid #d9dce4;border-radius:12px" loading="lazy" title="${R.esc(objet.surtitre)}"></iframe>` : "";
  R.$("#partage").hidden = false; dessinerImage(); R.$("#pt-fermer").focus();
};
R.initPartage = () => {
  R.$$('input[name="fmt"]').forEach((r) => r.addEventListener("change", dessinerImage));
  R.$("#pt-fermer").onclick = () => { R.$("#partage").hidden = true; };
  R.$("#fi-fermer").onclick = fermerFiche;
  R.$("#partage").addEventListener("click", (e) => { if (e.target.id === "partage") R.$("#partage").hidden = true; });
  R.$("#fiche").addEventListener("click", (e) => { if (e.target.id === "fiche") fermerFiche(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!R.$("#partage").hidden) R.$("#partage").hidden = true; else if (!R.$("#fiche").hidden) fermerFiche();
  });
  R.$("#pt-copier").onclick = async () => {
    try { await navigator.clipboard.writeText(R.$("#pt-texte").value); R.$("#pt-etat").textContent = "Copié."; }
    catch { R.$("#pt-texte").select(); R.$("#pt-etat").textContent = "Texte sélectionné : copiez-le avec Ctrl+C."; }
  };
  R.$("#pt-copier-code").onclick = async () => {
    try { await navigator.clipboard.writeText(R.$("#pt-code").value); R.$("#pt-etat").textContent = "Code copié."; } catch { R.$("#pt-code").select(); }
  };
  R.$("#pt-envoyer").onclick = async () => {
    const lien = R.$("#pt-texte").value;
    try {
      const blob = await new Promise((ok) => imageCourante.toBlob(ok, "image/png"));
      const fichier = new File([blob], "republique-des-mots.png", { type: "image/png" });
      const donnees = { text: lien };
      if (navigator.canShare?.({ files: [fichier] })) donnees.files = [fichier];
      await navigator.share(donnees);
    } catch {}
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-partage]"); if (!b) return;
    const [type, ...reste] = b.dataset.partage.split(":"), f = R.partageurs[type];
    const objet = f?.(reste.join(":"));
    if (objet) R.partager(objet);
  });
};
