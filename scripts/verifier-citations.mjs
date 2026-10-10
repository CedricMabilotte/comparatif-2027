// Vérifie que chaque citation figure mot pour mot dans son document source.
// Une proposition qui échoue n'est pas publiable. Sortie non nulle en cas d'échec.
import { readFileSync } from "node:fs";

const normaliser = (t) => t.replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
const corpus = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url)));
const cache = new Map();
let echecs = 0;

for (const p of corpus.propositions) {
  const fichier = new URL(`../${p.source.fichier}`, import.meta.url);
  if (!cache.has(p.source.fichier)) cache.set(p.source.fichier, normaliser(readFileSync(fichier, "utf8")));
  if (!cache.get(p.source.fichier).includes(normaliser(p.citation))) {
    echecs++;
    console.error(`ÉCHEC ${p.id} : citation absente de ${p.source.fichier}`);
  }
}
console.log(`${corpus.propositions.length - echecs}/${corpus.propositions.length} citations vérifiées`);
process.exit(echecs ? 1 : 0);
