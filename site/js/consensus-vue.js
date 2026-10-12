// Consensus : la carte des votants et les idées qui rassemblent. R.consensus.carte(cible, votants, items)
// dessine une carte dans n'importe quel conteneur (la carte globale ici, la carte d'une séance dans Groupes).
"use strict";
R.module("consensus", (R) => {
  const { $, esc, C } = R;
  const MAX_ITEMS = 80;
  const tirage = Consensus.alea(2027);
  const echantillon = [...C.propositions].map((p) => [tirage(), p.id]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const TRANSVERSALES = echantillon.slice(0, 4); // propositions que la simulation rend populaires partout
  const COUL = ["var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)"];
  const SEUIL_REEL = 30; // en dessous, la carte serait trop instable : on reste sur la simulation
  // Suspension de la carte nationale autour des scrutins (esprit de la loi du 19 juillet 1977) :
  // du samedi 0 h précédant chaque tour à la fermeture du dernier bureau de vote. Dates ISO avec fuseau,
  // par exemple { du: "2027-04-10T00:00:00+02:00", au: "2027-04-11T20:00:00+02:00" }. À remplir quand
  // le calendrier de 2027 sera fixé.
  const SUSPENSIONS = [];
  const PAS_UN_SONDAGE = "Ce n'est pas un sondage : les votants se sont choisis eux-mêmes, ils ne représentent pas la population.";
  const suspendue = (t = Date.now()) => SUSPENSIONS.some((p) => t >= Date.parse(p.du) && t < Date.parse(p.au));

  // votants : [{ id, votes: { idProposition: -1|0|1 } }], celui dont l'id vaut "moi" est entouré.
  function carte(cible, votants, items) {
    const a = Consensus.analyser(votants, items);
    const xs = a.coords.map((c) => c[0]), ys = a.coords.map((c) => c[1]);
    const ech = (v, min, max, a0, a1) => a0 + ((v - min) / ((max - min) || 1)) * (a1 - a0);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let svg = `<rect x="0" y="0" width="400" height="300" fill="var(--surface)"/>`;
    const iMoi = votants.findIndex((v) => v.id === "moi");
    a.coords.forEach((c, i) => {
      if (i === iMoi) return;
      svg += `<circle cx="${ech(c[0], x0, x1, 20, 380).toFixed(1)}" cy="${ech(c[1], y0, y1, 280, 20).toFixed(1)}" r="4" fill="${COUL[a.groupe[i]]}" fill-opacity=".65"/>`;
    });
    if (iMoi >= 0) {
      const cx = ech(a.coords[iMoi][0], x0, x1, 20, 380), cy = ech(a.coords[iMoi][1], y0, y1, 280, 20);
      svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9" fill="none" stroke="var(--encre)" stroke-width="2"/><text x="${(cx + 12).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="var(--encre)" font-family="Bricolage Grotesque, sans-serif" font-size="13" font-weight="700">vous</text>`;
    }
    const ligne = (it) => {
      const p = R.parId[it.id];
      return `<div class="c-item"><span>« ${esc(p.citation)} »</span><span class="ref">accord par groupe · <a href="#prop-${p.id}">ouvrir la source</a></span>
        <div class="c-barres">${it.accord.map((v, g) => `<span title="Groupe ${g + 1} : ${Math.round(v * 100)} %"><i style="width:${v * 100}%;background:${COUL[g]}"></i></span>`).join("")}</div></div>`;
    };
    cible.innerHTML = `<div class="carto">
      <figure class="nuage"><svg viewBox="0 0 400 300" role="img" aria-label="Carte des votants">${svg}</svg><figcaption class="ref">${a.tailles.map((t, g) => `<span style="color:${COUL[g]}">●</span> Groupe ${g + 1} : ${t} votants`).join(" · ")}${iMoi >= 0 ? ` · vous êtes dans le groupe ${a.groupe[iMoi] + 1}` : ""}</figcaption></figure>
      <div class="c-listes"><h2>Ce qui rassemble</h2><div class="c-liste">${[...a.parItem].sort((x, y) => y.consensus - x.consensus).slice(0, 4).map(ligne).join("")}</div>
      <h2>Ce qui divise</h2><div class="c-liste">${[...a.parItem].sort((x, y) => y.division - x.division).slice(0, 3).map(ligne).join("")}</div></div></div>`;
    return a;
  }
  R.consensus = { carte, MAX_ITEMS, SEUIL_REEL, PAS_UN_SONDAGE, suspendue };

  const zone = document.createElement("div");
  $("#consensus .carto").replaceWith(zone);
  async function dessiner() {
    const avert = $("#c-avert");
    avert.hidden = false;
    if (suspendue()) {
      avert.innerHTML = `<strong>Carte suspendue.</strong> Conformément à l'esprit de la loi du 19 juillet 1977, la carte nationale est suspendue du samedi précédant chaque tour de l'élection présidentielle, à 0 h, jusqu'à la fermeture du dernier bureau de vote. Vous pouvez toujours voter à l'aveugle et consulter les sources.`;
      zone.innerHTML = "";
      return;
    }
    const reels = R.enLigne ? (await R.api("votes"))?.votants ?? [] : [];
    const simule = reels.length < SEUIL_REEL;
    const votes = R.votes || {};
    const nbVotes = {};
    if (!simule) for (const v of reels) for (const k in v.votes) nbVotes[k] = (nbVotes[k] || 0) + 1;
    const base = simule ? echantillon : Object.keys(nbVotes).sort((x, y) => nbVotes[y] - nbVotes[x]);
    const items = [...new Set([...Object.keys(votes).filter((k) => R.parId[k]), ...base])].slice(0, MAX_ITEMS);
    // L'avertissement reste affiché, simulation ou votes réels.
    avert.innerHTML = simule
      ? `<strong>Simulation.</strong> En attendant les vrais votes, la carte s'appuie sur 150 votants simulés, plus vos propres votes à l'aveugle. ${esc(PAS_UN_SONDAGE)}`
      : `<strong>${esc(PAS_UN_SONDAGE)}</strong> Les résultats ne disent rien de l'opinion des Français ni des intentions de vote : ils montrent seulement, proposition par proposition, ce qui rapproche ou divise les ${reels.length.toLocaleString("fr")} personnes qui ont voté ici, au ${new Date().toLocaleDateString("fr")}.`;
    const miens = Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, { pour: 1, partage: 0, contre: -1 }[v]]));
    let votants;
    if (simule) {
      votants = Consensus.simuler(C.propositions.filter((p) => items.includes(p.id)), C.candidatures.map((c) => c.id), 150, TRANSVERSALES, 42);
      if (Object.keys(miens).length) votants.push({ id: "moi", votes: miens });
    } else {
      votants = reels.filter((v) => !v.moi).map((v, i) => ({ id: `v${i}`, votes: v.votes }));
      const reelMoi = reels.find((v) => v.moi);
      if (reelMoi) votants.push({ id: "moi", votes: reelMoi.votes });
      else if (Object.keys(miens).length) votants.push({ id: "moi", votes: miens });
    }
    carte(zone, votants, items);
  }
  R.route("consensus", () => { R.montrer("consensus"); dessiner(); });
});
