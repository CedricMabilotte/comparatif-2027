// Images d'aperçu du test « Votre boussole d'idées » (1200 × 630, format Facebook, X, LinkedIn, WhatsApp) :
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
const COULEURS = ["#4fc4cc", "#f0985f", "#b896f5", "#b6c76a"];
const polices = pathToFileURL(path.join(SITE, "polices.css")).href;

const base = (corps) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${polices}"><style>
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #12151c; color: #e7e9ef; font-family: "Newsreader", Georgia, serif; position: relative; }
.cadre { position: absolute; inset: 0; padding: 52px 64px; display: flex; flex-direction: column; }
.bande { position: absolute; left: 0; right: 0; top: 0; height: 12px; display: flex; } .bande span { flex: 1; }
.sur { font-family: "JetBrains Mono", monospace; font-size: 22px; letter-spacing: .1em; text-transform: uppercase; color: #9ba3b6; }
.pied { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; font-family: "Bricolage Grotesque", sans-serif; }
.site { font-weight: 700; font-size: 30px; color: #8c9bff; }
.invite { font-size: 26px; color: #e7e9ef; text-align: right; line-height: 1.25; }
.invite b { color: #fff; }
</style></head><body><div class="bande">${COULEURS.map((c) => `<span style="background:${c}"></span>`).join("")}</div><div class="cadre">${corps}</div></body></html>`;

// Carte d'un portrait : l'étoile au centre (zone que WhatsApp garde en recadrant au carré), les mots du portrait à gauche,
// l'invitation à droite, la mention « ni sondage ni consigne de vote » en pied. Aucun parti.
const STYLE_ETOILE = `
  .et-anneau { fill: none; stroke: #2c3342; stroke-width: 1.2; } .et-bord { stroke-width: 2; }
  .et-rayon { stroke-width: 2.5; opacity: .6; }
  .et-forme.et-plein { fill: rgba(140,155,255,.22); stroke: #8c9bff; stroke-width: 3.5; stroke-linejoin: round; }
  .et-point { stroke: #12151c; stroke-width: 2.5; }
  .et-pole { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 18px; }`;
function carte(code) {
  const svg = Etoile.profil([Etoile.depuisCode(code)], { axes: D.axes, couleurs: COULEURS }).replace(/<tspan class="et-n"[^>]*>[^<]*<\/tspan>/g, "");
  const mots = D.axes.map((a, i) => `<li style="--c:${COULEURS[i]}" class="${code[i] === "n" ? "nuance" : ""}"><span>${esc(a.nom)}</span>${esc(code[i] === "n" ? "Entre-deux" : a[code[i]])}</li>`).join("");
  return base(`<style>${STYLE_ETOILE}
    .grille { display: grid; grid-template-columns: 260px 560px 1fr; align-items: center; margin: 0 -24px; flex: 1; min-height: 0; }
    .mots { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
    .mots li { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 27px; line-height: 1.05; color: var(--c); border-left: 6px solid var(--c); padding-left: 12px; }
    .mots li.nuance { color: #9ba3b6; }
    .mots span { display: block; font-family: "JetBrains Mono", monospace; font-weight: 400; font-size: 15px; letter-spacing: .08em; text-transform: uppercase; color: #9ba3b6; margin-bottom: 3px; }
    .etoile { width: 520px; height: 449px; display: block; overflow: visible; margin: 0 auto; }
    .defi { font-family: "Bricolage Grotesque", sans-serif; text-align: right; }
    .defi b { display: block; font-size: 50px; line-height: .98; color: #fff; letter-spacing: -.01em; }
    .defi span { display: block; font-size: 24px; color: #e7e9ef; margin-top: 14px; line-height: 1.2; }
    .pied { margin-top: 0; }
    .mention { font-family: "JetBrains Mono", monospace; font-size: 17px; color: #9ba3b6; }
  </style>
  <div class="sur">Sur 16 dilemmes tirés des programmes, j'ai penché vers</div>
  <div class="grille"><ul class="mots">${mots}</ul>${svg}<div class="defi"><b>D'accord<br>avec moi&nbsp;?</b><span>Faites le test,<br>comparons<br>nos boussoles.</span></div></div>
  <div class="pied"><div class="site">republique.fr/test</div><div class="mention">Ni sondage ni consigne de vote · aucun parti sur cette image</div></div>`);
}

function invitation() {
  return base(`<style>
    h1 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 96px; line-height: .98; margin-top: 30px; letter-spacing: -.02em; }
    h1 em { font-family: "Newsreader", serif; font-weight: 400; color: #8c9bff; }
    .acc { font-size: 34px; margin-top: 22px; color: #e7e9ef; max-width: 900px; line-height: 1.25; }
    .tags { display: flex; gap: 12px; margin-top: 26px; } .tags span { font-family: "Bricolage Grotesque", sans-serif; font-size: 24px; padding: 6px 16px; border-radius: 99px; border: 2px solid; }
  </style>
  <div class="sur">Programmes 2027 · test en 3 minutes</div>
  <h1>Votre boussole <em>d'idées</em></h1>
  <p class="acc">16 dilemmes tirés des textes des partis. Vous choisissez sans savoir qui défend quoi.</p>
  <div class="tags">${D.axes.map((a, i) => `<span style="color:${COULEURS[i]}">${esc(a.nom)}</span>`).join("")}</div>
  <div class="pied"><div class="site">republique.fr/test</div><div class="invite">Partis révélés seulement à la fin, citations à l'appui.<br><b>Ni sondage ni consigne de vote.</b></div></div>`);
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
