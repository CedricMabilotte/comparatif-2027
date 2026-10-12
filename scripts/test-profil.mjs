// Test « Ta boussole d'idées » : prépare les données du test et ses pages de partage.
// Le test est fait de séries de 16 dilemmes (4 axes chacune) qui s'additionnent en un profil global, dans cet ordre :
//   1. data/test-profil.json                      L'essentiel (économie, justice, immigration, écologie)
//   2. data/test-series/europe-institutions.json  Europe et institutions
//   3. data/test-series/societe.json              Société, école et santé
// Chaque fichier : axes, dilemmes, positions des partis appuyées sur des ids de citations de site/corpus.json.
// Sorties : site/test/donnees.json (tout ce que la page du test charge, citations comprises, au lieu des 2 Mo du corpus)
//           site/test/p/<code>.html pour la série 1 et site/test/p/<n>-<code>.html pour la série n : une page de partage
//           par portrait (81 par série = 3 états × 4 axes), lisible sans JavaScript.
// Les images d'aperçu (site/test/og/…png) sont faites par scripts/test-profil-images.mjs (navigateur requis).
// Échoue si un appui cité n'existe pas, n'est pas vérifié ou appartient à un autre parti : un parti n'est jamais rattaché sans citation.
// Usage : node scripts/test-profil.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(RACINE, "site");
const URL_SITE = "https://republique.fr";
export const SERIES = [
  { fichier: "data/test-profil.json", court: "L'essentiel" },
  { fichier: "data/test-series/europe-institutions.json", court: "Europe et institutions" },
  { fichier: "data/test-series/societe.json", court: "Société, école et santé" },
];
const C = JSON.parse(fs.readFileSync(path.join(SITE, "corpus.json"), "utf8"));
const parId = Object.fromEntries(C.propositions.map((p) => [p.id, p]));
const Etoile = createRequire(import.meta.url)(path.join(SITE, "test", "etoile.js"));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- Données du test ----------
const erreurs = [];
const citations = {};
const idsDilemmes = new Set(), idsAxes = new Set();
const series = SERIES.map((S, k) => {
  const T = JSON.parse(fs.readFileSync(path.join(RACINE, S.fichier), "utf8"));
  const n = k + 1;
  for (const a of T.axes) {
    if (idsAxes.has(a.id)) erreurs.push(`série ${n} : axe ${a.id} déjà pris par une autre série`);
    idsAxes.add(a.id);
    for (const champ of ["nom", "a", "b", "a_long", "b_long"]) if (!a[champ]) erreurs.push(`série ${n}, axe ${a.id} : ${champ} manquant`);
    const nb = T.dilemmes.filter((d) => d.axe === a.id).length;
    if (nb !== 4) erreurs.push(`série ${n}, axe ${a.id} : ${nb} dilemmes au lieu de 4`);
  }
  if (T.axes.length !== 4) erreurs.push(`série ${n} : ${T.axes.length} axes au lieu de 4`);
  for (const d of T.dilemmes) {
    if (idsDilemmes.has(d.id)) erreurs.push(`série ${n} : dilemme ${d.id} en double`);
    idsDilemmes.add(d.id);
    if (!T.axes.some((a) => a.id === d.axe)) erreurs.push(`${d.id} : axe inconnu ${d.axe}`);
    for (const champ of ["question", "a", "b", "notion"]) if (!d[champ]) erreurs.push(`${d.id} : ${champ} manquant`);
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
  return { n, court: S.court, titre: T.titre, accroche: T.accroche, version: T.version, note_methode: T.note_methode, axes: T.axes, dilemmes: T.dilemmes };
});
if (erreurs.length) { console.error("Test de profil invalide :\n- " + erreurs.join("\n- ")); process.exit(1); }

const sortie = path.join(SITE, "test");
fs.mkdirSync(path.join(sortie, "p"), { recursive: true });
const donnees = {
  version: series.map((s) => s.version).sort().at(-1),
  note_methode: series[0].note_methode,
  series: series.map(({ n, court, titre, axes, dilemmes }) => ({ court, titre, axes, dilemmes })),
  partis: C.candidatures.map((c) => ({ id: c.id, nom: c.nom, sigle: c.sigle })),
  citations,
};
ecrire(path.join(sortie, "donnees.json"), JSON.stringify(donnees));

// ---------- Portraits : 3 états par axe (a, n pour nuancé, b), pour chaque série ----------
// Le code d'un portrait est la suite des états dans l'ordre des axes, par ex. « anbb » ; préfixé du numéro de série à partir de la 2.
const ETATS = ["a", "n", "b"];
const codes = [""];
for (let i = 0; i < 4; i++) codes.splice(0, codes.length, ...codes.flatMap((c) => ETATS.map((e) => c + e)));
export const nomPortrait = (n, code) => (n === 1 ? code : `${n}-${code}`);

function description(se, code) {
  const marques = se.axes.filter((a, i) => code[i] !== "n");
  if (!marques.length) return "Aucun axe ne domine : sur chaque grande question, les réponses se partagent entre les deux orientations.";
  return marques.map((a) => a[code[se.axes.indexOf(a)] + "_long"]).join(" ");
}
const titrePortrait = (se, code) => se.axes.map((a, i) => (code[i] === "n" ? `${a.nom} : des deux côtés` : a[code[i]])).join(" · ");

function pagePortrait(se, code) {
  const nom = nomPortrait(se.n, code);
  const canon = `${URL_SITE}/test/p/${nom}.html`;
  const titre = titrePortrait(se, code);
  const sujet = se.n === 1 ? "" : ` · ${se.court}`;
  const desc = `Ma boussole d'idées${sujet} : ${titre}. 16 dilemmes, 3 minutes, sans nom de parti avant la fin. Et toi ?`;
  const defi = `../#commencer${se.n > 1 ? `=${se.n}` : ""}&amp;defi=${code}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ma boussole d'idées${esc(sujet)} : ${esc(titre)} · République des mots 2027</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="République des mots 2027">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="Ma boussole d'idées${esc(sujet)} : ${esc(titre)}">
<meta property="og:description" content="16 dilemmes tirés des textes officiels des partis, 3 minutes, aucun nom de parti avant la fin. D'accord avec moi ? Fais le test et comparons nos boussoles.">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${URL_SITE}/test/og/${nom}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Boussole d'idées en quatre axes : ${esc(titre)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Ma boussole d'idées${esc(sujet)} : ${esc(titre)}">
<meta name="twitter:description" content="16 dilemmes tirés des textes officiels des partis. Et toi ?">
<meta name="twitter:image" content="${URL_SITE}/test/og/${nom}.png">
<link rel="stylesheet" href="../archivo.css">
<link rel="stylesheet" href="../test.css">
</head>
<body class="portrait">
<header class="tete"><a class="marque" href="../../">République des mots</a><a class="lien-tete" href="../">Le test</a></header>
<main>
<h1>Une boussole d'idées</h1>
${se.n > 1 ? `<p class="surtitre-serie">Série ${se.n} · ${esc(se.court)}</p>\n` : ""}<p class="surtitre">Sur 16 dilemmes tirés des programmes, une personne a penché vers :</p>
<ul class="mots">${se.axes.map((a, i) => `<li class="g${i + 1}${code[i] === "n" ? " nuance" : ""}">${esc(code[i] === "n" ? `${a.nom} : des deux côtés` : a[code[i]])}</li>`).join("")}</ul>
<figure class="bloc" style="margin:0">${Etoile.profil([Etoile.depuisCode(code)], { axes: se.axes, titre: `Forme type de ce portrait : ${titre}` }).replace(/<tspan class="et-n"[^>]*>[^<]*<\/tspan>/g, "")}
<figcaption class="note" style="text-align:center">Forme type de ce portrait : chaque branche pointe vers un pôle, les deux pôles d'un axe se font face.</figcaption></figure>
<details class="lecture bloc"><summary>Ce portrait en mots</summary><p>${esc(description(se, code).replaceAll("Vous penchez", "Cette personne penche"))}</p></details>
<p class="avert">Ni sondage ni consigne de vote : ce portrait résume des réponses à 16 dilemmes, pas une personne. Rien n'est enregistré, le calcul se fait sur le téléphone. Aucun parti n'apparaît avant la fin du test, et chaque rapprochement s'appuie sur une citation vérifiée.</p>
<div class="appel-fixe"><a class="gros-bouton" href="${defi}">D'accord ? Fais le test et comparons</a></div>
</main>
<footer class="pied"><p><a href="../../">republique.fr</a> · <a href="../../#a-propos">À propos</a> · <a href="../../#methode">La méthode</a> · Aucun traceur, aucun cookie. © 2026 eozen, textes et données CC BY-SA 4.0, code MIT.</p></footer>
</body>
</html>
`;
}

const attendus = new Set();
for (const se of series) for (const code of codes) {
  const f = `${nomPortrait(se.n, code)}.html`;
  attendus.add(f);
  ecrire(path.join(sortie, "p", f), pagePortrait(se, code));
}
for (const f of fs.readdirSync(path.join(sortie, "p"))) if (!attendus.has(f)) fs.unlinkSync(path.join(sortie, "p", f));
console.log(`Test de profil : ${series.length} séries, ${series.reduce((t, s) => t + s.dilemmes.length, 0)} dilemmes, ${Object.keys(citations).length} citations, ${attendus.size} portraits.`);
const couverture = Object.fromEntries(C.candidatures.map((c) => [c.id, series.map((s) => s.dilemmes.filter((d) => d.positions[c.id]).length).join("+")]));
console.log("Dilemmes tranchés par parti (par série) :", couverture);

function ecrire(f, contenu) {
  if (fs.existsSync(f) && fs.readFileSync(f, "utf8") === contenu) return;
  fs.writeFileSync(f, contenu);
}
