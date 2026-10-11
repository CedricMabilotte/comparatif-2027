// Démarrage : charge le corpus, prépare les index partagés, lance chaque module puis la navigation.
"use strict";
document.addEventListener("DOMContentLoaded", async () => {
  const { $, esc } = R;
  const [moi, C] = await Promise.all([
    R.api("moi"),
    fetch("corpus.json").then((r) => r.json()).catch(() => null),
  ]);
  if (!C) { $("#avert").textContent = "Les données n'ont pas pu être chargées. Rechargez la page."; return; }
  R.moi = moi; R.enLigne = !!moi;
  R.C = C;
  R.cand = Object.fromEntries(C.candidatures.map((c) => [c.id, c]));
  R.nomConcept = Object.fromEntries(C.concepts.map((c) => [c.id, c.nom]));
  R.nomTheme = Object.fromEntries(C.themes.map((t) => [t.id, t.nom]));
  R.parId = Object.fromEntries(C.propositions.map((p) => [p.id, p]));
  R.NOTIONS = C.notions ?? []; R.VOCAB = C.vocabulaire ?? [];
  R.parNotion = Object.fromEntries(R.NOTIONS.map((n) => [n.id, n]));
  R.parTerme = Object.fromEntries(R.VOCAB.map((v) => [v.id, v]));
  R.parNomTerme = Object.fromEntries(R.VOCAB.flatMap((v) => [v.terme, ...(v.variantes || [])].map((t) => [R.sansAccent(t), v.id])));
  R.abordePar = (n) => C.candidatures.filter((c) => n.positions?.[c.id]).length;

  for (const [nom, init] of R.modules) {
    try { await init(R); } catch (e) { console.error(`Module ${nom}`, e); }
  }
  R.initPartage();
  dessinerChoixViePrivee();
  R.demarrerNavigation();
});

// Premier passage : rien n'est retenu tant que le visiteur ne l'a pas demandé.
function dessinerChoixViePrivee() {
  const { $ } = R, boite = $("#choix-vie-privee");
  boite.innerHTML = `<h2 id="vp-titre">Ici, rien ne vous suit</h2>
    <p>Ce site ne mesure pas votre visite, n'affiche aucune publicité et ne dépose aucun cookie. Vos votes et vos scores restent dans ce navigateur et disparaissent quand vous fermez l'onglet.</p>
    <p>Si vous le souhaitez, votre navigateur peut s'en souvenir d'une visite à l'autre. Cette mémoire reste sur votre appareil : elle ne nous est jamais envoyée.</p>
    <div class="choix"><button class="btn principal" data-memoire="oui">Me souvenir sur cet appareil</button><button class="btn" data-memoire="non">Rester sans mémoire</button><a class="lien-partage" href="#vie-privee">En savoir plus</a></div>`;
  boite.hidden = !!R.choix;
  boite.addEventListener("click", (e) => {
    const b = e.target.closest("[data-memoire]"); if (!b) return;
    R.choisir({ memoire: b.dataset.memoire === "oui" }); boite.hidden = true;
  });
  R.on("vue", (id) => { if (id === "vie-privee") boite.hidden = true; });
}
