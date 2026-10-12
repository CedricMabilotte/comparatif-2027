// Carte des consensus, inspirée de Pol.is : on regroupe les votants selon leurs votes,
// puis on cherche les propositions qui recueillent l'accord de TOUS les groupes.
// Votes : +1 pour, 0 partagé, -1 contre, absent = non vu.
(function (racine) {
  // Générateur pseudo-aléatoire reproductible (mulberry32).
  function alea(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // votants : [{ id, votes: { idProposition: -1|0|1 } }], items : [idProposition]
  function matrice(votants, items) {
    return votants.map((v) => items.map((i) => (i in v.votes ? v.votes[i] : null)));
  }

  // Deux premiers axes principaux par itération de puissance, sur la matrice centrée
  // (une case vide vaut la moyenne de sa colonne, donc 0 après centrage).
  function projeter(M) {
    const n = M.length, p = M[0].length;
    const moy = Array.from({ length: p }, (_, j) => {
      const vals = M.map((l) => l[j]).filter((x) => x !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    const X = M.map((l) => l.map((x, j) => (x === null ? 0 : x - moy[j])));
    const cov = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => X.reduce((s, l) => s + l[a] * l[b], 0) / Math.max(1, n - 1)));
    const mul = (v) => cov.map((ligne) => ligne.reduce((s, c, k) => s + c * v[k], 0));
    const norme = (v) => Math.hypot(...v) || 1;
    const axes = [];
    const r = alea(7);
    for (let k = 0; k < 2; k++) {
      let v = Array.from({ length: p }, () => r() - 0.5);
      for (let it = 0; it < 200; it++) {
        let w = mul(v);
        for (const u of axes) { const d = w.reduce((s, x, j) => s + x * u[j], 0); w = w.map((x, j) => x - d * u[j]); }
        const nw = norme(w);
        v = w.map((x) => x / nw);
      }
      axes.push(v);
    }
    return X.map((l) => axes.map((u) => l.reduce((s, x, j) => s + x * u[j], 0)));
  }

  function kmoyennes(points, k, graine) {
    const r = alea(graine);
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const centres = [points[Math.floor(r() * points.length)]];
    while (centres.length < k) {
      const poids = points.map((pt) => Math.min(...centres.map((c) => d2(pt, c))));
      let cible = r() * poids.reduce((a, b) => a + b, 0), i = 0;
      while (cible > poids[i] && i < poids.length - 1) cible -= poids[i++];
      centres.push(points[i]);
    }
    let groupe = [];
    for (let it = 0; it < 50; it++) {
      groupe = points.map((pt) => centres.reduce((m, c, j) => (d2(pt, c) < d2(pt, centres[m]) ? j : m), 0));
      centres.forEach((_, j) => {
        const membres = points.filter((_, i) => groupe[i] === j);
        if (membres.length) centres[j] = [membres.reduce((s, m) => s + m[0], 0) / membres.length, membres.reduce((s, m) => s + m[1], 0) / membres.length];
      });
    }
    return groupe;
  }

  function silhouette(points, groupe, k) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let total = 0;
    points.forEach((pt, i) => {
      const moyD = (g) => { const m = points.filter((_, j) => j !== i && groupe[j] === g); return m.length ? m.reduce((s, q) => s + d(pt, q), 0) / m.length : 0; };
      const a = moyD(groupe[i]);
      const b = Math.min(...Array.from({ length: k }, (_, g) => g).filter((g) => g !== groupe[i]).map(moyD));
      total += Math.max(a, b) ? (b - a) / Math.max(a, b) : 0;
    });
    return total / points.length;
  }

  function analyser(votants, items) {
    const M = matrice(votants, items);
    const coords = projeter(M);
    let meilleur = null;
    for (let k = 2; k <= Math.min(4, votants.length - 1); k++) {
      const g = kmoyennes(coords, k, 11 + k);
      const s = silhouette(coords, g, k);
      if (!meilleur || s > meilleur.score) meilleur = { k, groupe: g, score: s };
    }
    const k = meilleur.k, groupe = meilleur.groupe;
    const tailles = Array.from({ length: k }, (_, g) => groupe.filter((x) => x === g).length);
    const parItem = items.map((id, j) => {
      const accord = Array.from({ length: k }, (_, g) => {
        let pour = 0, vus = 0;
        M.forEach((l, i) => { if (groupe[i] === g && l[j] !== null) { vus++; if (l[j] === 1) pour++; } });
        return (pour + 1) / (vus + 2); // lissage de Laplace : un groupe silencieux ne fait pas un consensus
      });
      return {
        id,
        accord,
        consensus: accord.reduce((a, b) => a * b, 1) ** (1 / k), // moyenne géométrique : un seul groupe réticent suffit à faire baisser
        division: Math.max(...accord) - Math.min(...accord),
      };
    });
    return { k, groupe, coords, tailles, parItem };
  }

  // Votants simulés pour la démonstration : chacun penche vers une candidature,
  // et certaines propositions plaisent au-delà des camps.
  function simuler(propositions, candidatures, nombre, transversales, graine) {
    const r = alea(graine);
    return Array.from({ length: nombre }, (_, n) => {
      const proche = candidatures[n % candidatures.length];
      const votes = {};
      propositions.forEach((p) => {
        if (r() < 0.15) return; // pas vue
        let pPour = p.candidature === proche ? 0.72 : 0.22;
        if (transversales.includes(p.id)) pPour = 0.7;
        const x = r();
        votes[p.id] = x < pPour ? 1 : x < pPour + 0.15 ? 0 : -1;
      });
      return { id: `sim-${n}`, simule: true, votes };
    });
  }

  const api = { analyser, simuler, alea };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.Consensus = api;
})(typeof window !== "undefined" ? window : globalThis);
