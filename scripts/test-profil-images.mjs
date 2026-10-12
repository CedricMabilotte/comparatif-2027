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

function carte(code) {
  const lignes = D.axes.map((a, i) => {
    const e = code[i], c = COULEURS[i], pos = { a: 6, n: 50, b: 94 }[e];
    return `<div class="l"><div class="mot${e === "n" ? " nuance" : ""}" style="color:${e === "n" ? "#9ba3b6" : c}">${esc(a[e])}</div>
      <div class="ax"><span class="nom">${esc(a.nom)}</span><span class="piste" style="--c:${c}"><span class="pt" style="left:${pos}%;background:${c}"></span></span></div></div>`;
  }).join("");
  return base(`<style>
    .ls { display: grid; gap: 20px; margin-top: 34px; }
    .l { display: grid; grid-template-columns: 1fr 340px; align-items: center; gap: 28px; }
    .mot { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 50px; line-height: 1; letter-spacing: -.01em; white-space: nowrap; }
    .mot.nuance { font-size: 36px; font-weight: 600; }
    .ax { display: grid; gap: 6px; }
    .nom { font-family: "JetBrains Mono", monospace; font-size: 15px; letter-spacing: .08em; text-transform: uppercase; color: #9ba3b6; }
    .piste { position: relative; height: 8px; border-radius: 99px; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 60%, transparent), #2c3342 50%, color-mix(in srgb, var(--c) 60%, transparent)); }
    .pt { position: absolute; top: 50%; width: 26px; height: 26px; border-radius: 50%; border: 4px solid #12151c; transform: translate(-50%, -50%); }
  </style>
  <div class="sur">Ma boussole d'idées · programmes 2027</div>
  <div class="ls">${lignes}</div>
  <div class="pied"><div class="site">republique.fr/test</div><div class="invite">Et vous ? <b>16 dilemmes, 3 minutes.</b><br>Aucun nom de parti avant la fin.</div></div>`);
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
  <div class="pied"><div class="site">republique.fr/test</div><div class="invite">Les partis ne sont révélés<br><b>qu'à la fin, citations à l'appui.</b></div></div>`);
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
