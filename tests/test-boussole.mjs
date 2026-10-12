// Parcours complet du test « boussole d'idées » sur un téléphone simulé (Playwright, Chromium).
// Prérequis : servir site/ sur http://localhost:8123 (par ex. npx http-server site -p 8123 -s).
// Vérifie : 16 questions, retour arrière, « ça dépend », étoiles, révélation des partis, partage, défi, page de portrait, aucune erreur JS,
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
ok((await page.locator(".option").count()) === 3, "trois réponses possibles, dont « ça dépend »");
ok((await page.locator(".segments span").count()) === 16, "progression en 16 segments");
await page.click('.option[data-r="a"]');
await page.waitForSelector("text=2 / 16");
await page.click("#q-retour");
await page.waitForSelector("text=1 / 16");
ok(true, "retour à la question précédente");
for (let i = 0; i < 16; i++) {
  await page.waitForSelector(`text=${i + 1} / 16`);
  await page.click(i === 3 ? ".option.neutre" : `.option[data-r="${i < 8 ? "a" : "b"}"]`);
}
await page.waitForSelector(".resultat");
ok((await page.evaluate(() => location.hash)) === "#r=aaa0aaaabbbbbbbb", "réponses gardées dans l'adresse");
ok(!(await page.isVisible(".bandeau-lien")), "pas d'avertissement de faux résultat après un vrai parcours");
ok((await page.locator(".hero svg.etoile .et-forme").count()) === 1, "étoile du profil dessinée");
ok((await page.textContent(".puces")).includes("Entre-deux"), "puces : entre-deux");
ok(!(await page.isVisible("#partis")), "partis cachés avant la révélation");
ok(!(await page.textContent(".hero")).match(/LFI|RN|Renaissance/), "aucun parti dans l'étoile du profil");
await page.click("#reveler");
ok((await page.locator("#partis ol.partis li").count()) === 8, "huit partis révélés");
ok((await page.locator("#partis svg.etoile .et-point").count()) === 8, "étoile des affinités à huit rayons");
ok((await page.locator("#partis .pastilles").first().locator("i").count()) === 16, "16 pastilles par parti");
ok((await page.textContent("#partis")).includes("Ni sondage ni consigne de vote"), "mention dans le cadre capturable");
const lienInvit = await page.getAttribute('#p-reseaux a[href*="facebook.com/sharer"]', "href");
ok(decodeURIComponent(lienInvit).endsWith("/test/"), "partage par défaut : invitation sans portrait");
await page.check('input[value="portrait"]');
const lien = await page.getAttribute('#p-reseaux a[href*="facebook.com/sharer"]', "href");
ok(decodeURIComponent(lien).includes("/test/p/nnnn.html"), "lien Facebook vers la page du portrait nnnn");
await page.reload();
await page.waitForSelector(".resultat");
ok(await page.isVisible(".bandeau-lien"), "résultat ouvert par lien : signalé comme tel");
// Défi : le portrait d'un ami suit le parcours et donne une comparaison sans parti.
await page.goto(`${BASE}/test/#defi=abnb`);
await page.waitForSelector(".bandeau-defi");
await page.click("text=Commencer");
for (let i = 0; i < 16; i++) { await page.waitForSelector(`text=${i + 1} / 16`); await page.click('.option[data-r="a"]'); }
await page.waitForSelector(".defi");
ok((await page.evaluate(() => location.hash)).includes("defi=abnb"), "le défi suit le parcours");
ok((await page.locator(".defi .et-contour").count()) === 1, "étoile de l'ami en pointillés");
ok(!(await page.textContent(".defi")).match(/LFI|RN|Renaissance|Républicains/), "aucun parti dans la comparaison");
const rep = await page.goto(`${BASE}/test/p/anan.html`);
ok(rep.ok() && (await page.getAttribute('meta[property="og:image"]', "content")).endsWith("/test/og/anan.png"), "page de portrait avec image d'aperçu");
ok((await page.getAttribute(".appel a", "href")).includes("defi=anan"), "page de portrait : bouton de défi sous le titre");
const img = await page.goto(`${BASE}/test/og/anan.png`);
ok(img.ok(), "image d'aperçu servie");
ok(!erreurs.length, `aucune erreur JavaScript ${erreurs.join(" | ")}`);
ok(!ailleurs.length, `aucune requête vers un autre domaine ${ailleurs.join(" ")}`);
await nav.close();
console.log(echecs ? `${echecs} échec(s)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
