// Revérifie chaque citation publiée dans data/corpus.json contre son texte source local.
// Sortie non nulle si une citation manque ou si un texte source est absent.
import { readFileSync } from "node:fs";
import { referentiel, chercher } from "./texte.mjs";

const corpus = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url)));
const docs = new Map(referentiel.documents.map((d) => [d.id, d]));
let echecs = 0;
for (const p of corpus.propositions) {
  const r = chercher(docs.get(p.source.document), p.citation_source ?? p.citation);
  if (!r) { echecs++; console.error(`ÉCHEC ${p.id} : ${r === undefined ? "texte source absent" : "citation absente"} (${p.source.document})`); }
}
console.log(`${corpus.propositions.length - echecs}/${corpus.propositions.length} citations vérifiées`);
process.exit(echecs ? 1 : 0);
