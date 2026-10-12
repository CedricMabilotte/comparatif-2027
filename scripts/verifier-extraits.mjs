// Usage : node scripts/verifier-extraits.mjs travail/extraits/<fichier>.json
// Contrôle un fichier d'extraits avant assemblage : document et thème connus, citation trouvée mot pour mot.
import { readFileSync } from "node:fs";
import { referentiel, chercher } from "./texte.mjs";

const extraits = JSON.parse(readFileSync(process.argv[2], "utf8"));
const docs = new Map(referentiel.documents.map((d) => [d.id, d]));
const themes = new Set(referentiel.themes.map((t) => t.id));
const concepts = new Set(referentiel.concepts.map((c) => c.id));
let ok = 0;
const parTheme = {};
extraits.forEach((e, i) => {
  const doc = docs.get(e.document);
  const motif = !doc ? `document inconnu ${e.document}` : !themes.has(e.theme) ? `thème inconnu ${e.theme}`
    : (e.concepts || []).some((c) => !concepts.has(c)) ? `concept inconnu ${e.concepts}` : !chercher(doc, e.citation) ? "citation introuvable" : null;
  if (motif) console.log(`#${i} ${motif} : ${e.citation.slice(0, 90)}`);
  else { ok++; parTheme[e.theme] = (parTheme[e.theme] || 0) + 1; }
});
console.log(`${ok}/${extraits.length} valides`, JSON.stringify(parTheme));
