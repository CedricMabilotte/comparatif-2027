// Parcours complet du test « boussole d'idées » sur un téléphone simulé (Playwright, Chromium).
// Prérequis : servir site/ sur http://localhost:8123 (par ex. npx http-server site -p 8123 -s).
// Vérifie : 16 questions, retour arrière, « sans avis », résultat, révélation des partis, page de portrait, aucune erreur JS,
// et qu'aucune requête ne part vers un autre domaine que le site (promesse « aucun traceur »).
// Usage : node tests/test-boussole.mjs
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(process.execPath, "..", "..", "lib", "node_modules", "playwright")); }
const BASE = process.env.BASE || "http://localhost:8123";
let echecs = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "ÉCHEC"} ${msg}`); if (!cond) echecs++; };

const nav = await playwright.chromium.launch();
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });
const erreurs = [], ailleurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) ailleurs.push(r.url()); });

await page.goto(`${BASE}/test/`);
await page.click("text=Commencer");
await page.waitForSelector(".option");
ok((await page.textContent(".compteur")).includes("1 / 16"), "première question affichée");
await page.click('.option[data-r="a"]');
await page.waitForSelector("text=2 / 16");
await page.click("#q-retour");
await page.waitForSelector("text=1 / 16");
ok(true, "retour à la question précédente");
for (let i = 0; i < 16; i++) {
  await page.waitForSelector(`text=${i + 1} / 16`);
  if (i === 3) await page.click("text=Sans avis");
  else await page.click(`.option[data-r="${i < 8 ? "a" : "b"}"]`);
}
await page.waitForSelector(".resultat");
ok((await page.evaluate(() => location.hash)) === "#r=aaa0aaaabbbbbbbb", "réponses gardées dans l'adresse");
ok((await page.textContent(".resultat h1")).includes("Redistribution"), "portrait : redistribution");
ok((await page.textContent(".resultat h1")).includes("Normes vertes allégées"), "portrait : normes vertes allégées");
ok(!(await page.isVisible("#partis")), "partis cachés avant la révélation");
ok(!(await page.textContent(".resultat h1")).match(/LFI|RN|Renaissance/), "aucun parti dans le portrait");
await page.click("#reveler");
ok((await page.locator("#partis li").count()) === 8, "huit partis révélés");
await page.reload();
await page.waitForSelector(".resultat");
ok(true, "le résultat survit au rechargement");
const lien = await page.getAttribute('a[href*="facebook.com/sharer"]', "href");
ok(decodeURIComponent(lien).includes("/test/p/aabb.html"), "lien Facebook vers la page du portrait aabb");
const rep = await page.goto(`${BASE}/test/p/anan.html`);
ok(rep.ok() && (await page.getAttribute('meta[property="og:image"]', "content")).endsWith("/test/og/anan.png"), "page de portrait avec image d'aperçu");
const img = await page.goto(`${BASE}/test/og/anan.png`);
ok(img.ok(), "image d'aperçu servie");
ok(!erreurs.length, `aucune erreur JavaScript ${erreurs.join(" | ")}`);
ok(!ailleurs.length, `aucune requête vers un autre domaine ${ailleurs.join(" ")}`);
await nav.close();
console.log(echecs ? `${echecs} échec(s)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
