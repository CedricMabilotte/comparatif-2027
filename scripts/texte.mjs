// Outils partagés : lecture des textes sources et recherche d'une citation mot pour mot.
// Les textes intégraux (sources/*.txt) ne sont pas versionnés : scripts/telecharger-sources.sh les reconstitue.
import { readFileSync, existsSync } from "node:fs";

const racine = new URL("../", import.meta.url);
export const referentiel = JSON.parse(readFileSync(new URL("data/referentiel.json", racine)));
export const fichierDe = (doc) => new URL(`sources/${doc.fichier || doc.id}.txt`, racine);

// Normalise en gardant, pour chaque caractère produit, sa position dans le texte brut
// (pour retrouver la page : pdftotext sépare les pages par un saut de page \f).
function normaliser(brut, recoller) {
  let sortie = "", carte = [], i = 0;
  const pousser = (c, j) => { sortie += c; carte.push(j); };
  while (i < brut.length) {
    const c = brut[i];
    if (recoller && c === "-" && /^-[ \t]*\r?\n\s*\p{Ll}/u.test(brut.slice(i, i + 40))) {
      i++; while (/\s/.test(brut[i])) i++; continue; // césure de fin de ligne : pro-\ngramme
    }
    if (/[\s   \f]/.test(c)) {
      if (sortie && sortie[sortie.length - 1] !== " ") pousser(" ", i);
      i++; continue;
    }
    if (c === "­") { i++; continue; }
    const remplacements = { "’": "'", "‘": "'", "ʼ": "'", "`": "'", "´": "'", "“": '"', "”": '"', "ﬁ": "fi", "ﬂ": "fl", "…": "...", "–": "-", "—": "-", "‑": "-" };
    const r = remplacements[c] ?? c;
    for (const x of r) pousser(x, i);
    i++;
  }
  return { texte: sortie, carte };
}
export const normaliserCitation = (t) => normaliser(t.normalize("NFC"), false).texte.trim();

const cache = new Map();
export function texteDe(doc) {
  if (!cache.has(doc.id)) {
    const f = fichierDe(doc);
    if (!existsSync(f)) return null;
    const brut = readFileSync(f, "utf8").normalize("NFC");
    cache.set(doc.id, { brut, variantes: [normaliser(brut, true), normaliser(brut, false)] });
  }
  return cache.get(doc.id);
}

// Renvoie { page } si la citation figure dans le document, null sinon, undefined si le texte manque.
export function chercher(doc, citation) {
  const t = texteDe(doc);
  if (!t) return undefined;
  const cible = normaliserCitation(citation);
  for (const v of t.variantes) {
    const pos = v.texte.indexOf(cible);
    if (pos >= 0) {
      const brutAvant = t.brut.slice(0, v.carte[pos]);
      const pages = (brutAvant.match(/\f/g) || []).length;
      return { page: t.brut.includes("\f") ? pages + 1 : null };
    }
  }
  return null;
}
