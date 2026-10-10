// Vérifie les citations puis copie le corpus à côté du site.
import { copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
execFileSync("node", [new URL("./verifier-citations.mjs", import.meta.url).pathname], { stdio: "inherit" });
copyFileSync(new URL("../data/corpus.json", import.meta.url), new URL("../site/corpus.json", import.meta.url));
console.log("site/ prêt");
