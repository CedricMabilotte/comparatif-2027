// Participer : lettre, compte par lien magique, profil, cercles.
"use strict";
R.module("participer", (R) => {
  const { $, esc } = R;
  // Rejoindre : lettre, compte par lien magique, profil, cercles
  const CERCLES = [
    ["Cercle Lexique", "enrichir les définitions des concepts"],
    ["Cercle Vérification", "contrôler les citations et signaler les erreurs"],
    ["Cercles locaux", "organiser des lectures et des débats à l'aveugle près de chez vous"],
  ];
  $("#r-cercles").innerHTML = CERCLES.map(([n, d]) => `<li><span>${esc(n)}</span><span class="justif">${esc(d)}</span><span class="ref">Ouverture avec le site</span></li>`).join("");
  $("#r-hors-ligne").hidden = R.enLigne;
  const message = { "#bienvenue": "Vous êtes connecté.", "#connexion-expiree": "Ce lien de connexion a expiré. Demandez-en un nouveau.", "#abonnement-confirme": "Inscription confirmée. À dimanche !", "#lien-expire": "Ce lien a expiré." }[location.hash];
  if (message) { history.replaceState(history.state, "", "#rejoindre"); $("#c-etat").textContent = message; }
  if (R.moi?.connecte) {
    $("#f-compte").hidden = true; $("#f-profil").hidden = false;
    $("#pf-pseudo").value = R.moi.pseudo ?? ""; $("#pf-commune").value = R.moi.commune?.nom ?? "";
  }
  async function soumettre(e, route, donnees, etat, succes) {
    e.preventDefault();
    if (!R.enLigne) { $(etat).textContent = "Les inscriptions ouvriront avec le site."; return; }
    const r = await R.api(route, donnees);
    $(etat).textContent = r?.ok ? succes : r?.erreur ?? "Le service ne répond pas. Réessayez dans un instant.";
  }
  $("#f-lettre").addEventListener("submit", (e) => soumettre(e, "abonnement", { email: $("#l-email").value }, "#l-etat", "Vérifiez votre boîte : un e-mail de confirmation vient de partir."));
  $("#f-compte").addEventListener("submit", (e) => {
    if (!$("#c-consent").checked) { e.preventDefault(); $("#c-etat").textContent = "Cochez la case pour créer un compte."; return; }
    soumettre(e, "lien-magique", { email: $("#c-email").value, consentement: true }, "#c-etat", "Lien envoyé. Ouvrez-le depuis votre boîte dans les 30 minutes.");
  });
  // Communes : API publique geo.api.gouv.fr (sans clé). Indisponible en aperçu ; le champ reste libre.
  let communes = [];
  $("#pf-commune").addEventListener("input", async (e) => {
    const q = e.target.value.trim(); if (q.length < 2) return;
    try {
      communes = await (await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=code,nom,codesPostaux&limit=8`)).json();
      $("#pf-communes").innerHTML = communes.map((c) => `<option value="${esc(c.nom)} (${esc(c.codesPostaux?.[0] ?? c.code)})"></option>`).join("");
    } catch { communes = []; }
  });
  $("#f-profil").addEventListener("submit", (e) => {
    const saisie = $("#pf-commune").value, c = communes.find((x) => saisie.startsWith(x.nom));
    soumettre(e, "profil", { pseudo: $("#pf-pseudo").value, commune: c ? { insee: c.code, nom: c.nom } : null }, "#pf-etat", "Profil enregistré.");
  });

  R.route("rejoindre", () => { R.montrer("rejoindre"); });
});
