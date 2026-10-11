// Partis : une fiche par parti (adresse #parti-<id>), ses documents, ses concepts, ses mots,
// et ses cinq propositions les plus débattues.
"use strict";
R.module("partis", (R) => {
  const { $, esc, C, cand } = R;
  const libelleEtat = { publie: "Programme 2027 publié", partiel: "Programme 2027 partiel", attendu: "Programme 2027 attendu" };
  R.libelleEtat = libelleEtat;

  // « Débattue » : avec assez de votes réels, les propositions qui partagent le plus les votants ;
  // avant cela, les propositions qui touchent les concepts abordés par le plus grand nombre de partis.
  let divisions = null;
  async function chargerDivisions() {
    if (divisions || !R.enLigne) return;
    const votants = (await R.api("votes"))?.votants ?? [];
    const somme = {}, n = {};
    for (const v of votants) for (const [k, x] of Object.entries(v.votes)) { somme[k] = (somme[k] || 0) + x; n[k] = (n[k] || 0) + 1; }
    divisions = Object.fromEntries(Object.keys(n).filter((k) => n[k] >= 8).map((k) => [k, 1 - Math.abs(somme[k] / n[k])]));
    if (Object.keys(divisions).length < 40) divisions = {};
    dessiner();
  }
  const disputes = Object.fromEntries(R.NOTIONS.map((n) => [n.id, R.abordePar(n)]));
  const notionsDe = {};
  R.NOTIONS.forEach((n) => n.propositions.forEach((id) => (notionsDe[id] ??= []).push(n.id)));
  function debattues(cId) {
    const ps = C.propositions.filter((p) => p.candidature === cId);
    if (divisions && Object.keys(divisions).length) {
      const avec = ps.filter((p) => divisions[p.id] != null).sort((a, b) => divisions[b.id] - divisions[a.id]).slice(0, 5);
      if (avec.length >= 3) return { liste: avec, selon: "votes" };
    }
    const vus = new Set(), liste = [];
    const notes = ps.map((p) => {
      const ns = (notionsDe[p.id] || []).sort((a, b) => disputes[b] - disputes[a]);
      return [p, ns[0], ns.length ? disputes[ns[0]] : 0];
    }).filter((x) => x[1]).sort((a, b) => b[2] - a[2]);
    for (const [p, n] of notes) { if (vus.has(n)) continue; vus.add(n); liste.push([p, n]); if (liste.length === 5) break; }
    return { liste: liste.map((x) => x[0]), notion: Object.fromEntries(liste.map(([p, n]) => [p.id, n])), selon: "concepts" };
  }

  function ficheParti(c) {
    const docs = (C.documents ?? []).filter((d) => d.candidature === c.id);
    const ps = C.propositions.filter((p) => p.candidature === c.id);
    const parConcept = C.concepts.map((k) => [k, ps.filter((p) => p.concepts.includes(k.id)).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxC = Math.max(1, ...parConcept.map(([, n]) => n));
    const ns = R.NOTIONS.filter((n) => n.positions?.[c.id]).sort((a, b) => (b.usage?.[c.id] || 0) - (a.usage?.[c.id] || 0));
    const d = debattues(c.id);
    return `<article class="carte" id="parti-${c.id}">
      <h3><span class="sigle">${esc(c.sigle)}</span> ${esc(c.nom)}</h3>
      <p class="ref">${esc(c.candidat)} · <span class="etat ${c.statut_programme}">${libelleEtat[c.statut_programme]}</span></p>
      <p class="def" style="font-style:normal">${esc(c.famille[0].toUpperCase() + c.famille.slice(1))}. Candidature : ${esc(c.statut_candidat)}.</p>
      <p class="mini-titre">Ses 5 propositions les plus débattues</p>
      <p class="ref">${d.selon === "votes" ? "Celles qui partagent le plus les votants du site." : "En attendant assez de votes : une proposition par concept, parmi les concepts que le plus de partis abordent."}</p>
      <ol class="debattues">${d.liste.map((p) => `<li><a href="#prop-${p.id}">${esc(p.intitule || p.citation.slice(0, 120))}</a>${d.notion?.[p.id] ? ` <a class="etiquette" href="#concept-${d.notion[p.id]}">${esc(R.parNotion[d.notion[p.id]].nom)}</a>` : ""}</li>`).join("")}</ol>
      <div class="choix"><a class="btn" href="#jouer/aveugle/${c.id}">Juger ses propositions à l'aveugle</a><a class="btn" href="#matrice/duel/${c.id}/${C.candidatures.find((x) => x.id !== c.id).id}">Le mettre en duel</a></div>
      <p class="mini-titre">Documents de référence</p>
      <ul class="docs">${docs.map((d) => `<li><span><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.titre)}</a>${d.archive ? `<span class="archive">archive ${d.millesime ?? d.date.slice(0, 4)}</span>` : ""}</span><span class="ref">${d.type} · ${d.date} · ${R.pluriel(d.citations, "citation")}</span>${d.justification ? `<span class="justif">${esc(d.justification)}</span>` : ""}</li>`).join("")}</ul>
      <p class="mini-titre">Grandes notions les plus mobilisées</p>
      ${parConcept.map(([k, n]) => `<div class="jauge"><span>${esc(k.nom)}</span><span>${n}</span><span class="barre" style="grid-column:1/-1"><i style="width:${(n / maxC) * 100}%"></i></span></div>`).join("")}
      ${ns.length ? `<p class="mini-titre">Concepts précis abordés (${ns.length})</p><div class="mots">${ns.slice(0, 14).map((n) => `<a class="mot" href="#concept-${n.id}">${esc(n.nom)}</a>`).join("")}</div>` : ""}
      <p class="mini-titre">Mots qui lui sont propres</p>
      <div class="mots">${R.vocab.propres(c.id, 8).map(R.vocab.lienMot).join("")}</div>
      <p class="ref">${ps.length} propositions sourcées · <a href="#matrice">les lire dans la matrice</a></p>
      <div class="actions">${R.boutonPartage("parti", c.id, "Partager cette fiche")}</div>
    </article>`;
  }
  function dessiner() { $("#p-liste").innerHTML = C.candidatures.map(ficheParti).join(""); }
  dessiner();

  R.route("partis", () => { R.montrer("partis"); chargerDivisions(); });
  R.route(/^parti-([\w-]+)$/, (m) => {
    if (!cand[m[1]]) return false;
    R.montrer("partis", { haut: false }); chargerDivisions();
    document.getElementById(`parti-${m[1]}`)?.scrollIntoView({ block: "start" });
  });
  R.partageurs.parti = (id) => {
    const c = cand[id]; if (!c) return null;
    return { surtitre: "Fiche parti", corps: `${c.nom} : ${c.famille}. Candidature : ${c.statut_candidat}.`, pied: libelleEtat[c.statut_programme], texte: `${c.nom} : ses documents, ses concepts, ses mots, ses propositions les plus débattues.`, ancre: `parti-${c.id}` };
  };
});
