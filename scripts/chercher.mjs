// Usage : node scripts/chercher.mjs <id-document> "<citation>"  → indique si la citation est trouvée, et à quelle page.
import { referentiel, chercher } from "./texte.mjs";
const [id, citation] = process.argv.slice(2);
const doc = referentiel.documents.find((d) => d.id === id);
if (!doc) { console.log(`Document inconnu : ${id}`); process.exit(2); }
const r = chercher(doc, citation);
console.log(r === undefined ? "TEXTE ABSENT" : r ? `TROUVÉ page ${r.page ?? "unique"}` : "ABSENT");
process.exit(r ? 0 : 1);
