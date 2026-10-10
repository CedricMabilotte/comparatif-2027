// Assemble le corpus publié à partir du référentiel et des extraits relevés par candidature.
// Chaque citation doit figurer mot pour mot dans le texte source ; sinon elle est écartée et signalée.
// Produit data/corpus.json, docs/SOURCES.md et travail/rapport.json.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { referentiel, chercher, texteDe, normaliserCitation } from "./texte.mjs";

const racine = new URL("../", import.meta.url);
const lire = (chemin, defaut) => existsSync(new URL(chemin, racine)) ? JSON.parse(readFileSync(new URL(chemin, racine))) : defaut;
const docs = new Map(referentiel.documents.map((d) => [d.id, d]));
const themes = new Set(referentiel.themes.map((t) => t.id));
const concepts = new Set(referentiel.concepts.map((c) => c.id));

const dossier = new URL("travail/extraits/", racine);
const extraits = existsSync(dossier) ? readdirSync(dossier).filter((f) => f.endsWith(".json")).flatMap((f) => lire(`travail/extraits/${f}`, [])) : [];

const propositions = [], echecs = [], vus = new Set();
let texteManquant = false;
for (const e of extraits) {
  const doc = docs.get(e.document);
  const motif = !doc ? "document inconnu" : !themes.has(e.theme) ? `thème inconnu ${e.theme}` : null;
  if (motif) { echecs.push({ ...e, motif }); continue; }
  const r = chercher(doc, e.citation);
  if (r === undefined) { texteManquant = true; echecs.push({ ...e, motif: "texte source absent" }); continue; }
  if (!r) { echecs.push({ ...e, motif: "citation introuvable mot pour mot" }); continue; }
  const cle = doc.candidature + "|" + normaliserCitation(e.citation);
  if (vus.has(cle)) continue;
  vus.add(cle);
  propositions.push({
    id: "p" + createHash("sha1").update(cle).digest("hex").slice(0, 8),
    candidature: doc.candidature, theme: e.theme,
    concepts: (e.concepts || []).filter((c) => concepts.has(c)),
    intitule: e.intitule || null,
    citation: e.citation.replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl").replace(/\s+/g, " ").trim(),
    source: { document: doc.id, titre: doc.titre, url: doc.url, page: r.page, date: doc.date, archive: doc.archive },
    statut: "verifie",
  });
}

// Corrections de relecture (data/corrections.json) : { "<id>": { theme?, concepts?, intitule?, exclure? } }.
const corrections = lire("data/corrections.json", {});
for (let i = propositions.length - 1; i >= 0; i--) {
  const p = propositions[i], c = corrections[p.id];
  if (!c) continue;
  if (c.exclure) { propositions.splice(i, 1); continue; }
  if (c.theme && themes.has(c.theme)) p.theme = c.theme;
  if (c.concepts) p.concepts = c.concepts.filter((k) => concepts.has(k));
  if (c.intitule) p.intitule = c.intitule;
}

// Le lexique ne garde que les appuis qui existent dans le corpus.
const ids = new Set(propositions.map((p) => p.id));
const lexique = lire("data/lexique.json", {});
for (const c of Object.values(lexique)) for (const f of Object.values(c)) f.appuis = (f.appuis || []).filter((id) => ids.has(id));

const compte = {};
for (const p of propositions) { compte[p.candidature] ??= {}; compte[p.candidature][p.theme] = (compte[p.candidature][p.theme] || 0) + 1; }

const corpus = {
  meta: { version: "1.0.0-beta", genere_le: new Date().toISOString().slice(0, 10),
    avertissement: "Bêta : corpus relevé dans les documents écrits officiels des formations, en cours de relecture. Chaque citation est vérifiée mot pour mot dans sa source." },
  candidatures: referentiel.candidatures,
  documents: referentiel.documents.map(({ fichier, telechargement, ...d }) => ({ ...d, citations: propositions.filter((p) => p.source.document === d.id).length })),
  themes: referentiel.themes, concepts: referentiel.concepts, propositions, lexique,
};
writeFileSync(new URL("data/corpus.json", racine), JSON.stringify(corpus, null, 1));

// Fiche des sources : ce qui a été lu, d'où, et l'empreinte du texte local qui a servi à vérifier.
const lignes = ["# Sources du corpus", "", "Documents écrits officiels lus pour relever les propositions. Les textes intégraux ne sont pas publiés dans ce dépôt (droit d'auteur) : ils sont conservés en copie locale et `scripts/telecharger-sources.sh` les reconstitue depuis les adresses ci-dessous. L'empreinte SHA-256 permet de vérifier qu'on relit le même texte.", ""];
for (const c of referentiel.candidatures) {
  lignes.push(`## ${c.nom} (${c.sigle})`, "", `Candidat : ${c.candidat} (${c.statut_candidat}). Programme 2027 : ${c.statut_programme}.`, "");
  lignes.push("| Document | Date | Statut | Citations | Empreinte du texte |", "|---|---|---|---|---|");
  for (const d of referentiel.documents.filter((d) => d.candidature === c.id)) {
    const t = texteDe(d);
    const empreinte = t ? createHash("sha256").update(t.brut).digest("hex").slice(0, 16) : "absent";
    const n = propositions.filter((p) => p.source.document === d.id).length;
    lignes.push(`| [${d.titre}](${d.url}) | ${d.date} | ${d.archive ? "archive" : "en vigueur"} | ${n} | \`${empreinte}\` |`);
  }
  const just = referentiel.documents.filter((d) => d.candidature === c.id && d.justification).map((d) => d.justification);
  if (just.length) lignes.push("", ...just.map((j) => `> ${j}`));
  lignes.push("");
}
writeFileSync(new URL("docs/SOURCES.md", racine), lignes.join("\n"));

mkdirSync(new URL("travail/", racine), { recursive: true });
writeFileSync(new URL("travail/rapport.json", racine), JSON.stringify({ total: propositions.length, echecs, compte }, null, 1));
console.log(`${propositions.length} propositions vérifiées, ${echecs.length} écartées`);
for (const c of referentiel.candidatures) console.log(c.id.padEnd(12), referentiel.themes.map((t) => `${t.id}:${compte[c.id]?.[t.id] || 0}`).join(" "));
if (texteManquant) console.log("Attention : textes sources absents, lancer scripts/telecharger-sources.sh");
process.exit(echecs.length && process.argv.includes("--strict") ? 1 : 0);
