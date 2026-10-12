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
    // Lettrine isolée par pdftotext : « F\n in du regroupement » → « Fin du regroupement ».
    if (recoller && /\p{Lu}/u.test(c) && (i === 0 || brut[i - 1] === "\n") && /^\r?\n[ \t\x07]+\p{Ll}/u.test(brut.slice(i + 1, i + 8))) {
      pousser(c, i); i++; while (/[\s\x07]/.test(brut[i])) i++; continue;
    }
    // Caractères de contrôle parasites (ex. \x07 dans « 1\x07million ») : traités comme des espaces.
    if (/[\s   \f\x00-\x08\x0e-\x1f]/.test(c)) {
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

// Motif de repérage d'un concept ou d'un terme dans les citations.
// Insensible à la casse et aux accents, borné aux mots ; un motif tout en capitales (sigle : AME, RIC, CSG)
// reste sensible à la casse. Un « * » accepte une fin de mot (« régularis* », « passoire* thermique* »).
const sansAccents = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").replace(/[’ʼ‘]/g, "'");
export function compilerMotif(m) {
  const sigle = /^[\p{Lu}\d\s'’-]+$/u.test(m) && /\p{Lu}{2}/u.test(m);
  let src = sansAccents(m).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+").replace(/'/g, "['’]");
  src = src.replace(/\*/g, "[\\p{L}-]*"); // « * » : fin de mot, en fin de motif ou entre deux mots (« passoire* thermique* »)
  const re = new RegExp(`(?<![\\p{L}\\d])${src}(?![\\p{L}\\d])`, sigle ? "u" : "iu");
  return (texte) => re.test(sansAccents(texte));
}
export const correspond = (motifs, texte) => motifs.some((m) => (m._f ??= compilerMotif(m.motif ?? m))(texte));
