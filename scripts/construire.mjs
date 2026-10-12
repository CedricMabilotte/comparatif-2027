// Assemble le corpus (citations vérifiées) puis en dépose une copie compacte à côté du site.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
execFileSync("node", [new URL("./assembler.mjs", import.meta.url).pathname], { stdio: "inherit" });
const corpus = JSON.parse(readFileSync(new URL("../data/corpus.json", import.meta.url)));
writeFileSync(new URL("../site/corpus.json", import.meta.url), JSON.stringify(corpus));
execFileSync("node", [new URL("./pages-partage.mjs", import.meta.url).pathname], { stdio: "inherit" });
console.log("site/ prêt");
