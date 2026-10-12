// Pages de partage statiques : une page HTML autonome par concept (site/c/<id>.html) et par terme
// (site/t/<id>.html), lisible sans JavaScript, avec un bel aperçu sur les réseaux (Open Graph, Twitter Card)
// et une version allégée pour l'intégration dans un article (?integrer). Produit aussi sitemap.xml et robots.txt.
// Idempotent : n'écrit que ce qui change et supprime les pages des fiches disparues.
// Usage : node scripts/pages-partage.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const URL_SITE = "https://republique.fr";
const C = JSON.parse(fs.readFileSync(path.join(SITE, "corpus.json"), "utf8"));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const court = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t);
const parId = Object.fromEntries(C.propositions.map((p) => [p.id, p]));
const parNotion = Object.fromEntries(C.notions.map((n) => [n.id, n]));
const sansAccent = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const parNomTerme = Object.fromEntries(C.vocabulaire.flatMap((v) => [v.terme, ...(v.variantes || [])].map((t) => [sansAccent(t), v.id])));
const nomTheme = Object.fromEntries(C.themes.map((t) => [t.id, t.nom]));
const aOg = fs.existsSync(path.join(SITE, "og.png"));
const DATE = C.meta?.genere_le ?? new Date().toISOString().slice(0, 10);

const page = (s) => (s.page ? `p. ${s.page}` : "page web");
const archive = (s) => (s.archive ? ` <span class="archive">archive ${esc(s.millesime ?? s.date.slice(0, 4))}</span>` : "");
const ref = (s) => `<a href="${esc(s.url)}" rel="noopener">${esc(s.titre)}</a> · ${page(s)} · ${esc(s.date)}${archive(s)}`;
const citation = (p) => `<blockquote><p>« ${esc(p.citation)} »</p><footer class="ref">${ref(p.source)}</footer></blockquote>`;
const etiquettes = (l) => `<p class="etiquettes">${l.filter(Boolean).map((t) => `<span class="etiquette">${esc(t)}</span>`).join("")}</p>`;

function gabarit({ type, id, titre, description, corps, ancre }) {
  const canon = `${URL_SITE}/${type}/${id}.html`;
  const titrePage = `${titre} · République des mots 2027`;
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "DefinedTerm", name: titre, description, url: canon, inDefinedTermSet: { "@type": "DefinedTermSet", name: "République des mots 2027", url: `${URL_SITE}/` } }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titrePage)}</title>
<meta name="description" content="${esc(court(description, 200))}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="République des mots 2027">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(court(description, 300))}">
<meta property="og:url" content="${canon}">
${aOg ? `<meta property="og:image" content="${URL_SITE}/og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="République des mots 2027 : les idées d'abord, les noms ensuite.">\n` : ""}<meta name="twitter:card" content="${aOg ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(titre)}">
<meta name="twitter:description" content="${esc(court(description, 200))}">
<link rel="stylesheet" href="../polices.css">
<link rel="stylesheet" href="../css/fiche.css">
<script>if (/[?&]integrer\\b/.test(location.search)) document.documentElement.classList.add("integre");</script>
<script type="application/ld+json">${ld}</script>
</head>
<body>
<header class="tete"><a class="marque" href="../">République des mots <em>2027</em></a><a class="btn principal" href="../#${ancre}">Ouvrir dans le site interactif</a></header>
<main>
${corps}
<p class="ouvrir"><a class="btn principal" href="../#${ancre}">Ouvrir dans le site interactif</a> <a class="btn" href="../#${ancre}">Signaler une erreur</a></p>
</main>
<footer class="pied">
<p>Définitions et synthèses sont des lectures éditoriales, adossées à des citations vérifiées mot pour mot dans les documents officiels des partis. La même grille s'applique à tous ; une absence signifie que les textes lus n'en disent rien. <a href="../#methode">La méthode</a> · <a href="../#corrections">Le journal des corrections</a> · <a href="https://github.com/CedricMabilotte/comparatif-2027">Code et données ouverts</a></p>
<p>Aucun traceur, aucun cookie. Fiche générée le ${esc(DATE)}.</p>
</footer>
<p class="source-integre"><a href="${canon}" target="_blank" rel="noopener">Source : republique.fr</a></p>
<script>
if (document.documentElement.classList.contains("integre")) {
  document.querySelectorAll("a[href]").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
}
</script>
</body>
</html>
`;
}

function pageConcept(n) {
  const props = (n.propositions || []).map((id) => parId[id]).filter(Boolean);
  const vocab = C.vocabulaire.filter((v) => (v.notions || []).includes(n.id));
  const partis = C.candidatures.map((c) => {
    const pos = n.positions?.[c.id];
    const texte = typeof pos === "string" ? pos : pos?.texte;
    let appuis = (pos?.appuis || []).map((id) => parId[id]).filter(Boolean);
    if (!appuis.length) appuis = props.filter((p) => p.candidature === c.id).slice(0, 3);
    return `<section class="parti"><h3><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</h3>
