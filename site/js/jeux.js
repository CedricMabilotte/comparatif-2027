// Jouer : le vote à l'aveugle et le quiz « Qui a dit ça ? ». Adresses #jouer/<jeu>.
// R.jeux.ajouter(id, nom, init) déclare un jeu : un sous-onglet et un panneau #jeu-<id>.
"use strict";
R.module("jeux", (R) => {
  const { $, $$, esc, C, cand } = R;
  const jeux = [];
  R.jeux = {
    ajouter(id, nom, { afficher } = {}) {
      if (!$(`#jeu-${id}`)) $("#jouer").insertAdjacentHTML("beforeend", `<div class="jeu" id="jeu-${id}" hidden></div>`);
      jeux.push({ id, nom, afficher });
      $("#jeux-nav").innerHTML = jeux.map((j) => `<a href="#jouer/${j.id}" data-jeu="${j.id}">${esc(j.nom)}</a>`).join("");
    },
  };
  function montrerJeu(id, args) {
    const j = jeux.find((x) => x.id === id) || jeux[0];
    R.montrer("jouer");
    $$("#jouer > .jeu").forEach((d) => { d.hidden = d.id !== `jeu-${j.id}`; });
    $$("#jeux-nav a").forEach((a) => a.dataset.jeu === j.id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    j.afficher?.(args);
  }
  R.route("jouer", () => montrerJeu(jeux[0].id));
  R.route(/^jouer\/([\w-]+)(?:\/(.*))?$/, (m) => { if (!jeux.some((j) => j.id === m[1])) return false; montrerJeu(m[1], m[2]); });
  R.route("aveugle", () => R.aller("jouer/aveugle"));
  R.route("quiz", () => R.aller("jouer/quiz"));

  // Vote à l'aveugle
  const votes = R.lire("votes", {});
  R.votes = votes;
  let fileVote = R.melange(C.propositions.filter((p) => !votes[p.id]));
  function dessinerVote(revele) {
    const s = $("#scene-aveugle");
    const fait = Object.keys(votes).length;
    if (!fileVote.length) {
      s.innerHTML = `<p class="compteur">${fait} / ${C.propositions.length} propositions jugées</p><p class="citation">Vous avez jugé toutes les propositions.</p><div class="choix"><button class="btn" id="raz">Recommencer</button></div>`;
      $("#raz").onclick = () => { for (const k in votes) delete votes[k]; R.ecrire("votes", votes); fileVote = R.melange(C.propositions.slice()); dessinerVote(); dessinerBilan(); };
      return;
    }
    const p = fileVote[0];
    s.innerHTML = `<p class="compteur">Proposition ${fait + 1} sur ${C.propositions.length}</p>
      <p class="citation">« ${esc(p.citation)} »</p>
      ${revele ? `<div class="revelation"><p>Vous avez voté <strong>${{ pour: "pour", partage: "partagé", contre: "contre" }[votes[p.id]]}</strong>. Cette proposition vient de <span class="sigle">${esc(cand[p.candidature].sigle)}</span> <strong>${esc(cand[p.candidature].nom)}</strong>.</p><span class="ref">${esc(p.source.titre)} · ${R.page(p.source)}</span><div class="choix"><button class="btn principal" id="suivante">Proposition suivante</button><button class="btn" data-partage="aveugle:${p.id}">Faire deviner à quelqu'un</button></div></div>`
      : `<div class="choix"><button class="btn pour" data-v="pour">Pour</button><button class="btn partage" data-v="partage">Partagé</button><button class="btn contre" data-v="contre">Contre</button></div>`}`;
    if (revele) $("#suivante").onclick = () => { fileVote.shift(); dessinerVote(); };
    else s.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { voter(p.id, b.dataset.v); dessinerVote(true); dessinerBilan(); });
  }
  // Un vote n'est envoyé au serveur (sans nom, pour la carte collective) que si le visiteur l'a accepté.
  function voter(id, valeur) {
    votes[id] = valeur; R.ecrire("votes", votes);
    if (R.choix?.collectif) R.api("vote", { proposition: id, valeur });
    R.emettre("vote", id, valeur);
  }
  R.voter = voter;
  function dessinerBilan() {
    const lignes = C.candidatures.map((c) => {
      const v = C.propositions.filter((p) => p.candidature === c.id && votes[p.id]).map((p) => votes[p.id]);
      const n = v.length || 1, f = (x) => (v.filter((y) => y === x).length / n) * 100;
      return `<div class="bilan-ligne"><span><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</span>
        <span class="empile" role="img" aria-label="${v.filter((y) => y === "pour").length} pour, ${v.filter((y) => y === "partage").length} partagé, ${v.filter((y) => y === "contre").length} contre">
        <i style="width:${f("pour")}%;background:var(--pour)"></i><i style="width:${f("partage")}%;background:var(--partage)"></i><i style="width:${f("contre")}%;background:var(--contre)"></i></span>
        <span class="ref">${v.length} jugée${v.length > 1 ? "s" : ""}</span></div>`;
    }).join("");
    $("#bilan").innerHTML = Object.keys(votes).length ? lignes : `<p class="aide">Votez sur une première proposition pour voir apparaître votre bilan.</p>`;
  }
  R.jeux.ajouter("aveugle", "À l'aveugle", { afficher: () => { dessinerVote(); dessinerBilan(); } });

  // Quiz
  let q;
  function nouveauQuiz() { q = { liste: R.melange(C.propositions.slice()).slice(0, 10), i: 0, score: 0, repondu: null }; dessinerQuiz(); }
  function dessinerQuiz() {
    const s = $("#scene-quiz");
    if (q.i >= q.liste.length) {
      const record = Math.max(R.lire("record", 0), q.score); R.ecrire("record", record);
      s.innerHTML = `<p class="compteur">Terminé</p><p class="citation">${q.score} bonne${q.score > 1 ? "s" : ""} réponse${q.score > 1 ? "s" : ""} sur ${q.liste.length}.</p><p class="aide">Votre meilleur score : ${record} / 10.</p><div class="choix"><button class="btn principal" id="rejouer">Rejouer</button><button class="btn" id="q-partager">Défier quelqu'un</button></div>`;
      $("#rejouer").onclick = nouveauQuiz;
      const sc = q.score, tot = q.liste.length;
      $("#q-partager").onclick = () => R.partager({ surtitre: "Qui a dit ça ?", corps: `J'ai reconnu ${sc} propositions sur ${tot}.`, pied: "Saurez-vous deviner quel parti a écrit quoi ?", texte: `J'ai reconnu ${sc}/${tot} propositions au quiz « Qui a dit ça ? ». Saurez-vous faire mieux ?`, ancre: "jouer/quiz" });
      return;
    }
    const p = q.liste[q.i];
    s.innerHTML = `<p class="compteur">Question ${q.i + 1} sur ${q.liste.length} · score ${q.score}</p><p class="citation">« ${esc(p.citation)} »</p>
      <div class="choix">${C.candidatures.map((c) => {
        let cl = "btn";
        if (q.repondu) cl += c.id === p.candidature ? " juste" : c.id === q.repondu ? " faux" : "";
        return `<button class="${cl}" data-c="${c.id}" ${q.repondu ? "disabled" : ""}><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</button>`;
      }).join("")}</div>
      ${q.repondu ? `<div class="revelation"><p>${q.repondu === p.candidature ? "Bonne réponse." : `C'était ${esc(cand[p.candidature].nom)}.`} Concepts mobilisés : ${p.concepts.map((k) => esc(R.nomConcept[k])).join(", ")}.</p><div class="choix"><button class="btn principal" id="q-suite">${q.i + 1 < q.liste.length ? "Question suivante" : "Voir le score"}</button></div></div>` : ""}`;
    if (q.repondu) $("#q-suite").onclick = () => { q.i++; q.repondu = null; dessinerQuiz(); };
    else s.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { q.repondu = b.dataset.c; if (q.repondu === p.candidature) q.score++; dessinerQuiz(); });
  }
  R.jeux.ajouter("quiz", "Qui a dit ça ?", { afficher: () => { if (!q) nouveauQuiz(); } });

  R.partageurs.aveugle = (id) => {
    const p = R.parId[id]; if (!p) return null;
    return { surtitre: "Pour ou contre ?", corps: `« ${p.citation} »`, pied: "Devinez quel parti l'a proposé, puis votez à l'aveugle.", texte: `Pour ou contre ? « ${p.citation} » Devinez quel parti l'a proposé.`, ancre: "jouer/aveugle", defi: true };
  };
});
