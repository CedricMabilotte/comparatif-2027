// Test « Votre boussole d'idées » : prépare les données du test et ses pages de partage.
// Entrée : data/test-profil.json (dilemmes, axes, positions des partis appuyées sur des ids de citations)
//          et site/corpus.json (citations vérifiées).
// Sorties : site/test/donnees.json (tout ce que la page du test charge, citations comprises, ~40 Ko au lieu des 2 Mo du corpus)
//           site/test/p/<code>.html, une page de partage par portrait (81 = 3 états × 4 axes), lisible sans JavaScript.
// Les images d'aperçu (site/test/og/<code>.png) sont faites par scripts/test-profil-images.mjs (navigateur requis).
// Échoue si un appui cité n'existe pas ou n'est pas vérifié : un parti n'est jamais rattaché sans citation.
// Usage : node scripts/test-profil.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(RACINE, "site");
const URL_SITE = "https://republique.fr";
const T = JSON.parse(fs.readFileSync(path.join(RACINE, "data", "test-profil.json"), "utf8"));
const C = JSON.parse(fs.readFileSync(path.join(SITE, "corpus.json"), "utf8"));
const parId = Object.fromEntries(C.propositions.map((p) => [p.id, p]));
const Etoile = createRequire(import.meta.url)(path.join(SITE, "test", "etoile.js"));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Données du test ----------
const erreurs = [];
const citations = {};
for (const d of T.dilemmes) {
  if (!T.axes.some((a) => a.id === d.axe)) erreurs.push(`${d.id} : axe inconnu ${d.axe}`);
  for (const [parti, pos] of Object.entries(d.positions)) {
    if (!C.candidatures.some((c) => c.id === parti)) erreurs.push(`${d.id} : parti inconnu ${parti}`);
    if (!["a", "b"].includes(pos.choix)) erreurs.push(`${d.id}/${parti} : choix ${pos.choix}`);
    if (!pos.appuis?.length) erreurs.push(`${d.id}/${parti} : aucun appui`);
    for (const id of pos.appuis || []) {
      const p = parId[id];
      if (!p) { erreurs.push(`${d.id}/${parti} : citation ${id} introuvable`); continue; }
      if (p.candidature !== parti) erreurs.push(`${d.id}/${parti} : citation ${id} appartient à ${p.candidature}`);
      if (p.statut !== "verifie") erreurs.push(`${d.id}/${parti} : citation ${id} non vérifiée`);
      citations[id] = { c: p.citation, t: p.source.titre, u: p.source.url, pg: p.source.page ?? null, d: p.source.date, ar: !!p.source.archive, m: p.source.millesime ?? null };
    }
  }
}
for (const a of T.axes) {
  const n = T.dilemmes.filter((d) => d.axe === a.id).length;
  if (n !== 4) erreurs.push(`axe ${a.id} : ${n} dilemmes au lieu de 4`);
}
if (erreurs.length) { console.error("Test de profil invalide :\n- " + erreurs.join("\n- ")); process.exit(1); }

const sortie = path.join(SITE, "test");
fs.mkdirSync(path.join(sortie, "p"), { recursive: true });
const donnees = {
  version: T.version, titre: T.titre, accroche: T.accroche, note_methode: T.note_methode,
  axes: T.axes, dilemmes: T.dilemmes,
  partis: C.candidatures.map((c) => ({ id: c.id, nom: c.nom, sigle: c.sigle })),
  citations,
};
ecrire(path.join(sortie, "donnees.json"), JSON.stringify(donnees));

// ---------- Portraits : 3 états par axe (a, n pour nuancé, b) ----------
// Le code d'un portrait est la suite des états dans l'ordre des axes, par ex. « anbb ».
export const ETATS = ["a", "n", "b"];
const codes = [""];
for (const _ of T.axes) codes.splice(0, codes.length, ...codes.flatMap((c) => ETATS.map((e) => c + e)));

