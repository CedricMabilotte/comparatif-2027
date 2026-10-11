// Participer : l'échelle d'engagement (#rejoindre), la lettre, le compte et les cercles ; la question sous
// chaque concept ; « Signaler une erreur » sur chaque fiche et le journal public des corrections (#corrections) ;
// les mots proposés par les visiteurs ; la file de modération (#moderation).
// Règle commune : rien n'est envoyé sans un bouton d'envoi, rien n'est publié sans relecture,
// aucune adresse n'est jamais affichée.
"use strict";
R.module("participer", (R) => {
  const { $, $$, esc } = R;
  const DEPOT = "https://github.com/CedricMabilotte/comparatif-2027";
  const HORS_LIGNE = "La participation ouvrira avec le site : rien n'a été envoyé.";
  const MUET = "Le service ne répond pas. Réessayez dans un instant.";
  const NATURES = { citation: "Citation inexacte", classement: "Mauvais classement", definition: "Définition ou repère faux", neutralite: "Manque de neutralité", autre: "Autre" };
  let compteur = 0;
  const uid = (p) => `${p}-${++compteur}`;
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

  // Les deux pages propres à ce module
  for (const [id, nom] of [["corrections", "Journal des corrections"], ["moderation", "Modération"]]) {
    if (!$(`#${id}`)) $("main").insertAdjacentHTML("beforeend", `<section class="vue" id="${id}" aria-label="${nom}" hidden></section>`);
  }

  // La fiche visée par une contribution : son genre, son nom et son adresse dans le site
  function fiche(cible) {
    const [type, id] = String(cible).split(":");
    if (type === "notion") return { genre: "Concept", nom: R.parNotion[id]?.nom ?? id, lien: `#concept-${id}` };
    if (type === "terme") return { genre: "Vocabulaire", nom: R.parTerme[id]?.terme ?? id, lien: `#terme-${id}` };
    if (type === "parti") return { genre: "Fiche parti", nom: R.cand[id]?.nom ?? id, lien: `#parti-${id}` };
    const p = R.parId[id];
    return { genre: "Proposition", nom: p ? `${R.cand[p.candidature].sigle} · ${p.intitule || p.citation.slice(0, 80) + "…"}` : id, lien: `#prop-${id}` };
  }

  // Envoi d'un formulaire. Le champ piège « site », invisible, et la durée de saisie écartent les robots ;
  // le serveur limite aussi le nombre d'envois.
  const piege = () => `<div class="piege" aria-hidden="true"><label>Ne pas remplir <input name="site" tabindex="-1" autocomplete="off"></label></div>`;
  async function envoyer(form, route, donnees, succes) {
    const etat = form.querySelector("[role=status]");
    if (!R.enLigne) { etat.textContent = HORS_LIGNE; return null; }
    const bouton = form.querySelector("[type=submit]");
    bouton.disabled = true; etat.textContent = "Envoi…";
    const r = await R.api(route, { ...donnees, site: form.elements.site?.value ?? "", duree: Date.now() - Number(form.dataset.ouvert || 0) });
    bouton.disabled = false;
    etat.textContent = r?.ok ? succes : r?.erreur ?? MUET;
    if (r?.ok) form.reset();
    return r;
  }
  // Compteur de caractères sous une zone de texte
  function compterCaracteres(racine) {
    racine.querySelectorAll("textarea[maxlength]").forEach((t) => {
      const c = t.parentElement.querySelector(`[data-compte="${t.id}"]`); if (!c) return;
      const maj = () => { c.textContent = `${t.value.length} / ${t.maxLength.toLocaleString("fr")}`; };
      t.addEventListener("input", maj); t.form?.addEventListener("reset", () => setTimeout(maj)); maj();
    });
  }
  const zone = (id, libelle, max, lignes = 3, requis = true) => `<label class="ref" for="${id}">${libelle}</label>
    <textarea class="champ" id="${id}" name="${id.split("-")[0]}" rows="${lignes}" maxlength="${max}" ${requis ? "required" : ""}></textarea>
    <span class="ref compte-car" data-compte="${id}" aria-hidden="true"></span>`;

  // ——— « Signaler une erreur » sur chaque fiche ———
  function boutonSignaler(conteneur, cible = conteneur?.dataset.ficheActions) {
    if (!conteneur || !cible || conteneur.querySelector("[data-signaler]")) return;
    conteneur.insertAdjacentHTML("beforeend", `<button type="button" class="lien-partage signaler-lien" data-signaler="${esc(cible)}" aria-expanded="false">Signaler une erreur</button>`);
  }
  function formSignalement(cible) {
    const f = fiche(cible), u = uid("sg");
    return `<form class="carte formulaire signaler" novalidate data-ouvert="${Date.now()}" aria-labelledby="${u}-t">
      <h3 id="${u}-t">Signaler une erreur</h3>
      <p class="ref">${esc(f.genre)} · ${esc(f.nom)}</p>
      <fieldset class="natures"><legend class="ref">Nature de l'erreur</legend>
        ${Object.entries(NATURES).map(([v, l]) => `<label class="puce"><input type="radio" name="nature" value="${v}"> ${l}</label>`).join("")}
      </fieldset>
      ${zone(`texte-${u}`, "Précisez ce qui est faux et, si possible, la bonne source", 1000, 3)}
      <label class="ref" for="email-${u}">Adresse e-mail, facultative, pour être tenu au courant</label>
      <input class="champ" type="email" id="email-${u}" name="email" autocomplete="email">
      ${piege()}
      <p class="ref">Un modérateur lit chaque signalement. La suite donnée figure dans le <a href="#corrections">journal public des corrections</a>, sans votre nom ni votre adresse. L'adresse sert seulement à vous prévenir, puis elle est effacée.</p>
      <div class="choix"><button class="btn principal" type="submit">Envoyer le signalement</button><button class="btn" type="button" data-annuler>Annuler</button></div>
      <p class="ref" role="status" aria-live="polite"></p>
    </form>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-signaler]"); if (!b) return;
    const actions = b.parentElement, suivant = actions.nextElementSibling;
    if (suivant?.matches("form.signaler")) suivant.remove();
    const ouvrir = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(ouvrir));
    if (!ouvrir) return;
    actions.insertAdjacentHTML("afterend", formSignalement(b.dataset.signaler));
    const f = actions.nextElementSibling;
    compterCaracteres(f); f.querySelector("input[name=nature]").focus();
    f.querySelector("[data-annuler]").onclick = () => { f.remove(); b.setAttribute("aria-expanded", "false"); b.focus(); };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const nature = f.elements.nature.value, etat = f.querySelector("[role=status]");
      if (!nature) { etat.textContent = "Choisissez la nature de l'erreur."; return; }
      const r = await envoyer(f, "signalement", { cible: b.dataset.signaler, nature, texte: f.elements.texte.value, email: f.elements.email.value }, "Merci. Votre signalement est arrivé ; un modérateur le lira.");
      if (r?.ok) f.querySelector(".choix").hidden = true;
    };
  });
  // Les fiches sont dessinées par d'autres modules : le bouton s'ajoute à chaque affichage.
  R.on("fiche-notion", (id) => { if (!id) return; boutonSignaler($(`[data-fiche-actions="notion:${id}"]`)); question(id); });
  R.on("glossaire", () => $$('[data-fiche-actions^="terme:"]').forEach((c) => boutonSignaler(c)));
  R.on("panneau", (type, id) => boutonSignaler($(`[data-fiche-actions="${type}:${id}"]`)));
  const fichesPartis = () => $$('#p-liste article[id^="parti-"] .actions').forEach((c) => boutonSignaler(c, `parti:${c.closest("article").id.slice(6)}`));
  R.on("vue", (v) => { if (v === "partis") fichesPartis(); });
  // La liste des partis se redessine quand les votes arrivent : on remet alors les boutons.
  if ($("#p-liste")) new MutationObserver(fichesPartis).observe($("#p-liste"), { childList: true });

  // ——— Une question par concept ———
  const publiees = {};
  async function question(id) {
    const boite = $(`[data-contributions="notion:${id}"]`); if (!boite) return;
    const u = uid("q");
    boite.innerHTML = `<section class="carte question" aria-labelledby="${u}-t">
      <h3 id="${u}-t">Qu'est-ce qui vous manque pour comprendre ce concept ?</h3>
      <p class="aide">Un mot obscur, un exemple, une question restée sans réponse : dites-le. Vos réponses servent à améliorer la fiche.</p>
      <div class="reponses" aria-live="polite"></div>
      <form class="formulaire" novalidate data-ouvert="${Date.now()}">
        ${zone(`texte-${u}`, "Votre réponse", 1000, 3)}
        <label class="ref" for="pseudo-${u}">Pseudonyme, facultatif</label>
        <input class="champ court" id="pseudo-${u}" name="pseudo" maxlength="40" autocomplete="nickname">
        ${piege()}
        <p class="ref">Publié après relecture, sans votre adresse : aucune ne vous est demandée.</p>
        <div class="choix"><button class="btn principal" type="submit">Envoyer ma réponse</button></div>
        <p class="ref" role="status" aria-live="polite"></p>
      </form>
    </section>`;
    const form = boite.querySelector("form");
    compterCaracteres(boite);
    form.onsubmit = (e) => { e.preventDefault(); envoyer(form, "reponse", { cible: `notion:${id}`, texte: form.elements.texte.value, pseudo: form.elements.pseudo.value }, "Merci. Votre réponse sera publiée après relecture."); };
    if (!R.enLigne) return;
    publiees[id] ??= R.api("reponses", undefined, `&cible=${encodeURIComponent("notion:" + id)}`).then((r) => r?.reponses ?? []);
    const liste = await publiees[id];
    if (!boite.isConnected || !liste.length) return;
    boite.querySelector(".reponses").innerHTML = `<p class="mini-titre">${R.pluriel(liste.length, "réponse publiée", "réponses publiées")}</p><ul class="reponses-liste">${liste.map((r) => `<li>
      <p>${esc(r.texte)}</p><p class="ref">${esc(r.pseudo || "Anonyme")} · ${date(r.le)}</p>
      ${r.reponse ? `<p class="reponse-mod"><span class="lecture">Réponse de la modération</span> ${esc(r.reponse)}</p>` : ""}</li>`).join("")}</ul>`;
  }

  // ——— La page Participer : une échelle d'engagement ———
  const jour = Math.floor(Date.now() / 864e5);
  const ess = R.essentiels?.length ? R.essentiels : R.NOTIONS;
  const conceptDuJour = ess[jour % ess.length];
  const CERCLES = [
    ["lexique", "Cercle Lexique", "relire les mots proposés, enrichir les définitions et les repères"],
    ["verification", "Cercle Vérification", "contrôler les citations et traiter les signalements"],
    ["locaux", "Cercles locaux", "organiser des lectures et des débats à l'aveugle près de chez vous"],
  ];
  const codeIntegration = conceptDuJour ? `<iframe src="https://republique.fr/c/${conceptDuJour.id}.html?integrer" width="100%" height="520" style="border:1px solid #d9dce4;border-radius:12px" loading="lazy" title="Concept · ${esc(conceptDuJour.nom)}"></iframe>` : "";

  // Chaque marche : quoi, pourquoi, pour quoi faire, comment, avec qui, et le temps que ça prend.
  const MARCHES = [
    { id: "jouer", temps: "1 minute", titre: "Jouer à l'aveugle",
      quoi: "Jugez une proposition sans savoir qui l'a écrite, puis découvrez son auteur.",
      pourquoi: "Lire une idée pour ce qu'elle dit, avant l'étiquette du parti.",
      pourquoiFaire: "Repérer vos propres réflexes de lecture et, si vous l'acceptez, nourrir la carte des consensus.",
      avec: "Seul, ou à plusieurs en vous passant le téléphone.",
      comment: `<a class="btn principal" href="#jouer/aveugle">Juger une première proposition</a>` },
    { id: "signaler", temps: "2 minutes", titre: "Signaler une erreur",
      quoi: "Une citation inexacte, un mauvais classement, une définition fausse, un mot qui penche : dites-le.",
      pourquoi: "La neutralité se prouve en public : chaque correction est datée et expliquée.",
      pourquoiFaire: "Corriger la fiche pour tous les lecteurs.",
      avec: "Le cercle Vérification lit chaque signalement.",
      comment: `<p>Le lien « Signaler une erreur » figure au bas de chaque fiche.</p><a class="btn" href="#corrections">Lire le journal des corrections</a>` },
    { id: "comprendre", temps: "2 minutes", titre: "Dire ce qui vous manque",
      quoi: "Sous chaque concept, une seule question : qu'est-ce qui vous manque pour comprendre ?",
      pourquoi: "Une fiche n'est claire que si elle l'est pour ceux qui découvrent le sujet.",
      pourquoiFaire: "Ajouter l'exemple, le repère ou le mot qui manquait.",
      avec: "Les réponses sont relues avant d'être publiées sous la fiche.",
      comment: conceptDuJour ? `<a class="btn" href="#concept-${conceptDuJour.id}">Le concept du jour : ${esc(conceptDuJour.nom)}</a>` : "" },
    { id: "proposer", temps: "2 minutes", titre: "Proposer un concept ou un mot",
      quoi: "Un terme du débat qui n'a pas encore sa fiche.",
      pourquoi: "La liste grandit avec ceux qui lisent les programmes.",
      pourquoiFaire: "Que le prochain lecteur trouve la définition et ce qu'en dit chaque parti.",
      avec: "Le cercle Lexique relit chaque proposition avant de rédiger la fiche.",
      comment: "formulaire" },
    { id: "lettre", temps: "30 secondes", titre: "Recevoir un concept par jour ou par semaine",
      quoi: "Un concept expliqué, avec ce qu'en dit chaque parti, dans votre boîte aux lettres.",
      pourquoi: "Comprendre le débat un peu chaque jour, à votre rythme.",
      pourquoiFaire: "Arriver en 2027 en connaissant les mots du débat.",
      avec: "Seul, ou à transférer à qui vous voulez.",
      comment: "formulaire" },
    { id: "compte", temps: "1 minute", titre: "Créer un compte ou se connecter",
      quoi: "Une adresse e-mail, sans mot de passe : un lien de connexion suffit.",
      pourquoi: "Retrouver vos votes sur votre téléphone et votre ordinateur.",
      pourquoiFaire: "Rejoindre un cercle et déclarer les séances que vous animez.",
      avec: "Vos votes restent séparés de votre adresse.",
      comment: "formulaire" },
    { id: "cercles", temps: "Quelques heures par mois", titre: "Rejoindre un cercle",
      quoi: "Des groupes de travail ouverts, thématiques ou locaux.",
      pourquoi: "Relire, vérifier et faire lire à plusieurs vaut mieux que seul.",
      pourquoiFaire: "Tenir les fiches à jour et organiser des lectures près de chez vous.",
      avec: "D'autres lecteurs ; les discussions ouvriront sur Matrix, une messagerie libre.",
      comment: "cercles" },
    { id: "animer", temps: "Une soirée", titre: "Animer une séance",
      quoi: "Une lecture à l'aveugle, un concept décortiqué, un duel de mots : en classe, en bibliothèque, entre amis ou en visio.",
      pourquoi: "On lit mieux un programme quand on en discute.",
      pourquoiFaire: "Faire voter la salle sur les idées, puis révéler qui les porte.",
      avec: "Votre groupe ; le kit fournit le déroulé, les supports et le mode projection.",
      comment: `<a class="btn principal" href="#groupes/animer">Préparer une séance</a>` },
    { id: "diffuser", temps: "1 minute", titre: "Faire connaître le site",
      quoi: "Partager une fiche, un concept ou le site, ou l'intégrer dans un article.",
      pourquoi: "Une ressource neutre n'a d'utilité que si elle circule.",
      pourquoiFaire: "Donner aux autres de quoi se faire un avis, citations à l'appui.",
      avec: "Vos proches, vos élèves, vos lecteurs.",
      comment: "diffuser" },
    { id: "code", temps: "À votre rythme", titre: "Contribuer au code et aux données",
      quoi: "Le code, les données et l'historique de chaque modification sont publics.",
      pourquoi: "Chacun peut vérifier la méthode et refaire les contrôles.",
      pourquoiFaire: "Corriger une donnée, améliorer un script, proposer une fonction.",
      avec: "Les contributeurs du dépôt GitHub.",
      comment: `<a class="btn" href="${DEPOT}" target="_blank" rel="noopener">Ouvrir le dépôt</a><a class="lien-partage" href="${DEPOT}/issues" target="_blank" rel="noopener">Les sujets ouverts</a>` },
  ];

  function formulaire(id) {
    if (id === "proposer") return `<form class="formulaire" id="f-suggestion" novalidate data-ouvert="${Date.now()}">
      <label class="ref" for="sg-terme">Le terme</label><input class="champ" id="sg-terme" name="terme" maxlength="120" required>
      ${zone("texte-sg", "Pourquoi il compte", 1000, 3)}
      <label class="ref" for="sg-lieu">Où on le rencontre (un programme, un débat, un article), facultatif</label><input class="champ" id="sg-lieu" name="lieu" maxlength="300">
      <label class="ref" for="sg-pseudo">Pseudonyme, facultatif</label><input class="champ" id="sg-pseudo" name="pseudo" maxlength="40" autocomplete="nickname">
      <label class="ref" for="sg-email">Adresse e-mail, facultative, pour savoir si le mot est retenu</label><input class="champ" type="email" id="sg-email" name="email" autocomplete="email">
      ${piege()}
      <p class="ref">Chaque proposition est relue. Si elle est retenue, le mot figure ci-dessous, avec votre pseudonyme seulement.</p>
      <button class="btn principal" type="submit">Proposer ce mot</button>
      <p class="ref" role="status" aria-live="polite"></p></form>`;
    if (id === "lettre") return `<form class="formulaire" id="f-lettre" novalidate>
      <fieldset class="natures"><legend class="ref">Fréquence</legend>
        <label class="puce"><input type="radio" name="frequence" value="jour"> Un concept par jour</label>
        <label class="puce"><input type="radio" name="frequence" value="semaine" checked> Un par semaine, le dimanche</label>
      </fieldset>
      <label class="ref" for="l-email">Adresse e-mail</label>
      <input class="champ" type="email" id="l-email" autocomplete="email" required>
      <p class="ref">Une confirmation par e-mail ; sans elle, l'adresse est effacée. Désinscription en un clic dans chaque lettre.</p>
      <button class="btn principal" type="submit">M'abonner</button>
      <p class="ref" role="status" aria-live="polite" id="l-etat"></p></form>`;
    if (id === "compte") return R.moi?.connecte ? `<form class="formulaire" id="f-profil" novalidate>
      <p class="ref" role="status" aria-live="polite" id="c-etat"></p>
      <p>Vous êtes connecté.</p>
      <label class="ref" for="pf-pseudo">Pseudonyme public</label>
      <input class="champ" id="pf-pseudo" maxlength="40" autocomplete="nickname" value="${esc(R.moi.pseudo ?? "")}">
      <label class="ref" for="pf-commune">Commune, facultative, pour trouver un cercle près de chez vous</label>
      <input class="champ" id="pf-commune" maxlength="120" autocomplete="address-level2" value="${esc(R.moi.commune?.nom ?? "")}">
      <div class="choix"><button class="btn principal" type="submit">Enregistrer</button><button class="btn" type="button" id="pf-sortir">Me déconnecter</button></div>
      <p class="ref" role="status" aria-live="polite" id="pf-etat"></p></form>`
      : `<form class="formulaire" id="f-compte" novalidate>
      <label class="ref" for="c-email">Adresse e-mail</label>
      <input class="champ" type="email" id="c-email" autocomplete="email" required>
      <label class="consent"><input type="checkbox" id="c-consent"> J'accepte que mes votes soient enregistrés. Ils restent séparés de mon adresse, ne sont jamais publiés individuellement et je peux les effacer à tout moment.</label>
      <button class="btn principal" type="submit">Recevoir mon lien de connexion</button>
      <p class="ref" role="status" aria-live="polite" id="c-etat"></p></form>`;
    if (id === "cercles") return `<ul class="docs cercles" id="r-cercles">${CERCLES.map(([c, n, d]) => `<li><span><strong>${esc(n)}</strong> · ${esc(d)}</span>
      <span class="choix"><button class="btn" type="button" data-cercle="${c}" aria-pressed="false">Me prévenir à l'ouverture</button><span class="ref" data-cercle-n="${c}"></span></span></li>`).join("")}</ul>
      <p class="ref" role="status" aria-live="polite" id="cercles-etat">Il faut un compte pour être prévenu : nous n'envoyons qu'un message, à l'ouverture.</p>`;
    if (id === "diffuser") return `<div class="choix">${R.boutonPartage("site", "accueil", "Partager le site")}${conceptDuJour ? R.boutonPartage("notion", conceptDuJour.id, "Partager le concept du jour") : ""}</div>
      <p>Chaque fiche a son bouton « Partager » : une image prête pour les réseaux, un lien qui s'affiche bien et, pour les concepts et les mots, une ligne de code à coller dans un article ou un espace de cours.</p>
      <label class="ref" for="r-code">Exemple : le concept du jour, à intégrer</label>
      <textarea id="r-code" rows="3" readonly>${esc(codeIntegration)}</textarea>
      <div class="choix"><button class="btn" type="button" id="r-copier">Copier le code</button><span class="ref" role="status" id="r-copie"></span></div>`;
    return "";
  }

  const marcheHTML = (m, i) => `<article class="carte marche" id="marche-${m.id}" aria-labelledby="mt-${m.id}">
    <p class="marche-tete"><span class="marche-n" aria-hidden="true">${i + 1}</span><span class="etiquette">${esc(m.temps)}</span></p>
    <h3 id="mt-${m.id}">${esc(m.titre)}</h3>
    <p class="marche-quoi">${esc(m.quoi)}</p>
    <dl class="marche-dl"><dt>Pourquoi</dt><dd>${esc(m.pourquoi)}</dd><dt>Pour quoi faire</dt><dd>${esc(m.pourquoiFaire)}</dd><dt>Avec qui</dt><dd>${esc(m.avec)}</dd></dl>
    <div class="marche-comment">${/^[a-z]+$/.test(m.comment) ? formulaire(m.id) : `<div class="choix">${m.comment}</div>`}</div>
  </article>`;

  function dessinerPage() {
    $("#rejoindre").innerHTML = `
      <div class="titre-section"><h2>Participer</h2></div>
      <p class="aide">Chaque marche est facultative et la première ne prend qu'une minute. Vous pouvez lire, voter et jouer sans rien donner.</p>
      <p class="avert" id="r-hors-ligne" ${R.enLigne ? "hidden" : ""}><strong>Aperçu.</strong> Les envois ouvriront avec le site. Les formulaires ci-dessous montrent le parcours ; rien n'est envoyé.</p>
      <p class="ref vie-privee-rappel">Aucun traceur : ce site ne mesure pas votre visite. Rien ne part sans que vous appuyiez sur un bouton d'envoi, et chaque formulaire dit ce qu'il envoie. <a href="#vie-privee">Vie privée</a></p>
      <nav class="echelle-sommaire" aria-label="Les marches">${MARCHES.map((m, i) => `<a href="#rejoindre/${m.id}"><span class="marche-n" aria-hidden="true">${i + 1}</span>${esc(m.titre)}<small>${esc(m.temps)}</small></a>`).join("")}</nav>
      <p class="ref" id="r-moderation" hidden></p>
      <div class="echelle">${MARCHES.map(marcheHTML).join("")}</div>
      <div class="titre-section" id="proposes"><h2>Proposés par les visiteurs</h2></div>
      <p class="aide">Les mots et concepts proposés sur cette page et retenus après relecture.</p>
      <div id="r-proposes" aria-live="polite"><p class="vide">${R.enLigne ? "Aucun mot retenu pour l'instant." : "La liste s'affichera à l'ouverture de la participation."}</p></div>`;
    brancherFormulaires();
  }

  async function soumettre(e, route, donnees, etat, succes) {
    e.preventDefault();
    if (!R.enLigne) { $(etat).textContent = HORS_LIGNE; return null; }
    const r = await R.api(route, donnees);
    $(etat).textContent = r?.ok ? succes : r?.erreur ?? MUET;
    return r;
  }
  function brancherFormulaires() {
    compterCaracteres($("#rejoindre"));
    const fs = $("#f-suggestion");
    fs.onsubmit = async (e) => {
      e.preventDefault();
      const r = await envoyer(fs, "suggestion", { terme: fs.elements.terme.value, texte: fs.elements.texte.value, lieu: fs.elements.lieu.value, pseudo: fs.elements.pseudo.value, email: fs.elements.email.value }, "Merci. Votre proposition sera relue par le cercle Lexique.");
      if (r?.ok) fs.dataset.ouvert = Date.now();
    };
    $("#f-lettre").onsubmit = (e) => {
      const frequence = $("#f-lettre").elements.frequence.value;
      soumettre(e, "lettre", { email: $("#l-email").value, frequence }, "#l-etat", "Vérifiez votre boîte : un e-mail de confirmation vient de partir.");
    };
    $("#f-compte")?.addEventListener("submit", (e) => {
      if (!$("#c-consent").checked) { e.preventDefault(); $("#c-etat").textContent = "Cochez la case pour créer un compte."; return; }
      soumettre(e, "lien-magique", { email: $("#c-email").value, consentement: true }, "#c-etat", "Lien envoyé. Ouvrez-le depuis votre boîte dans les 30 minutes.");
    });
    $("#f-profil")?.addEventListener("submit", async (e) => {
      // La route « profil » remet la commune à zéro : la commune, en texte libre, s'écrit juste après.
      const r = await soumettre(e, "profil", { pseudo: $("#pf-pseudo").value, commune: null }, "#pf-etat", "Profil enregistré.");
      if (!r?.ok) return;
      const nom = $("#pf-commune").value.trim();
      const c = await R.api("profil-commune", nom ? { nom } : { effacer: true });
      if (!c?.ok) $("#pf-etat").textContent = c?.erreur ?? MUET;
    });
    $("#pf-sortir")?.addEventListener("click", async () => {
      await R.api("deconnexion", {});
      history.replaceState(history.state, "", "#rejoindre"); location.reload();
    });
    $("#r-cercles").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cercle]"); if (!b) return;
      if (!R.enLigne) { $("#cercles-etat").textContent = HORS_LIGNE; return; }
      if (!R.moi?.connecte) { $("#cercles-etat").innerHTML = `Créez d'abord un compte : <a href="#rejoindre/compte">une minute, sans mot de passe</a>.`; return; }
      const rejoindre = b.getAttribute("aria-pressed") !== "true";
      const r = await R.api("cercle", { cercle: b.dataset.cercle, rejoindre });
      $("#cercles-etat").textContent = r?.ok ? (rejoindre ? "C'est noté : vous serez prévenu à l'ouverture de ce cercle." : "C'est noté : vous ne serez pas prévenu.") : r?.erreur ?? MUET;
      chargerCercles();
    });
    $("#r-copier").onclick = async () => {
      try { await navigator.clipboard.writeText($("#r-code").value); $("#r-copie").textContent = "Code copié."; }
      catch { $("#r-code").select(); $("#r-copie").textContent = "Code sélectionné : copiez-le avec Ctrl+C."; }
    };
  }

  async function chargerCercles() {
    if (!R.enLigne) return;
    const r = await R.api("cercles"); if (!r) return;
    CERCLES.forEach(([c]) => {
      const n = r.compte?.[c] ?? 0, b = $(`[data-cercle="${c}"]`), moi = (r.miens || []).includes(c);
      if (!b) return;
      b.setAttribute("aria-pressed", String(moi)); b.textContent = moi ? "Vous serez prévenu" : "Me prévenir à l'ouverture";
      $(`[data-cercle-n="${c}"]`).textContent = n ? `${R.pluriel(n, "personne attend", "personnes attendent")} l'ouverture` : "";
    });
  }
  async function chargerProposes() {
    if (!R.enLigne) return;
    const l = (await R.api("suggestions"))?.suggestions; if (!l) return;
    if (!l.length) return;
    $("#r-proposes").innerHTML = `<ul class="docs proposes">${l.map((s) => `<li><span><strong>${esc(s.terme)}</strong> <span class="etat ${s.etat === "ajoute" ? "publie" : "partiel"}">${s.etat === "ajoute" ? "ajouté" : "en rédaction"}</span></span>
      <span class="ref">Proposé par ${esc(s.pseudo || "un visiteur")} · ${date(s.le)}</span>${s.reponse ? `<span class="justif">${esc(s.reponse)}</span>` : ""}</li>`).join("")}</ul>`;
  }
  async function lienModeration() {
    if (!R.enLigne || !R.moi?.connecte) return;
    const r = await R.api("moderation-acces");
    if (!r?.moderateur) return;
    const p = $("#r-moderation"); p.hidden = false;
    p.innerHTML = `Vous modérez : <a href="#moderation">${R.pluriel(r.attente, "élément en attente", "éléments en attente")}</a>.`;
  }

  // Retour d'un lien reçu par e-mail : un message, puis la page Participer.
  const message = { "#bienvenue": "Vous êtes connecté.", "#connexion-expiree": "Ce lien de connexion a expiré. Demandez-en un nouveau.", "#abonnement-confirme": "Inscription confirmée. Votre premier concept arrive bientôt.", "#lien-expire": "Ce lien a expiré." }[location.hash];
  dessinerPage();
  if (message) {
    $(/abonnement|lien-expire/.test(location.hash) ? "#l-etat" : "#c-etat").textContent = message;
    history.replaceState(history.state, "", "#rejoindre");
  }

  function montrerParticiper(ancre) {
    R.montrer("rejoindre", { haut: !ancre });
    chargerCercles(); chargerProposes(); lienModeration();
    if (ancre) {
      const cible = ancre === "proposes" ? $("#proposes") : $(`#marche-${ancre}`);
      if (!cible) return false;
      requestAnimationFrame(() => cible.scrollIntoView({ block: "start" }));
    }
  }
  R.route("rejoindre", () => montrerParticiper());
  R.route(/^rejoindre\/([\w-]+)$/, (m) => montrerParticiper(m[1]));

  R.partageurs.site = () => ({
    surtitre: "République des mots 2027", corps: `${R.DEVISE ?? ""} Les programmes des huit principales forces politiques, citation par citation.`.trim(),
    pied: "Concepts, vocabulaire, votes à l'aveugle, jeux et séances en groupe",
    texte: "Lire les programmes 2027 côte à côte et juger les idées avant de savoir de qui elles viennent.", ancre: "accueil",
  });

  // ——— Journal public des corrections ———
  async function dessinerJournal() {
    const s = $("#corrections");
    s.innerHTML = `<div class="methode">
      <h2>Journal des corrections</h2>
      <p>Chaque erreur signalée sur une fiche est examinée. Celles qui ont été traitées figurent ici, avec la date, la fiche concernée et ce qui a été corrigé, ou pourquoi rien ne l'a été. Les noms et les adresses des personnes qui signalent ne sont jamais publiés.</p>
      <p>L'historique complet des données, modification par modification, est public : <a href="${DEPOT}/commits/main/data" target="_blank" rel="noopener">l'historique du dépôt sur GitHub</a>.</p>
      <p class="ref" id="j-compte" aria-live="polite"></p>
    </div>
    <ol class="journal" id="j-liste"></ol>`;
    if (!R.enLigne) { $("#j-liste").outerHTML = `<p class="vide">Le journal s'affichera ici à l'ouverture de la participation. En attendant, l'historique du dépôt fait foi.</p>`; return; }
    const r = await R.api("corrections");
    if (!r?.corrections) { $("#j-compte").textContent = MUET; return; }
    const k = r.compte;
    $("#j-compte").textContent = `${R.pluriel(k.corrige, "erreur corrigée", "erreurs corrigées")} · ${R.pluriel(k.non_retenu, "signalement non retenu", "signalements non retenus")} · ${R.pluriel(k.attente, "signalement en cours d'examen", "signalements en cours d'examen")}`;
    $("#j-liste").innerHTML = r.corrections.length ? r.corrections.map((c) => {
      const f = fiche(c.cible);
      return `<li class="carte">
        <p class="journal-tete"><time datetime="${esc(c.traite_le)}">${date(c.traite_le)}</time><span class="etat ${c.etat === "corrige" ? "publie" : "attendu"}">${c.etat === "corrige" ? "Corrigé" : "Non retenu"}</span><span class="etiquette">${esc(NATURES[c.nature] ?? "Autre")}</span></p>
        <p><span class="ref">${esc(f.genre)}</span> <a href="${f.lien}">${esc(f.nom)}</a></p>
        <p class="def" style="font-style:normal">${esc(c.note)}</p>
        <p class="ref">Signalé le ${date(c.cree_le)}</p></li>`;
    }).join("") : `<p class="vide">Aucun signalement traité pour l'instant.</p>`;
  }
  R.route("corrections", () => { R.montrer("corrections"); dessinerJournal(); });

  // ——— Modération ———
  const GENRES = { reponse: "Réponses", signalement: "Signalements", suggestion: "Mots proposés" };
  const BOUTONS = {
    reponse: [["publier", "Publier", "principal"], ["refuser", "Refuser", "contre"]],
    signalement: [["corrige", "Corrigé", "principal"], ["non_retenu", "Non retenu", ""]],
    suggestion: [["redaction", "Retenu : en rédaction", "principal"], ["ajoute", "Ajouté", ""], ["refuser", "Refuser", "contre"]],
  };
  const LIBELLE_REPONSE = { reponse: "Réponse publique, facultative, affichée sous la réponse", signalement: "Note publique pour le journal (obligatoire)", suggestion: "Note publique, facultative" };
  const ETATS = { publie: "Publié", refuse: "Refusé", corrige: "Corrigé", non_retenu: "Non retenu", redaction: "En rédaction", ajoute: "Ajouté", attente: "En attente" };
  let filtre = "tout";

  function elementHTML(c) {
    const f = c.cible ? fiche(c.cible) : null, u = uid("m");
    return `<article class="carte mod-item" data-id="${esc(c.id)}" data-genre="${esc(c.genre)}">
      <p class="journal-tete"><span class="etiquette">${{ reponse: "Réponse", signalement: "Signalement", suggestion: "Mot proposé" }[c.genre]}</span><time datetime="${esc(c.cree_le)}">${date(c.cree_le)}</time>${c.nature ? `<span class="etiquette">${esc(NATURES[c.nature])}</span>` : ""}</p>
      ${f ? `<p><span class="ref">${esc(f.genre)}</span> <a href="${f.lien}">${esc(f.nom)}</a></p>` : ""}
      ${c.terme ? `<p><strong>${esc(c.terme)}</strong>${c.lieu ? ` <span class="ref">· rencontré : ${esc(c.lieu)}</span>` : ""}</p>` : ""}
      <p class="mod-texte">${esc(c.texte)}</p>
      <p class="ref">${c.pseudo ? `Pseudonyme : ${esc(c.pseudo)} · ` : ""}${c.email ? `Adresse (visible par la modération seulement, prévenue automatiquement) : ${esc(c.email)}` : "Pas d'adresse"}</p>
      <label class="ref" for="${u}">${LIBELLE_REPONSE[c.genre]}</label>
      <textarea class="champ" id="${u}" rows="2" maxlength="2000">${esc(c.reponse ?? "")}</textarea>
      <div class="choix">${BOUTONS[c.genre].map(([a, l, k]) => `<button class="btn ${k}" type="button" data-action="${a}">${l}</button>`).join("")}</div>
    </article>`;
  }
  async function dessinerModeration() {
    const s = $("#moderation");
    const tete = `<div class="titre-section"><h2>Modération</h2><a class="lien-partage" href="#groupes/moderation">Modération des séances</a></div>`;
    if (!R.enLigne) { s.innerHTML = `${tete}<p class="vide">La modération ouvrira avec le site.</p>`; return; }
    const acces = await R.api("moderation-acces");
    if (!acces?.moderateur) {
      s.innerHTML = `${tete}<div class="carte"><p>Cette page est réservée à l'équipe de modération.</p><p class="ref">${acces?.connecte ? "Votre compte n'en fait pas partie. Pour rejoindre le cercle Vérification, voyez la page Participer." : "Si vous en faites partie, connectez-vous d'abord."}</p><div class="choix"><a class="btn" href="#rejoindre/${acces?.connecte ? "cercles" : "compte"}">Aller à la page Participer</a></div></div>`;
      return;
    }
    const r = await R.api("moderation");
    if (!r?.attente) { s.innerHTML = `${tete}<p class="vide">${esc(r?.erreur ?? MUET)}</p>`; return; }
    const n = (g) => r.attente.filter((c) => g === "tout" || c.genre === g).length;
    const liste = r.attente.filter((c) => filtre === "tout" || c.genre === filtre);
    s.innerHTML = `${tete}
      <p class="aide">Rien n'est publié sans votre accord. Les réponses publiées apparaissent sous la fiche ; chaque signalement clos entre au journal public avec votre note ; les mots retenus s'affichent dans « Proposés par les visiteurs ».</p>
      <p class="mod-compteur" role="status" aria-live="polite"><strong>${R.pluriel(r.attente.length, "élément en attente", "éléments en attente")}</strong> · ${Object.entries(GENRES).map(([g, l]) => `${l.toLowerCase()} : ${n(g)}`).join(" · ")}</p>
      <div class="choix" role="group" aria-label="Filtrer la file">${[["tout", "Tout"], ...Object.entries(GENRES)].map(([g, l]) => `<button class="puce" type="button" data-filtre="${g}" aria-pressed="${filtre === g}" data-actif="${filtre === g}">${l} (${n(g)})</button>`).join("")}</div>
      <p class="ref" id="mod-etat" role="status" aria-live="polite"></p>
      <div class="mod-file">${liste.length ? liste.map(elementHTML).join("") : `<p class="vide">Rien n'attend ici.</p>`}</div>
      <details class="mod-traites"><summary class="plus">Traités récemment (${r.traites.length})</summary>
        <ul class="docs">${r.traites.map((c) => `<li><span><span class="etiquette">${esc(ETATS[c.etat] ?? c.etat)}</span> ${esc(c.terme || (c.cible ? fiche(c.cible).nom : ""))} · ${date(c.traite_le)}</span><span class="justif">${esc(c.texte.slice(0, 160))}</span>${c.reponse ? `<span class="ref">Note : ${esc(c.reponse)}</span>` : ""}</li>`).join("")}</ul>
      </details>`;
  }
  $("#moderation").addEventListener("click", async (e) => {
    const fb = e.target.closest("[data-filtre]");
    if (fb) { filtre = fb.dataset.filtre; dessinerModeration(); return; }
    const b = e.target.closest("[data-action]"); if (!b) return;
    const item = b.closest(".mod-item"), note = item.querySelector("textarea");
    if (item.dataset.genre === "signalement" && !note.value.trim()) { $("#mod-etat").textContent = "Écrivez d'abord la note publique : elle figure dans le journal des corrections."; note.focus(); return; }
    b.disabled = true;
    const r = await R.api("moderer", { id: item.dataset.id, action: b.dataset.action, reponse: note.value });
    b.disabled = false;
    if (!r?.ok) { $("#mod-etat").textContent = r?.erreur ?? MUET; note.focus(); return; }
    await dessinerModeration();
    $("#mod-etat").textContent = `Fait : ${ETATS[r.etat].toLowerCase()}.`;
  });
  R.route("moderation", () => { R.montrer("moderation"); dessinerModeration(); });
});
