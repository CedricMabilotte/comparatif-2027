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
await page.waitForSelector(".carte:not(.dessous) .option");
ok((await page.textContent(".compte")).includes("1 / 16"), "première carte affichée");
ok((await page.locator(".carte:not(.dessous) .option").count()) === 2 && (await page.locator('.rond.neutre[data-r="0"]').count()) === 1, "deux options sur la carte, plus « ça dépend »");
ok((await page.locator(".segments span").count()) === 16, "progression en 16 segments");
ok((await page.locator(".carte.dessous").count()) === 1, "la carte suivante attend sous la première");
// Glisser la carte au doigt vers la droite choisit l'option de droite.
const droite = await page.getAttribute(".carte:not(.dessous)", "data-d");
const bb = await (await page.$(".carte:not(.dessous)")).boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + 80); await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2 + 180, bb.y + 90, { steps: 8 }); await page.mouse.up();
await page.waitForSelector("text=2 / 16");
ok((await page.evaluate(() => location.hash)) === `#q=${droite}`, "glisser à droite choisit l'option de droite");
await page.click("#q-retour");
await page.waitForSelector("text=1 / 16");
ok(true, "retour à la carte précédente");
for (let i = 0; i < 16; i++) {
  await page.waitForSelector(`.compte:text("${i + 1} / 16")`);
  await page.click(i === 3 ? ".rond.neutre" : `.carte:not(.dessous) .option[data-r="${i < 8 ? "a" : "b"}"]`);
}
await page.waitForSelector(".resultat");
ok((await page.evaluate(() => location.hash)) === "#r=aaa0aaaabbbbbbbb", "réponses gardées dans l'adresse");
ok(!(await page.isVisible(".bandeau.alerte")), "pas d'avertissement de faux résultat après un vrai parcours");
ok((await page.locator(".resultat > figure svg.etoile .et-forme").count()) === 1, "étoile du profil dessinée");
ok((await page.locator(".axe-res").count()) === 4 && (await page.textContent(".axes-res")).includes("Des deux côtés"), "quatre axes, dont un « des deux côtés »");
ok(!(await page.isVisible("#partis")), "partis cachés avant la révélation");
ok(!(await page.textContent(".resultat > figure")).match(/LFI|RN|Renaissance/), "aucun parti dans l'étoile du profil");
await page.click("#reveler");
ok((await page.locator("#partis .carte-parti").count()) === 8, "huit cartes de partis révélées");
ok((await page.locator("#partis svg.etoile .et-point").count()) === 8, "étoile des affinités à huit rayons");
ok((await page.locator("#partis .carte-parti").first().locator(".cases i").count()) === 16, "16 cases par parti");
ok(!(await page.textContent("#paquet")).match(/%|1er|n°/), "ni pourcentage ni rang sur les cartes");
ok((await page.textContent("#partis")).includes("Ni sondage ni consigne de vote"), "mention dans le cadre capturable");
ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, "pas de défilement horizontal de la page");
const lienInvit = await page.getAttribute('#p-reseaux a[href*="facebook.com/sharer"]', "href");
ok(decodeURIComponent(lienInvit).endsWith("/test/"), "partage par défaut : invitation sans portrait");
await page.click("text=Défier avec ma boussole");
const lien = await page.getAttribute('#p-reseaux a[href*="facebook.com/sharer"]', "href");
ok(decodeURIComponent(lien).includes("/test/p/nnnn.html"), "lien Facebook vers la page du portrait nnnn");
await page.reload();
await page.waitForSelector(".resultat");
ok(await page.isVisible(".bandeau.alerte"), "résultat ouvert par lien : signalé comme tel");
// Défi : le portrait d'un ami suit le parcours et donne une comparaison sans parti. Ici au clavier.
await page.goto(`${BASE}/test/#defi=abnb`);
await page.waitForSelector(".bandeau");
await page.click("text=Commencer");
for (let i = 0; i < 16; i++) { await page.waitForSelector(`.compte:text("${i + 1} / 16")`); await page.keyboard.press("ArrowLeft"); }
await page.waitForSelector(".defi");
ok((await page.evaluate(() => location.hash)).includes("defi=abnb"), "le défi suit le parcours (clavier)");
ok((await page.locator(".defi .et-contour").count()) === 1, "étoile de l'ami en pointillés");
ok(!(await page.textContent(".defi")).match(/LFI|RN|Renaissance|Républicains/), "aucun parti dans la comparaison");
const rep = await page.goto(`${BASE}/test/p/anan.html`);
ok(rep.ok() && (await page.getAttribute('meta[property="og:image"]', "content")).endsWith("/test/og/anan.png"), "page de portrait avec image d'aperçu");
ok((await page.getAttribute(".appel-fixe a", "href")).includes("defi=anan"), "page de portrait : bouton de défi");
ok((await page.locator(".mots li").count()) === 4, "page de portrait : quatre mots");
// Séries qui s'additionnent : la série 2 suit la 1, le profil global les réunit, la mémoire sur l'appareil est volontaire.
await page.goto(`${BASE}/test/#commencer`);
for (let i = 0; i < 16; i++) { await page.waitForSelector(`.compte:text("${i + 1} / 16")`); await page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight"); }
await page.waitForSelector(".resultat");
ok((await page.locator(".suite .serie").count()) === 3, "trois séries proposées sous le résultat");
ok(await page.evaluate(() => localStorage.getItem("boussole-idees") === null), "rien gardé sur l'appareil sans le choix de la personne");
await page.check("#garder");
ok(await page.evaluate(() => !!localStorage.getItem("boussole-idees")), "séries gardées sur l'appareil après la case cochée");
await page.click(".suite .gros-bouton");
await page.waitForSelector(".compte small:text('Série 2')");
for (let i = 0; i < 16; i++) { await page.waitForSelector(`.compte:text("${i + 1} / 16")`); await page.keyboard.press("ArrowUp"); }
await page.waitForSelector(".resultat");
const h2 = await page.evaluate(() => location.hash);
ok(/s=2/.test(h2) && /t1=[ab0]{16}/.test(h2), "la série 1 suit dans l'adresse de la série 2");
ok(!(await page.isVisible(".bandeau.alerte")), "série 2 jouée : pas d'avertissement");
await page.click("text=Voir mon profil global");
await page.waitForSelector(".global");
ok((await page.locator(".serie-res").count()) === 2, "profil global : deux séries réunies");
await page.click("#reveler");
ok((await page.locator("#paquet .carte-parti").first().locator(".cases i").count()) === 32, "profil global : 32 cases par parti");
ok(!(await page.textContent(".global .partage")).match(/LFI|RN|Renaissance|Républicains/), "partage du profil global sans parti");
await page.goto(`${BASE}/test/`);
await page.waitForSelector(".bloc-series");
ok((await page.textContent(".bloc-series h2")).includes("2 séries sur 3"), "accueil : le profil gardé est retrouvé");
await page.click("#oublier");
ok(await page.evaluate(() => localStorage.getItem("boussole-idees") === null), "effacement de l'appareil en un geste");
const rep2 = await page.goto(`${BASE}/test/p/2-anbn.html`);
ok(rep2.ok() && (await page.getAttribute(".appel-fixe a", "href")).includes("commencer=2&defi=anbn"), "portrait de série 2 avec défi sur la série 2");
const img = await page.goto(`${BASE}/test/og/anan.png`);
ok(img.ok(), "image d'aperçu servie");
ok(!erreurs.length, `aucune erreur JavaScript ${erreurs.join(" | ")}`);
ok(!ailleurs.length, `aucune requête vers un autre domaine ${ailleurs.join(" ")}`);
await nav.close();
console.log(echecs ? `${echecs} échec(s)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