const ligne = (axe, e) => axe[e];
function description(code) {
  const marques = T.axes.filter((a, i) => code[i] !== "n");
  if (!marques.length) return "Aucun axe ne domine : sur chaque grande question, vos réponses se partagent entre les deux orientations.";
  return marques.map((a) => a[code[T.axes.indexOf(a)] + "_long"]).join(" ");
}
const titrePortrait = (code) => T.axes.map((a, i) => ligne(a, code[i])).join(" · ");

function pagePortrait(code) {
  const canon = `${URL_SITE}/test/p/${code}.html`;
  const titre = titrePortrait(code);
  const desc = `Ma boussole d'idées face aux programmes 2027 : ${titre}. 16 dilemmes, 3 minutes, sans nom de parti avant la fin. Et vous ?`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ma boussole d'idées : ${esc(titre)} · République des mots 2027</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="République des mots 2027">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="Ma boussole d'idées : ${esc(titre)}">
<meta property="og:description" content="16 dilemmes tirés des textes officiels des partis, 3 minutes, aucun nom de parti avant la fin. D'accord avec moi ? Faites le test et comparons nos boussoles.">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${URL_SITE}/test/og/${code}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Boussole d'idées en quatre axes : ${esc(titre)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Ma boussole d'idées : ${esc(titre)}">
<meta name="twitter:description" content="16 dilemmes tirés des textes officiels des partis. Et vous ?">
<meta name="twitter:image" content="${URL_SITE}/test/og/${code}.png">
<link rel="stylesheet" href="../../polices.css">
<link rel="stylesheet" href="../test.css">
</head>
<body class="portrait">
<header class="tete"><a class="marque" href="../../">République des mots <em>2027</em></a></header>
<main>
<p class="surtitre">Sur 16 dilemmes tirés des programmes, une personne a penché vers</p>
<h1>${T.axes.map((a, i) => `<span class="g${i + 1}${code[i] === "n" ? " nuance" : ""}">${esc(ligne(a, code[i]))}</span>`).join(" ")}</h1>
<p class="appel"><a class="btn principal" href="../#commencer&amp;defi=${code}">D'accord ? Faites le test et comparez</a></p>
<figure class="hero">${Etoile.profil([Etoile.depuisCode(code)], { axes: T.axes, titre: `Forme type de ce portrait : ${titre}` }).replace(/<tspan class="et-n"[^>]*>[^<]*<\/tspan>/g, "")}
<figcaption class="petit">Forme type de ce portrait : chaque branche pointe vers un pôle, les deux pôles d'un axe se font face.</figcaption></figure>
<details class="lecture"><summary>Lire ce portrait en mots</summary><p>${esc(description(code).replaceAll("Vous penchez", "Cette personne penche"))}</p></details>
<p class="avert">Ni sondage ni consigne de vote : ce portrait résume des réponses à 16 dilemmes, pas une personne. Rien n'est enregistré, le calcul se fait dans le navigateur. Aucun parti n'apparaît avant la fin du test, et chaque rapprochement s'appuie sur une citation vérifiée.</p>
<div class="appel-fixe"><a class="btn principal" href="../#commencer&amp;defi=${code}">Faire le test : 16 dilemmes, 3 minutes</a></div>
</main>
<footer class="pied"><p><a href="../../">republique.fr</a> · <a href="../../#a-propos">À propos</a> · <a href="../../#methode">La méthode</a> · Aucun traceur, aucun cookie. © 2026 eozen, textes et données CC BY-SA 4.0, code MIT.</p></footer>
</body>
</html>
`;
}

const attendus = new Set();
for (const code of codes) { attendus.add(`${code}.html`); ecrire(path.join(sortie, "p", `${code}.html`), pagePortrait(code)); }
for (const f of fs.readdirSync(path.join(sortie, "p"))) if (!attendus.has(f)) fs.unlinkSync(path.join(sortie, "p", f));
console.log(`Test de profil : ${T.dilemmes.length} dilemmes, ${Object.keys(citations).length} citations, ${codes.length} portraits.`);

function ecrire(f, contenu) {
  if (fs.existsSync(f) && fs.readFileSync(f, "utf8") === contenu) return;
  fs.writeFileSync(f, contenu);
}
