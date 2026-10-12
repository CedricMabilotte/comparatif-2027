// Graphiques en étoile du test « boussole d'idées », en SVG, partagés par le navigateur (test.js)
// et par les scripts de construction (pages de portrait, images de partage).
// Choix de lecture, pour rester honnête avec quatre axes à deux pôles :
// - huit demi-rayons, un par pôle ; les deux pôles d'un même axe sont toujours face à face ;
// - les pôles alternent (a, b, a, b puis b, a, b, a) pour qu'aucune moitié de l'étoile ne dessine « une gauche » ou « une droite » ;
// - la longueur d'un demi-rayon compte des réponses (0 à 4 dilemmes), avec un anneau par réponse : des crans, pas une échelle continue ;
// - un axe sans donnée (aucune réponse, ou parti muet dans ses textes) est tracé en pointillés et laissé hors de la forme : le silence n'est ni un zéro ni un centre.
"use strict";
(function (racine) {
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COULEURS = ["var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)"];
  // Ordre des demi-rayons, dans le sens des aiguilles d'une montre à partir du haut : [axe, pôle].
  const RAYONS = [[0, "a"], [1, "b"], [2, "a"], [3, "b"], [0, "b"], [1, "a"], [2, "b"], [3, "a"]];
  const f = (n) => n.toFixed(1);

  // Coupe un libellé en deux lignes au plus, à l'espace la plus proche du milieu.
  function couper(t, max) {
    if (t.length <= max) return [t];
    const m = t.length / 2;
    let best = -1;
    for (let i = 0; i < t.length; i++) if (t[i] === " " && (best < 0 || Math.abs(i - m) < Math.abs(best - m))) best = i;
    return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
  }

  // Profil (lecteur ou parti) : v[k] = [nombre de choix « a », nombre de choix « b »] sur l'axe k (0 à 4), muet[k] = pas de donnée.
  // couches : [{ v, muet, sorte: "plein" | "contour" }] ; opts : { taille, etiquettes, axes, couleurs, titre, desc }
  function profil(couches, opts = {}) {
    const mini = opts.taille === "mini";
    const W = mini ? 160 : 440, H = mini ? 160 : 380, cx = W / 2, cy = H / 2, R = mini ? 66 : 118;
    const couleurs = opts.couleurs || COULEURS, axes = opts.axes || [];
    const ang = (i) => -Math.PI / 2 + (i * Math.PI) / 4;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    const muetAxe = (k) => couches.some((c) => c.sorte === "plein" && c.muet && c.muet[k]);
    let s = "";
    // Anneaux : 1 à 4 réponses.
    for (let k = 1; k <= 4; k++) s += `<polygon points="${RAYONS.map((_, i) => pt(i, (R * k) / 4).map(f).join(",")).join(" ")}" class="et-anneau${k === 4 ? " et-bord" : ""}"/>`;
    // Demi-rayons, à la couleur de leur axe ; pointillés si l'axe est muet pour la forme principale.
    RAYONS.forEach(([k], i) => {
      const [x, y] = pt(i, R);
      s += `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}" class="et-rayon${muetAxe(k) ? " et-muet" : ""}" style="stroke:${couleurs[k]}"/>`;
    });
    // Formes : seulement sur les axes qui ont des données.
    for (const c of couches) {
      const pts = [];
      RAYONS.forEach(([k, p], i) => { if (!(c.muet && c.muet[k])) pts.push(pt(i, (R * c.v[k][p === "a" ? 0 : 1]) / 4)); });
      if (pts.length >= 2) s += `<polygon points="${pts.map((q) => q.map(f).join(",")).join(" ")}" class="et-forme et-${c.sorte}"/>`;
      if (c.sorte === "plein") RAYONS.forEach(([k, p], i) => {
        if (c.muet && c.muet[k]) return;
        const n = c.v[k][p === "a" ? 0 : 1];
        if (!n) return;
        const [x, y] = pt(i, (R * n) / 4);
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${mini ? 3 : 5.5}" class="et-point" style="fill:${couleurs[k]}"/>`;
      });
    }
    // Libellés des pôles, avec le compte de la forme principale.
    if (!mini && axes.length) {
      const pleine = couches.find((c) => c.sorte === "plein");
      RAYONS.forEach(([k, p], i) => {
        const [x, y] = pt(i, R + 16), ancre = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end";
        const lignes = couper(axes[k][p], 13);
        const n = pleine && !(pleine.muet && pleine.muet[k]) ? pleine.v[k][p === "a" ? 0 : 1] : null;
        const dy0 = y < cy - 4 ? -(lignes.length) * 15 + 12 : y > cy + 4 ? 6 : -(lignes.length - 1) * 7.5 + 4;
        s += `<text x="${f(x)}" y="${f(y + dy0)}" text-anchor="${ancre}" class="et-pole" style="fill:${couleurs[k]}">${lignes.map((l, j) => `<tspan x="${f(x)}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`).join("")}${n !== null ? `<tspan class="et-n" x="${f(x)}" dy="14">${n}/4</tspan>` : ""}</text>`;
      });
    }
    const role = opts.titre ? ` role="img" aria-label="${esc(opts.titre)}"` : ` aria-hidden="true"`;
    return `<svg class="etoile${mini ? " mini" : ""}" viewBox="0 0 ${W} ${H}"${role}>${s}</svg>`;
  }

  // Étoile des affinités : un rayon par parti, dans un ordre fixe (alphabétique, jamais trié), longueur = part des dilemmes en accord.
  // items : [{ etiquette, detail, taux (0 à 1), faible }] ; « faible » = trop peu de dilemmes comparés, rayon en pointillés et point creux.
  function affinites(items, opts = {}) {
    const W = 440, H = 380, cx = W / 2, cy = H / 2, R = 118, n = items.length;
    const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    let s = "";
    for (let k = 1; k <= 4; k++) s += `<polygon points="${items.map((_, i) => pt(i, (R * k) / 4).map(f).join(",")).join(" ")}" class="et-anneau${k === 4 ? " et-bord" : ""}"/>`;
    // Graduations posées entre le premier et le deuxième rayon, pour ne masquer aucun parti.
    const g = -Math.PI / 2 + Math.PI / n;
    for (const [k, t] of [[2, "50 %"], [4, "100 %"]]) s += `<text x="${f(cx + ((R * k) / 4) * Math.cos(g) + 3)}" y="${f(cy + ((R * k) / 4) * Math.sin(g) - 3)}" class="et-grad">${t}</text>`;
    items.forEach((it, i) => { const [x, y] = pt(i, R); s += `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}" class="et-rayon et-neutre${it.faible ? " et-muet" : ""}"/>`; });
    const solides = items.map((it, i) => (it.faible ? null : pt(i, R * it.taux))).filter(Boolean);
    if (solides.length >= 3) s += `<polygon points="${solides.map((q) => q.map(f).join(",")).join(" ")}" class="et-forme et-plein"/>`;
    items.forEach((it, i) => {
      const [x, y] = pt(i, R * it.taux);
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="5.5" class="et-point${it.faible ? " et-creux" : ""}"/>`;
      const [lx, ly] = pt(i, R + 16), ancre = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
      const dy0 = ly < cy - 4 ? -10 : ly > cy + 4 ? 8 : -4;
      s += `<text x="${f(lx)}" y="${f(ly + dy0)}" text-anchor="${ancre}" class="et-pole et-parti${it.faible ? " et-faible" : ""}"><tspan x="${f(lx)}">${esc(it.etiquette)}</tspan><tspan class="et-n" x="${f(lx)}" dy="14">${esc(it.detail)}</tspan></text>`;
    });
    return `<svg class="etoile" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.titre || "Étoile des affinités")}">${s}</svg>`;
  }

  // Profil d'un portrait partagé (code « anbb ») : on ne connaît que l'état de chaque axe, pas les comptes.
  // Forme type : 3 contre 1 vers le pôle marqué, 2 contre 2 pour un entre-deux.
  const depuisCode = (code) => ({ v: [...code].map((e) => (e === "a" ? [3, 1] : e === "b" ? [1, 3] : [2, 2])), muet: [false, false, false, false], sorte: "plein" });

  const api = { profil, affinites, depuisCode, RAYONS, couper };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  racine.Etoile = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
