// Images d'aperçu du test « Ta boussole d'idées » (1200 × 630, format Facebook, X, LinkedIn, WhatsApp) :
// site/test/og/<code>.png pour chacun des 81 portraits, et site/test/og/test.png pour l'invitation.
// Rendu par un navigateur sans tête (Playwright, Chromium) avec les polices du site. Lancer après scripts/test-profil.mjs.
// Usage : node scripts/test-profil-images.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(RACINE, "site");
const D = JSON.parse(fs.readFileSync(path.join(SITE, "test", "donnees.json"), "utf8"));
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(process.execPath, "..", "..", "lib", "node_modules", "playwright")); }
const Etoile = require(path.join(SITE, "test", "etoile.js"));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const COULEURS = ["#0b9c9c", "#f0601d", "#7b4dff", "#7f9900"];
const polices = pathToFileURL(path.join(SITE, "test", "archivo.css")).href;

// Même style « Glisse » que le test : fond blanc, Archivo très large, aplats de couleur par axe, cartes arrondies.
const base = (corps) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${polices}"><style>
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #fff; color: #0d0d0d; font-family: "Archivo", Arial, sans-serif; position: relative; }
.cadre { position: absolute; inset: 0; padding: 48px 60px 40px; display: flex; flex-direction: column; }
.sur { font-size: 22px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #767676; }
.pied { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; border-top: 3px solid #0d0d0d; padding-top: 14px; }
.site { font-weight: 900; font-stretch: 125%; font-size: 30px; }
.mention { font-size: 19px; font-weight: 600; color: #767676; text-align: right; }
</style></head><body><div class="cadre">${corps}</div></body></html>`;

// Carte d'un portrait : les quatre mots en aplats à gauche, l'étoile au centre (zone que WhatsApp garde en recadrant au carré),
// l'invitation à droite, la mention « ni sondage ni consigne de vote » en pied. Aucun parti.
const STYLE_ETOILE = `
  .et-anneau { fill: none; stroke: #e6e6e6; stroke-width: 1.5; } .et-bord { stroke: #d0d0d0; stroke-width: 2; }
  .et-rayon { stroke-width: 3; opacity: .55; }
  .et-forme.et-plein { fill: rgba(13,13,13,.08); stroke: #0d0d0d; stroke-width: 4; stroke-linejoin: round; }
  .et-point { stroke: #fff; stroke-width: 3; }
  .et-pole { font-family: "Archivo", sans-serif; font-weight: 800; font-size: 17px; }`;
function carte(code) {
  const svg = Etoile.profil([Etoile.depuisCode(code)], { axes: D.axes, couleurs: COULEURS }).replace(/<tspan class="et-n"[^>]*>[^<]*<\/tspan>/g, "");
  const mots = D.axes.map((a, i) => `<li style="--c:${COULEURS[i]}" class="${code[i] === "n" ? "nuance" : ""}"><span>${esc(a.nom)}</span>${esc(code[i] === "n" ? "Des deux côtés" : a[code[i]])}</li>`).join("");
  return base(`<style>${STYLE_ETOILE}
    .grille { display: grid; grid-template-columns: 300px 500px 1fr; gap: 16px; align-items: center; flex: 1; min-height: 0; margin-top: 10px; }
    .mots { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .mots li { background: var(--c); color: #fff; border-radius: 16px; padding: 10px 16px 12px; font-weight: 900; font-stretch: 115%; font-size: 24px; line-height: 1.02; }
    .mots li.nuance { background: #f4f4f4; color: #0d0d0d; box-shadow: inset 0 0 0 3px var(--c); }
    .mots span { display: block; font-weight: 700; font-stretch: 100%; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; opacity: .85; margin-bottom: 3px; }
    .etoile { width: 480px; height: 415px; display: block; overflow: visible; margin: 0 auto; }
    .defi b { display: block; font-weight: 900; font-stretch: 125%; font-size: 46px; line-height: .95; }
    .defi span { display: inline-block; margin-top: 18px; background: #0d0d0d; color: #fff; font-weight: 800; font-size: 22px; padding: 12px 20px; border-radius: 99px; }
  </style>
  <div class="sur">Sur 16 dilemmes tirés des programmes, j'ai penché vers</div>
  <div class="grille"><ul class="mots">${mots}</ul>${svg}<div class="defi"><b>D'accord avec moi&nbsp;?</b><span>Fais le test →</span></div></div>
  <div class="pied"><div class="site">republique.fr/test</div><div class="mention">Ni sondage ni consigne de vote<br>Aucun parti sur cette image</div></div>`);
}

function invitation() {
  return base(`<style>
    .ecran { display: grid; grid-template-columns: 1fr 380px; gap: 40px; flex: 1; align-items: center; }
    h1 { font-weight: 900; font-stretch: 125%; font-size: 92px; line-height: .9; letter-spacing: -.01em; margin-top: 18px; }
    .acc { font-size: 30px; margin-top: 22px; line-height: 1.25; max-width: 640px; }
    .pile { position: relative; height: 380px; }
    .pile i { position: absolute; inset: 20px 30px; border-radius: 26px; }
    .pile .c3 { background: ${COULEURS[2]}; transform: rotate(7deg); } .pile .c2 { background: ${COULEURS[1]}; transform: rotate(-6deg); }
    .pile .c1 { background: ${COULEURS[0]}; transform: rotate(-1.5deg); color: #fff; padding: 26px; display: flex; flex-direction: column; justify-content: space-between; font-style: normal; }
    .pile .c1 b { font-size: 70px; line-height: 1; } .pile .c1 em { font-style: normal; font-weight: 900; font-stretch: 125%; font-size: 42px; line-height: .95; }
  </style>
  <div class="ecran"><div><div class="sur">Programmes 2027 · 3 minutes</div><h1>Ta boussole d'idées</h1>
  <p class="acc">16 dilemmes tirés des textes des partis. Tu glisses chaque carte vers ton choix, sans savoir qui défend quoi.</p></div>
  <div class="pile"><i class="c3"></i><i class="c2"></i><i class="c1"><b>⏳</b><em>La retraite</em></i></div></div>
  <div class="pied"><div class="site">republique.fr/test</div><div class="mention">Partis révélés seulement à la fin, citations à l'appui<br>Ni sondage ni consigne de vote</div></div>`);
}

const codes = [""];
for (const _ of D.axes) codes.splice(0, codes.length, ...codes.flatMap((c) => ["a", "n", "b"].map((e) => c + e)));
const dossier = path.join(SITE, "test", "og");
fs.mkdirSync(dossier, { recursive: true });
const tmp = fs.mkdtempSync(path.join(RACINE, ".og-"));
const nav = await playwright.chromium.launch();
const page = await nav.newPage({ viewport: { width: 1200, height: 630 } });
try {
  for (const [nom, html] of [["test", invitation()], ...codes.map((c) => [c, carte(c)])]) {
    const f = path.join(tmp, `${nom}.html`);
    fs.writeFileSync(f, html);
    await page.goto(pathToFileURL(f).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(dossier, `${nom}.png`) });
  }
} finally {
  await nav.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`Images d'aperçu : ${codes.length + 1} dans site/test/og/.`);