${texte ? `<p class="lecture">Lecture éditoriale</p><p>${esc(texte)}</p>` : appuis.length ? "" : `<p class="non-aborde">Non abordé dans les textes lus.</p>`}
${appuis.length ? `<details open><summary>${appuis.length > 1 ? `${appuis.length} citations d'appui` : "Citation d'appui"}</summary>${appuis.map(citation).join("")}</details>` : ""}</section>`;
  }).join("\n");
  const corps = `<article>
<p class="surtitre">Concept</p>
<h1>${esc(n.nom)}</h1>
${etiquettes([n.categorie, ...(n.themes || [n.theme]).map((t) => nomTheme[t] || t), (n.variantes || []).length ? `aussi : ${n.variantes.join(", ")}` : ""])}
<p class="lecture">Définition éditoriale</p>
<p class="definition">${esc(n.definition)}</p>
${n.enjeux ? `<h2>Ce qui est débattu</h2><p>${esc(n.enjeux)}</p>` : ""}
${(n.reperes || []).length ? `<h2>Repères</h2><ul class="reperes">${n.reperes.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
<h2>Ce qu'en disent les partis</h2>
<div class="partis">
${partis}
</div>
${(n.liens || []).filter((l) => parNotion[l]).length ? `<h2>Voir aussi</h2><p class="mots">${n.liens.filter((l) => parNotion[l]).map((l) => `<a class="mot" href="${esc(l)}.html">${esc(parNotion[l].nom)}</a>`).join("")}</p>` : ""}
${vocab.length ? `<h2>Vocabulaire associé</h2><p class="mots">${vocab.map((v) => `<a class="mot" href="../t/${esc(v.id)}.html">${esc(v.terme)}</a>`).join("")}</p>` : ""}
</article>`;
  return gabarit({ type: "c", id: n.id, titre: n.nom, description: n.definition, corps, ancre: `concept-${n.id}` });
}

function pageTerme(v) {
  const props = (v.propositions || []).map((id) => parId[id]).filter(Boolean);
  const emplois = C.candidatures.map((c) => {
    const k = v.usage?.[c.id] || 0, ps = props.filter((p) => p.candidature === c.id);
    return `<li><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)} : ${k ? `${k} emploi${k > 1 ? "s" : ""}` : "aucun emploi dans les textes lus"}
${ps.length ? `<details open><summary>${ps.length > 3 ? `3 citations sur ${ps.length}` : ps.length > 1 ? `${ps.length} citations` : "La citation"}</summary>${ps.slice(0, 3).map(citation).join("")}</details>` : ""}</li>`;
  }).join("\n");
  const concurrents = (v.concurrents || []).map((t) => { const id = parNomTerme[sansAccent(t)]; return id && id !== v.id ? `<a class="mot" href="${esc(id)}.html">${esc(t)}</a>` : `<span class="mot">${esc(t)}</span>`; }).join("");
  const corps = `<article>
<p class="surtitre">Vocabulaire du débat</p>
<h1>${esc(v.terme)}</h1>
${etiquettes([v.registre, ...(v.themes || [v.theme]).map((t) => nomTheme[t] || t)])}
<p class="definition">${esc(v.definition)}</p>
${v.lecture ? `<h2>Lecture</h2><p class="lecture">Lecture éditoriale</p><p>${esc(v.lecture)}</p>` : ""}
<h2>Emplois par parti</h2>
<ul class="emplois">
${emplois}
</ul>
${concurrents ? `<h2>Mots concurrents</h2><p class="mots">${concurrents}</p>` : ""}
${(v.notions || []).filter((n) => parNotion[n]).length ? `<h2>Concepts liés</h2><p class="mots">${v.notions.filter((n) => parNotion[n]).map((n) => `<a class="mot" href="../c/${esc(n)}.html">${esc(parNotion[n].nom)}</a>`).join("")}</p>` : ""}
</article>`;
  return gabarit({ type: "t", id: v.id, titre: v.terme.replace(/^«\s*|\s*»$/g, ""), description: `${v.terme} : ${v.definition}`, corps, ancre: `terme-${v.id}` });
}

// Écrit seulement si le contenu change ; renvoie 1 si écrit.
function ecrire(f, contenu) {
  if (fs.existsSync(f) && fs.readFileSync(f, "utf8") === contenu) return 0;
  fs.writeFileSync(f, contenu); return 1;
}
const bilan = {};
for (const [dossier, liste, faire] of [["c", C.notions, pageConcept], ["t", C.vocabulaire, pageTerme]]) {
  const d = path.join(SITE, dossier); fs.mkdirSync(d, { recursive: true });
  const attendus = new Set(liste.map((x) => `${x.id}.html`));
  let ecrits = 0, supprimes = 0;
  for (const x of liste) {
    if (!/^[a-z0-9-]+$/.test(x.id)) { console.warn(`Identifiant ignoré : ${x.id}`); continue; }
    ecrits += ecrire(path.join(d, `${x.id}.html`), faire(x));
  }
  for (const f of fs.readdirSync(d)) if (f.endsWith(".html") && !attendus.has(f)) { fs.unlinkSync(path.join(d, f)); supprimes++; }
  bilan[dossier] = { pages: liste.length, ecrits, supprimes };
}

const urls = [`${URL_SITE}/`, `${URL_SITE}/test/`, ...C.notions.map((n) => `${URL_SITE}/c/${n.id}.html`), ...C.vocabulaire.map((v) => `${URL_SITE}/t/${v.id}.html`)];
ecrire(path.join(SITE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${DATE}</lastmod></url>`).join("\n")}\n</urlset>\n`);
ecrire(path.join(SITE, "robots.txt"), `# République des mots 2027 : tout est public, sauf l'interface de participation.\nUser-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${URL_SITE}/sitemap.xml\n`);
console.log(`Concepts : ${bilan.c.pages} pages (${bilan.c.ecrits} écrites, ${bilan.c.supprimes} supprimées) · Termes : ${bilan.t.pages} pages (${bilan.t.ecrits} écrites, ${bilan.t.supprimes} supprimées) · sitemap : ${urls.length} adresses`);
