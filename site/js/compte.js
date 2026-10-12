// Mon espace (#compte) : le compte, ce que le navigateur garde, la sauvegarde dans un fichier
// ou dans le compte, et l'effacement. Le lien du bandeau y mène toujours.
"use strict";
R.module("compte", (R) => {
  const { $, esc } = R;
  const CLE_CHOIX = "rdm-choix", FORMAT = "republique-des-mots";
  const MUET = "Le serveur ne répond pas. Réessayez dans un instant.";
  const HORS_LIGNE = "Le compte ouvrira avec le site en ligne ; la sauvegarde dans un fichier marche déjà.";

  // Ce que chaque clé de la mémoire représente, pour l'afficher en clair
  const LIBELLES = {
    "votes": ["Votes à l'aveugle", (v) => R.pluriel(Object.keys(v).length, "proposition jugée", "propositions jugées")],
    "profil-test": ["Profil d'idées", (v) => (v?.fini ? "test terminé" : "test en cours")],
    "jeux-progres": ["Scores des jeux", (v) => R.pluriel(Object.keys(v).length, "jeu", "jeux")],
    "quiz-partie": ["Quiz en cours", () => "une partie"],
    "mots-partie": ["« Qui emploie ce mot ? » en cours", () => "une partie"],
    "paires-partie": ["Paires de mots en cours", () => "une partie"],
    "defi-en-cours": ["Défi reçu d'un ami", () => "en cours"],
    "notion": ["Dernier concept lu", (v) => esc(R.parNotion[v]?.nom ?? v)],
    "groupes-salles": ["Salles que vous animez", (v) => R.pluriel(Object.keys(v).length, "salle", "salles") + " (avec leur clé d'animateur)"],
    "groupes-composition": ["Séance en préparation", () => "une sélection"],
  };
  const stockage = () => (R.choix?.memoire ? localStorage : sessionStorage);
  function contenu() {
    const s = stockage(), sortie = {};
    try { for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k !== CLE_CHOIX) sortie[k] = JSON.parse(s.getItem(k)); } } catch {}
    return sortie;
  }
  const paquet = () => ({ format: FORMAT, version: 1, le: new Date().toISOString(), memoire: contenu() });
  function restaurer(p) {
    if (p?.format !== FORMAT || typeof p.memoire !== "object" || !p.memoire) throw new Error("Ce fichier n'est pas une sauvegarde de République des mots.");
    for (const [k, v] of Object.entries(p.memoire)) if (k !== CLE_CHOIX) R.ecrire(k, v);
    return Object.keys(p.memoire).length;
  }
  // Après une restauration, chaque rubrique relit sa mémoire au chargement : on recharge sur cette page.
  const recharger = (message) => { sessionStorage.setItem("rdm-message", message); history.replaceState(history.state, "", "#compte"); location.reload(); };

  // Lien du bandeau
  const lien = $("#compte-lien");
  lien.href = "#compte";
  lien.textContent = R.moi?.connecte ? (R.moi.pseudo || "Mon espace") : "Se connecter";
  let moderateur = false;
  if (R.moi?.connecte) R.api("moderation-acces").then((r) => { moderateur = !!r?.moderateur; if (R.vueCourante === "compte") dessiner(); });

  function blocCompte() {
    if (!R.moi?.connecte) return `<section class="carte espace-bloc" aria-labelledby="e-t1">
      <h3 id="e-t1">Se connecter ou créer un compte</h3>
      <p>Pas de mot de passe : vous recevez un lien par e-mail, valable 30 minutes. Un clic, et vous êtes connecté sur cet appareil pour plusieurs mois. La même adresse sert à créer le compte la première fois et à vous reconnecter ensuite.</p>
      <p class="ref">Le compte sert à garder une copie de vos résultats pour un autre appareil, à choisir un pseudonyme, à rejoindre un cercle de relecture et, pour l'équipe, à modérer. Tout le reste du site marche sans compte.</p>
      <form class="formulaire" id="e-connexion" novalidate>
        <label class="ref" for="e-email">Adresse e-mail</label>
        <input class="champ" type="email" id="e-email" autocomplete="email" required>
        <label class="consent"><input type="checkbox" id="e-consent"> J'accepte que mes votes soient rattachés à ce compte. Ils restent séparés de mon adresse, ne sont jamais publiés individuellement et je peux les effacer ici à tout moment.</label>
        <button class="btn principal" type="submit">Recevoir mon lien de connexion</button>
        <p class="ref" role="status" aria-live="polite" id="e-etat"></p>
      </form></section>`;
    return `<section class="carte espace-bloc" aria-labelledby="e-t1">
      <h3 id="e-t1">Mon compte</h3>
      <p>Vous êtes connecté${R.moi.pseudo ? ` sous le pseudonyme <strong>${esc(R.moi.pseudo)}</strong>` : ""}${R.moi.commune?.nom ? `, commune : ${esc(R.moi.commune.nom)}` : ""}.</p>
      ${moderateur ? `<p class="espace-mod"><strong>Vous faites partie de la modération.</strong> <a class="btn principal" href="#moderation">Ouvrir la file de modération</a> <a class="btn" href="#groupes/moderation">Séances déclarées</a></p>` : ""}
      <div class="choix"><a class="btn" href="#rejoindre/compte">Pseudonyme et commune</a><a class="btn" href="#rejoindre/cercles">Mes cercles</a><button class="btn" type="button" id="e-sortir">Me déconnecter</button></div>
    </section>`;
  }

  function blocMemoire() {
    const c = contenu(), cles = Object.keys(c);
    const lignes = cles.map((k) => { const [nom, f] = LIBELLES[k] ?? [k, () => ""]; let d = ""; try { d = f(c[k]); } catch {} return `<li><span>${esc(nom)}</span><span class="ref">${d}</span></li>`; });
    const durable = !!R.choix?.memoire;
    return `<section class="carte espace-bloc" aria-labelledby="e-t2">
      <h3 id="e-t2">Ce que ce navigateur garde</h3>
      <p>${durable ? "Mémoire activée : vos résultats restent <strong>sur cet appareil</strong> d'une visite à l'autre." : "Mémoire temporaire : vos résultats <strong>s'effacent quand vous fermez l'onglet</strong>."} Rien de cela ne nous est envoyé.</p>
      ${lignes.length ? `<ul class="docs espace-liste">${lignes.join("")}</ul>` : `<p class="vide">Rien pour l'instant : jouez, votez ou lisez, vos résultats apparaîtront ici.</p>`}
      <div class="choix">${durable ? `<button class="btn" type="button" data-memoire="non">Ne plus me souvenir (tout passe en temporaire)</button>` : `<button class="btn principal" type="button" data-memoire="oui">Me souvenir sur cet appareil</button>`}</div>
    </section>`;
  }

  function blocSauvegarde() {
    const co = R.moi?.connecte;
    return `<section class="carte espace-bloc" aria-labelledby="e-t3">
      <h3 id="e-t3">Sauvegarder et restaurer</h3>
      <p>Pour retrouver vos votes, scores et salles sur un autre appareil ou après avoir vidé votre navigateur, gardez-en une copie.</p>
      <div class="espace-deux">
        <div><p class="mini-titre">Dans un fichier, sans compte</p>
          <div class="choix"><button class="btn principal" type="button" id="e-telecharger">Télécharger ma sauvegarde</button>
          <label class="btn" for="e-fichier">Restaurer depuis un fichier</label><input type="file" id="e-fichier" accept="application/json,.json" hidden></div>
          <p class="ref">Un petit fichier .json, lisible, que vous gardez où vous voulez.</p></div>
        <div><p class="mini-titre">Dans mon compte</p>
          ${co ? `<div class="choix"><button class="btn" type="button" id="e-envoyer">Garder une copie dans mon compte</button><button class="btn" type="button" id="e-reprendre">Reprendre la copie de mon compte</button></div>
          <p class="ref" id="e-copie">Une seule copie, remplacée à chaque envoi.</p>`
          : `<p class="ref">Connectez-vous pour garder une copie en ligne et la reprendre sur votre téléphone ou un autre ordinateur.</p>`}</div>
      </div>
      <p class="ref" role="status" aria-live="polite" id="e-sauv-etat"></p>
    </section>`;
  }

  function blocServeur() {
    return `<section class="carte espace-bloc" aria-labelledby="e-t4">
      <h3 id="e-t4">Mes données sur le serveur</h3>
      <p>Le serveur ne garde que ce que vous avez envoyé : vos votes à l'aveugle (sous un numéro tiré au hasard), et, si vous en avez un, votre compte et vos contributions.</p>
      <div class="choix"><button class="btn" type="button" id="e-voir">Télécharger mes données du serveur</button><button class="btn" type="button" id="e-effacer-votes">Effacer mes votes</button>${R.moi?.connecte ? `<button class="btn danger" type="button" id="e-supprimer">Supprimer mon compte</button>` : ""}</div>
      <p class="ref" role="status" aria-live="polite" id="e-serveur-etat"></p>
      <p class="ref">Pour tout effacer de ce navigateur : <button class="lien-partage" type="button" id="e-oublier">oublier ce navigateur</button>. Détails dans la page <a href="#vie-privee">Vie privée</a>.</p>
    </section>`;
  }

  function dessiner() {
    const message = sessionStorage.getItem("rdm-message"); sessionStorage.removeItem("rdm-message");
    $("#compte").innerHTML = `<div class="titre-section"><h2>Mon espace</h2></div>
      ${message ? `<p class="avert" role="status">${esc(message)}</p>` : ""}
      ${R.enLigne ? "" : `<p class="avert"><strong>Aperçu.</strong> ${HORS_LIGNE}</p>`}
      <div class="espace">${blocCompte()}${blocMemoire()}${blocSauvegarde()}${blocServeur()}</div>`;
    brancher();
  }

  function brancher() {
    const etat = (id, t) => { const e = $(id); if (e) e.textContent = t; };
    $("#e-connexion")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!$("#e-consent").checked) return etat("#e-etat", "Cochez la case pour continuer.");
      if (!R.enLigne) return etat("#e-etat", HORS_LIGNE);
      const r = await R.api("lien-magique", { email: $("#e-email").value, consentement: true });
      etat("#e-etat", r?.ok ? "Lien envoyé. Ouvrez votre boîte (et les indésirables) et cliquez dans les 30 minutes." : r?.erreur ?? MUET);
    });
    $("#e-sortir")?.addEventListener("click", async () => { await R.api("deconnexion", {}); recharger("Vous êtes déconnecté."); });
    $("#compte").querySelector("[data-memoire]")?.addEventListener("click", (e) => { R.choisir({ memoire: e.currentTarget.dataset.memoire === "oui" }); dessiner(); });
    $("#e-telecharger").addEventListener("click", () => R.telecharger(`republique-des-mots-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(paquet(), null, 1), "application/json"));
    $("#e-fichier").addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      try {
        if (f.size > 500000) throw new Error("Fichier trop gros pour une sauvegarde.");
        const n = restaurer(JSON.parse(await f.text()));
        recharger(`${R.pluriel(n, "élément restauré", "éléments restaurés")}.${R.choix?.memoire ? "" : " Activez « Me souvenir sur cet appareil » pour les garder après la fermeture de l'onglet."}`);
      } catch (err) { etat("#e-sauv-etat", err instanceof SyntaxError ? "Ce fichier n'est pas lisible." : err.message); }
    });
    $("#e-envoyer")?.addEventListener("click", async () => {
      const r = await R.api("sauvegarde", { donnees: paquet() });
      etat("#e-sauv-etat", r?.ok ? "Copie gardée dans votre compte." : r?.erreur ?? MUET);
    });
    $("#e-reprendre")?.addEventListener("click", async () => {
      const r = await R.api("sauvegarde");
      if (!r?.donnees) return etat("#e-sauv-etat", r?.erreur ?? (r ? "Aucune copie dans votre compte pour l'instant." : MUET));
      try { const n = restaurer(r.donnees); recharger(`${R.pluriel(n, "élément repris", "éléments repris")} de votre compte.`); }
      catch (err) { etat("#e-sauv-etat", err.message); }
    });
    if (R.moi?.connecte) R.api("sauvegarde").then((r) => { if (r?.le && $("#e-copie")) $("#e-copie").textContent = `Dernière copie : ${new Date(r.le).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}. Une seule copie, remplacée à chaque envoi.`; });
    $("#e-voir").addEventListener("click", async () => {
      if (!R.enLigne) return etat("#e-serveur-etat", HORS_LIGNE);
      const r = await R.api("mes-donnees");
      if (!r || r.statut !== 200) return etat("#e-serveur-etat", r?.erreur ?? MUET);
      delete r.statut;
      R.telecharger("mes-donnees-serveur-republique-des-mots.json", JSON.stringify(r, null, 1), "application/json");
      etat("#e-serveur-etat", "Fichier téléchargé.");
    });
    $("#e-effacer-votes").addEventListener("click", async () => {
      if (!R.enLigne) return etat("#e-serveur-etat", HORS_LIGNE);
      if (!confirm("Effacer vos votes enregistrés sur le serveur ? Ceux gardés dans ce navigateur restent.")) return;
      const r = await R.api("effacer-votes", {});
      etat("#e-serveur-etat", r?.ok ? `${R.pluriel(r.n ?? 0, "vote effacé", "votes effacés")} du serveur.` : r?.erreur ?? MUET);
    });
    $("#e-supprimer")?.addEventListener("click", async () => {
      if (!confirm("Supprimer définitivement votre compte, vos votes en ligne et votre copie de sauvegarde ? Les textes déjà publiés restent, sans votre nom.")) return;
      const r = await R.api("supprimer-compte", {});
      if (r?.ok) recharger("Votre compte est supprimé."); else etat("#e-serveur-etat", r?.erreur ?? MUET);
    });
    $("#e-oublier").addEventListener("click", () => {
      if (!confirm("Effacer tout ce que ce navigateur garde de vos visites ?")) return;
      R.oublierTout(); recharger("Ce navigateur a tout oublié.");
    });
  }

  R.route("compte", () => { dessiner(); R.montrer("compte"); });
});
