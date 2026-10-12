// Essai de motifs sur le corpus : node scripts/motifs.mjs "droit du sol" "AME" ["régularis*" …]
// Affiche le nombre de citations repérées par parti et quelques exemples, pour régler les motifs sans faux positifs.
import { readFileSync } from "node:fs";
import { compilerMotif } from "./texte.mjs";
const C = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url)));
const motifs = process.argv.slice(2).map(compilerMotif);
const vus = C.propositions.filter((p) => motifs.some((f) => f(p.citation)));
const par = {};
for (const p of vus) par[p.candidature] = (par[p.candidature] ?? 0) + 1;
console.log(`${vus.length} citations`, JSON.stringify(par));
for (const p of vus.slice(0, Number(process.env.N ?? 6))) console.log(`- ${p.id} [${p.candidature}] ${p.citation.slice(0, 160)}`);
