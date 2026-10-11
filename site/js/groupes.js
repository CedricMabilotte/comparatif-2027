// Groupes : tout ce qui sert à lire les programmes à plusieurs. Adresses #groupes/… :
// accueil par public, kit des quatre séances (imprimable), mode séance (composer, projeter,
// salle des participants #s/<code>, résultats), réseau d'animateurs (inscription, déclaration,
// carte des séances, retours d'expérience) et modération.
"use strict";
R.module("groupes", (R) => {
  const { $, $$, esc, C, cand } = R;

  // ---------------------------------------------------------------------------------------
  // QR code minimal : mode octet, correction M (ou L si besoin), versions 1 à 5.
  // Suit la norme ISO/IEC 18004 ; vérifié par décodage et par comparaison à une implémentation de référence.
  const QR = (() => {
    const TOTAL = [0, 26, 44, 70, 100, 134];
    const EC = { L: [0, 7, 10, 15, 20, 26], M: [0, 10, 16, 26, 18, 24] };
    const BLOCS = { L: [0, 1, 1, 1, 1, 1], M: [0, 1, 1, 1, 2, 2] };
    const NIVEAU = { L: 1, M: 0 };
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
    function diviseur(deg) {
      const r = new Array(deg).fill(0); r[deg - 1] = 1; let racine = 1;
      for (let i = 0; i < deg; i++) {
        for (let j = 0; j < deg; j++) { r[j] = mul(r[j], racine); if (j + 1 < deg) r[j] ^= r[j + 1]; }
        racine = mul(racine, 2);
      }
      return r;
    }
    function reste(data, div) {
      const r = div.map(() => 0);
      for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
      return r;
    }
    function codewords(octets, v, n) {
      const cap = TOTAL[v] - EC[n][v] * BLOCS[n][v];
      const bits = [];
      const pousser = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      pousser(4, 4); pousser(octets.length, 8); octets.forEach((o) => pousser(o, 8));
      pousser(0, Math.min(4, cap * 8 - bits.length));
      pousser(0, (8 - (bits.length % 8)) % 8);
      for (let p = 0xec; bits.length < cap * 8; p ^= 0xec ^ 0x11) pousser(p, 8);
      const data = [];
      for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
      // Blocs de correction puis entrelacement
      const nb = BLOCS[n][v], ecl = EC[n][v], courts = nb - (TOTAL[v] % nb), lc = Math.floor(TOTAL[v] / nb), div = diviseur(ecl), blocs = [];
      for (let i = 0, k = 0; i < nb; i++) {
        const d = data.slice(k, k + lc - ecl + (i < courts ? 0 : 1)); k += d.length;
        const e = reste(d, div); if (i < courts) d.push(0);
        blocs.push(d.concat(e));
      }
      const sortie = [];
      for (let i = 0; i < blocs[0].length; i++) blocs.forEach((b, j) => { if (i !== lc - ecl || j >= courts) sortie.push(b[i]); });
      return sortie;
    }
    const MASQUES = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    function construire(v, n, cw, masque) {
      const t = 17 + 4 * v, m = Array.from({ length: t }, () => new Array(t).fill(false)), f = m.map((l) => l.map(() => false));
      const fixe = (x, y, noir) => { m[y][x] = noir; f[y][x] = true; };
      for (let i = 0; i < t; i++) { fixe(6, i, i % 2 === 0); fixe(i, 6, i % 2 === 0); }
      for (const [cx, cy] of [[3, 3], [t - 4, 3], [3, t - 4]]) {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < t && y >= 0 && y < t) fixe(x, y, d !== 2 && d !== 4);
        }
      }
      if (v > 1) { const a = t - 7; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fixe(a + dx, a + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
      // Format : niveau de correction et masque, code BCH
      const donnee = (NIVEAU[n] << 3) | masque; let r = donnee;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((donnee << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) fixe(8, i, bit(i));
      fixe(8, 7, bit(6)); fixe(8, 8, bit(7)); fixe(7, 8, bit(8));
      for (let i = 9; i < 15; i++) fixe(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) fixe(t - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) fixe(8, t - 15 + i, bit(i));
      fixe(8, t - 8, true);
      // Données en zigzag, puis masque
      let i = 0;
      for (let droite = t - 1; droite >= 1; droite -= 2) {
        if (droite === 6) droite = 5;
        for (let vert = 0; vert < t; vert++) for (let j = 0; j < 2; j++) {
          const x = droite - j, y = ((droite + 1) & 2) === 0 ? t - 1 - vert : vert;
          if (!f[y][x] && i < cw.length * 8) { m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
        }
      }
      for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) if (!f[y][x] && MASQUES[masque](x, y)) m[y][x] = !m[y][x];
      return m;
    }
    function penalite(m) {
      const t = m.length; let p = 0, noirs = 0;
      const lignes = [...m.map((l) => l.map(Number).join("")), ...m.map((_, x) => m.map((l) => Number(l[x])).join(""))];
      for (const l of lignes) {
        for (const s of l.match(/0{5,}|1{5,}/g) || []) p += s.length - 2;
        p += 40 * ((("0000" + l + "0000").match(/(?=10111010000|00001011101)/g) || []).length);
      }
      for (let y = 0; y < t - 1; y++) for (let x = 0; x < t - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
      m.forEach((l) => l.forEach((c) => { noirs += c; }));
      return p + 10 * (Math.ceil(Math.abs(noirs * 20 - t * t * 10) / (t * t)) - 1);
    }
    function matrice(texte) {
      const octets = [...new TextEncoder().encode(texte)];
      for (const n of ["M", "L"]) for (let v = 1; v <= 5; v++) {
        if (12 + 8 * octets.length > (TOTAL[v] - EC[n][v] * BLOCS[n][v]) * 8) continue;
        const cw = codewords(octets, v, n);
        let mieux = null;
        for (let k = 0; k < 8; k++) { const mm = construire(v, n, cw, k), s = penalite(mm); if (!mieux || s < mieux.s) mieux = { s, mm, k }; }
        return { modules: mieux.mm, version: v, niveau: n, masque: mieux.k };
      }
      throw new Error("Texte trop long pour un QR code de version 5.");
    }
    function svg(texte, etiquette) {
      const { modules } = matrice(texte), t = modules.length, b = 4;
      let d = "";
      modules.forEach((l, y) => l.forEach((c, x) => { if (c) d += `M${x + b} ${y + b}h1v1h-1z`; }));
      return `<svg class="qr" viewBox="0 0 ${t + 2 * b} ${t + 2 * b}" shape-rendering="crispEdges" role="img" aria-label="${esc(etiquette)}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    }
    return { matrice, svg };
  })();
  R.qr = QR;

  // ---------------------------------------------------------------------------------------
  // Contenus éditoriaux : publics, séances, charte, préparation, retour d'expérience.
  const PUBLICS = [
    { id: "enseignants", nom: "Enseignants d'EMC, de SES, au lycée",
      usage: "Faire travailler l'esprit critique sur des textes réels sans prendre parti. Chaque phrase projetée est citée mot pour mot et sourcée : les élèves peuvent remonter au document.",
      seance: ["mots", "aveugle"], choix: "« Les mots pour le dire » tient dans une heure de cours. « Le débat à l'aveugle » convient à deux heures ou à un atelier.",
      retire: "Une séance clé en main, vérifiable et sans compte pour les élèves, qui relie la campagne à l'éducation aux médias et à l'information. Les votes sont anonymes : personne n'a à afficher ses idées devant la classe." },
    { id: "bibliotheques", nom: "Bibliothèques, médiathèques, centres sociaux, MJC",
      usage: "Proposer avant l'élection une animation civique ouverte à tous, sans que la structure prenne position.",
      seance: ["aveugle", "concept"], choix: "« Le débat à l'aveugle » pour une soirée publique, « Un concept, huit lectures » pour un club de lecture ou un café-débat.",
      retire: "Un format qui fait venir et parler des personnes qui ne se seraient pas assises à la même table, et une séance visible sur la carte du réseau." },
    { id: "education-populaire", nom: "Associations d'éducation populaire",
      usage: "Outiller vos animateurs pour des débats qui partent des textes plutôt que des opinions toutes faites.",
      seance: ["programme", "concept"], choix: "« Lire un programme à plusieurs » pour des groupes déjà constitués ; les quatre séances à la suite pour un cycle.",
      retire: "Un kit libre, à adapter à vos publics, un réseau pour partager ce qui marche et des retours qui font évoluer les séances." },
    { id: "collectifs", nom: "Collectifs citoyens, conseils de quartier",
      usage: "Discuter de sujets qui divisent sans se diviser : la carte de la salle montre ce qui rassemble avant ce qui sépare.",
      seance: ["aveugle"], choix: "« Le débat à l'aveugle » sur le thème qui vous occupe : pouvoir d'achat, écologie, sécurité, institutions…",
      retire: "Une trace commune et anonyme, la carte des consensus de votre salle, pour poursuivre la discussion à partir de points d'accord." },
    { id: "proches", nom: "Entre amis, en famille",
      usage: "Parler politique sans se fâcher : on juge des phrases, pas des personnes, et l'on découvre l'auteur ensuite.",
      seance: ["aveugle", "mots"], choix: "Un débat à l'aveugle raccourci : cinq propositions, vingt minutes. Ou les cartes imprimées, pour jouer sans écran autour d'une table.",
      retire: "Des surprises, souvent : on approuve une idée venue d'où on ne l'attendait pas, ou l'on découvre qu'un désaccord tenait à un mot." },
    { id: "visio", nom: "Réunions en visio",
      usage: "Animer à distance avec les mêmes outils : vous partagez l'écran de projection, les participants votent depuis leur téléphone ou un autre onglet.",
      seance: ["concept", "aveugle"], choix: "« Un concept, huit lectures » se prête bien aux petits groupes en sous-salles ; « Le débat à l'aveugle » marche partout.",
      retire: "Une réunion où chacun s'exprime, même les plus discrets, grâce au vote anonyme. Jitsi ou BigBlueButton suffisent, sans rien installer de plus." },
  ];
  const NOM_PUBLIC = { ...Object.fromEntries(PUBLICS.map((p) => [p.id, p.nom])), autre: "Autre public" };

  const SEANCES = {
    aveugle: {
      numero: 1, titre: "Le débat à l'aveugle", duree: 90, taille: "8 à 30 personnes", public: "Tout public, dès 15 ans.",
      objectif: "Juger des idées avant de savoir qui les porte, puis découvrir où le groupe s'accorde sans le savoir.",
      materiel: "Un écran ou un vidéoprojecteur relié à Internet, un téléphone par personne (ou le jeu de cartes imprimées pour jouer sans écran), la charte affichée.",
      deroule: [
        [10, "Accueil et charte", "Présentez le principe, lisez la charte à voix haute : on juge des idées, pas des personnes. Affichez le code de la salle ; chacun rejoint depuis son téléphone."],
        [40, "Huit propositions, sans auteur", "Pour chacune : lecture à voix haute, vote sur le téléphone (pour, partagé, contre), puis deux minutes d'échange cadrées par le minuteur."],
        [15, "Révélation des auteurs", "Revenez sur chaque proposition et révélez son auteur. Laissez venir les premières réactions : surprise, gêne, confirmation."],
        [20, "La carte de la salle", "Ouvrez les résultats. Sur quoi sommes-nous d'accord sans le savoir ? Où la salle se divise-t-elle vraiment ?"],
        [5, "Tour de clôture", "Une phrase chacun : ce que je retiens, ce qui m'a surpris."],
      ],
      consignes: [
        "Lisez chaque proposition d'une voix neutre, sans intonation qui oriente.",
        "Ne révélez aucun auteur avant la fin du tour de vote, même si quelqu'un croit le deviner.",
        "Rappelez que « partagé » est une réponse à part entière, et que l'on peut ne pas voter.",
        "Si la discussion glisse vers les personnes ou les partis, revenez au texte : « que dit la phrase ? »",
        "Ne donnez pas votre avis : vous êtes garant du cadre, pas arbitre du débat.",
      ],
      relance: [
        "Qu'est-ce qui a décidé votre vote : le fond, un mot, le ton ?",
        "À quelle condition pourriez-vous changer d'avis ?",
        "Qui serait gêné par cette mesure ? Qui en profiterait ?",
        "Quel mot de la phrase pèse le plus dans votre jugement ?",
        "Auriez-vous voté de la même façon en connaissant l'auteur ?",
      ],
      visio: "Partagez l'écran de projection et collez le lien de la salle dans la discussion. Chacun vote depuis son téléphone ou un autre onglet.",
    },
    concept: {
      numero: 2, titre: "Un concept, huit lectures", duree: 60, taille: "6 à 24 personnes", public: "Adultes, lycéens, clubs de lecture.",
      objectif: "Comprendre un concept débattu (GPA, droit du sol, CSG…) et distinguer les vrais désaccords des malentendus.",
      materiel: "Un écran, les positions des partis imprimées depuis la fiche du concept (ou lues sur les téléphones), de quoi noter.",
      deroule: [
        [10, "La définition", "Projetez la définition du concept et ce qui est débattu. Vérifiez que chacun comprend les termes avant d'aller plus loin."],
        [25, "Petits groupes de trois", "Chacun lit deux positions de partis, citations à l'appui, et les résume aux deux autres en une minute."],
        [20, "Mise en commun", "Où sont les vrais désaccords ? Où sont les malentendus, quand un même mot recouvre deux idées ? Projetez les citations et faites voter la salle."],
        [5, "Ce qui manque", "Notez ce qui a manqué au groupe pour comprendre, et transmettez-le dans le retour d'expérience."],
      ],
      consignes: [
        "Choisissez un concept que la plupart des partis abordent : la fiche indique combien en parlent.",
        "Distribuez les positions au hasard, jamais selon les sympathies supposées.",
        "Les résumés de position sont des lectures éditoriales : dès qu'un doute apparaît, revenez à la citation.",
        "Un parti qui ne dit rien d'un concept n'est pas « contre » : ses documents n'en parlent pas.",
      ],
      relance: [
        "Quel est le point précis du désaccord ?",
        "Désaccord sur les faits, ou sur les valeurs ?",
        "Quelle position avez-vous le plus de mal à comprendre ? Qui peut la reformuler ?",
        "Ce mot veut-il dire la même chose pour tout le monde ici ?",
      ],
      visio: "Ouvrez des sous-salles de trois pour la lecture, puis revenez en salle commune pour projeter les citations.",
    },
    mots: {
      numero: 3, titre: "Les mots pour le dire", duree: 45, taille: "Une classe, 10 à 35 personnes", public: "Idéal pour les lycées (EMC, SES) et les jeunes.",
      objectif: "Voir comment le choix d'un mot oriente déjà le débat : « charges » ou « cotisations », « méga-bassines » ou « réserves de substitution ».",
      materiel: "Un écran, un téléphone par binôme suffit, une phrase de programme imprimée par groupe pour l'atelier.",
      deroule: [
        [15, "Les paires de mots", "Projetez chaque paire. Que met en avant chaque mot ? Que laisse-t-il dans l'ombre ?"],
        [15, "Qui emploie ce mot ?", "Faites deviner, à main levée, quels partis emploient chaque mot dans leurs textes, puis révélez les comptages."],
        [15, "Atelier de réécriture", "Par deux, réécrivez une phrase de programme avec le mot de l'autre camp. Lisez les deux versions : qu'est-ce qui change ?"],
      ],
      consignes: [
        "Aucun mot n'est « le bon » : chacun éclaire un aspect de la réalité.",
        "Les comptages mesurent la présence d'un mot dans les documents lus, pas l'importance que le parti lui accorde.",
        "Pour l'atelier, prenez des phrases dans la rubrique Vocabulaire : chaque terme renvoie à ses citations.",
      ],
      relance: [
        "Que met en avant ce mot ? Que laisse-t-il dans l'ombre ?",
        "Quel mot emploieriez-vous spontanément ? Pourquoi ?",
        "La phrase réécrite dit-elle encore la même chose ?",
        "Connaissez-vous d'autres paires de ce genre ?",
      ],
      visio: "Faites deviner dans la discussion écrite avant de révéler : chacun tape les sigles auxquels il pense.",
    },
    programme: {
      numero: 4, titre: "Lire un programme à plusieurs", duree: 120, taille: "Groupes déjà constitués, 8 à 30 personnes", public: "Associations, clubs, classes de terminale, groupes d'amis réguliers.",
      objectif: "Lire réellement les programmes, au-delà des slogans, et confronter ce que chacun y a trouvé.",
      materiel: "Un écran, un ordinateur ou une tablette par sous-groupe pour lire la matrice (rubrique Comparer), de quoi noter.",
      deroule: [
        [40, "Lecture en sous-groupes", "Chaque sous-groupe tire au sort un thème et un parti, et lit ses propositions dans la matrice."],
        [40, "La mesure qui m'a le plus surpris", "Chacun présente une mesure, citation et page à l'appui. Ajoutez-la à la sélection de la séance au fur et à mesure."],
        [40, "Vote à l'aveugle et débat", "Ouvrez la salle, projetez les mesures présentées sans auteur, faites voter, puis débattez à partir de la carte des consensus."],
      ],
      consignes: [
        "Répartissez thèmes et partis par tirage au sort.",
        "Demandez une citation exacte avec sa page : le site donne la source de chaque phrase.",
        "Gardez le mode séance ouvert dans un onglet pour ajouter chaque mesure présentée, puis ouvrez la salle au moment du vote.",
        "Les programmes n'ont pas la même longueur : ne comparez pas le nombre de mesures.",
      ],
      relance: [
        "Quelle mesure vous a le plus surpris ? Citation à l'appui.",
        "Qu'est-ce qui manque dans ce programme sur ce thème ?",
        "Cette mesure répond-elle à un problème que vous rencontrez ?",
        "Le texte dit-il comment la financer ou l'appliquer ?",
      ],
      visio: "Une sous-salle par sous-groupe pour la lecture, puis tout le monde en salle commune pour le vote.",
    },
  };
  const NOM_SEANCE = { ...Object.fromEntries(Object.entries(SEANCES).map(([k, s]) => [k, s.titre])), libre: "Sélection libre" };
  const RELANCE_LIBRE = ["Qu'est-ce qui a décidé votre vote ?", "Que faudrait-il savoir de plus pour se décider ?", "Où est le vrai désaccord ?"];

  const CHARTE = [
    ["On juge des idées, pas des personnes.", "Les propositions sont présentées sans leur auteur. On parle de ce que dit la phrase, jamais de celles et ceux qui la portent ou la votent."],
    ["On cite plutôt qu'on suppose.", "Chaque proposition est une citation exacte, avec sa source. En cas de doute, on revient au texte."],
    ["On écoute jusqu'au bout.", "Une personne parle à la fois. Le minuteur protège le temps de parole de chacun."],
    ["Chacun a le droit de ne pas voter.", "Et de ne pas parler, d'hésiter, de changer d'avis. « Partagé » est une réponse à part entière."],
    ["Les votes sont anonymes.", "Personne n'a à justifier son vote ni à le montrer. Les votes de la salle sont effacés après 30 jours."],
    ["Ni consigne de vote, ni tract.", "La séance n'est pas une réunion de campagne : on n'y appelle à voter pour personne."],
    ["Ce qui se dit ici reste ici.", "Pas de photo ni d'enregistrement des personnes sans leur accord."],
    ["L'animateur garantit le cadre.", "Il distribue la parole, tient le temps et veille à la neutralité. Il ne donne pas son avis."],
  ];
  const PREPARATION = [
    ["Une semaine avant", ["Choisissez la séance qui convient à votre public et à votre durée.", "Composez la sélection dans le mode séance et relisez chaque proposition.", "Vérifiez le matériel : écran, connexion (wifi ou 4G), son si vous êtes en visio.", "Si vous le souhaitez, déclarez votre séance pour qu'elle apparaisse sur la carte du réseau."]],
    ["Le jour même", ["Arrivez vingt minutes avant. Ouvrez la salle et affichez le code en grand.", "Testez avec votre propre téléphone : rejoignez, votez, puis passez à la suite.", "Imprimez la charte, et le jeu de cartes en secours si la connexion est fragile.", "Gardez ouvert l'onglet de projection : c'est lui qui pilote la salle."]],
    ["Pendant la séance", ["Lisez la charte à voix haute dès le début.", "Reformulez plutôt que de répondre ; renvoyez les questions au groupe.", "Si l'on vous demande votre avis : « mon rôle aujourd'hui est de vous faire parler ».", "Tenez le temps avec le minuteur, et utilisez les questions de relance quand l'échange s'essouffle."]],
    ["Après", ["Montrez les résultats et la carte de la salle ; rappelez qu'un vote de salle n'est pas un sondage.", "Remplissez le retour d'expérience en cinq questions : il sert à améliorer le kit.", "Les votes de la salle s'effacent d'eux-mêmes après 30 jours."]],
  ];
  const QUESTIONS_RETOUR = [
    ["participants", "Combien étiez-vous, et qui étaient les participants ?", "Par exemple : 18 personnes, une classe de première."],
    ["reussi", "Qu'est-ce qui a le mieux fonctionné ?", ""],
    ["difficile", "Qu'est-ce qui a coincé (technique, déroulé, ambiance) ?", ""],
    ["neutralite", "Les contenus vous ont-ils paru équilibrés ? Un participant a-t-il exprimé un doute ?", ""],
    ["manque", "Que faudrait-il ajouter au site ou au kit ?", ""],
  ];
  const DEPARTEMENTS = "01 Ain|02 Aisne|03 Allier|04 Alpes-de-Haute-Provence|05 Hautes-Alpes|06 Alpes-Maritimes|07 Ardèche|08 Ardennes|09 Ariège|10 Aube|11 Aude|12 Aveyron|13 Bouches-du-Rhône|14 Calvados|15 Cantal|16 Charente|17 Charente-Maritime|18 Cher|19 Corrèze|2A Corse-du-Sud|2B Haute-Corse|21 Côte-d'Or|22 Côtes-d'Armor|23 Creuse|24 Dordogne|25 Doubs|26 Drôme|27 Eure|28 Eure-et-Loir|29 Finistère|30 Gard|31 Haute-Garonne|32 Gers|33 Gironde|34 Hérault|35 Ille-et-Vilaine|36 Indre|37 Indre-et-Loire|38 Isère|39 Jura|40 Landes|41 Loir-et-Cher|42 Loire|43 Haute-Loire|44 Loire-Atlantique|45 Loiret|46 Lot|47 Lot-et-Garonne|48 Lozère|49 Maine-et-Loire|50 Manche|51 Marne|52 Haute-Marne|53 Mayenne|54 Meurthe-et-Moselle|55 Meuse|56 Morbihan|57 Moselle|58 Nièvre|59 Nord|60 Oise|61 Orne|62 Pas-de-Calais|63 Puy-de-Dôme|64 Pyrénées-Atlantiques|65 Hautes-Pyrénées|66 Pyrénées-Orientales|67 Bas-Rhin|68 Haut-Rhin|69 Rhône|70 Haute-Saône|71 Saône-et-Loire|72 Sarthe|73 Savoie|74 Haute-Savoie|75 Paris|76 Seine-Maritime|77 Seine-et-Marne|78 Yvelines|79 Deux-Sèvres|80 Somme|81 Tarn|82 Tarn-et-Garonne|83 Var|84 Vaucluse|85 Vendée|86 Vienne|87 Haute-Vienne|88 Vosges|89 Yonne|90 Territoire de Belfort|91 Essonne|92 Hauts-de-Seine|93 Seine-Saint-Denis|94 Val-de-Marne|95 Val-d'Oise|971 Guadeloupe|972 Martinique|973 Guyane|974 La Réunion|976 Mayotte"
    .split("|").map((s) => [s.slice(0, s.indexOf(" ")), s.slice(s.indexOf(" ") + 1)]);

  // Contour simplifié de la France métropolitaine et de la Corse (Natural Earth, domaine public),
  // projeté une fois pour toutes : x = (lon + 5,2) × cos 46,5° × 60, y = (51,2 − lat) × 60.
  const CONTOUR = "M606 504L605 512L608 519L609 542L603 556L602 571L594 589L582 581L579 577L582 570L575 566L576 560L576 556L571 556L571 554L574 549L574 546L569 542L569 539L573 535L571 531L569 531L575 519L579 516L588 512L592 508L598 510L599 509L601 491L604 491L606 493L606 504ZM529 216L524 219L521 225L518 226L512 226L510 223L506 223L503 225L500 228L504 233L490 250L481 255L480 267L469 275L465 285L465 286L468 289L467 295L461 299L461 303L463 303L471 300L474 297L472 292L480 286L486 286L495 288L494 290L496 295L495 302L505 316L496 323L495 328L504 342L510 348L507 358L503 359L497 364L491 363L489 365L493 377L504 382L505 389L502 391L497 401L499 406L499 408L503 415L510 420L519 424L530 422L532 427L524 440L524 446L522 447L520 446L519 448L511 452L498 466L492 470L490 476L483 482L475 484L467 488L464 486L455 486L449 481L438 478L434 471L424 470L424 465L409 470L389 463L382 456L376 458L371 464L349 480L341 497L342 516L347 526L337 524L334 525L325 528L324 532L306 527L299 531L297 530L294 526L285 522L287 519L285 516L277 513L274 516L270 511L246 502L242 502L241 511L225 510L223 509L213 511L202 502L191 504L183 496L176 495L166 491L162 488L161 486L158 490L156 490L154 488L156 483L157 478L142 473L141 468L147 466L153 458L159 431L163 398L166 392L170 391L167 386L163 392L166 362L170 340L181 349L183 353L186 366L192 372L188 367L185 349L178 340L165 329L165 326L172 328L169 317L167 293L157 291L141 281L128 260L131 250L129 245L124 242L128 236L135 236L143 239L133 233L118 235L111 233L110 229L114 224L109 220L100 221L99 220L102 216L100 214L92 216L88 215L84 210L73 209L70 207L54 202L47 201L40 203L37 203L32 194L22 190L24 187L34 184L36 182L28 178L26 175L28 173L40 174L37 171L33 170L20 170L18 165L20 160L28 155L47 150L61 149L68 146L71 143L81 142L91 145L104 160L114 153L129 153L132 157L136 150L139 154L158 153L154 150L150 144L149 120L140 103L138 96L138 91L149 92L158 90L163 91L164 102L168 109L193 111L208 114L214 112L220 108L232 105L233 104L226 104L220 102L219 99L222 90L240 80L253 77L266 72L273 67L281 57L279 54L280 28L281 23L284 19L294 13L316 8L319 6L322 15L322 19L329 27L332 29L343 25L348 32L350 40L352 42L363 43L367 54L370 51L378 52L382 53L387 57L386 63L388 66L386 72L387 74L395 75L402 74L407 72L409 66L412 64L414 63L416 64L413 74L415 77L416 85L422 85L433 91L442 101L454 100L455 102L463 105L470 102L473 102L477 105L481 105L485 108L493 122L495 123L499 120L504 121L505 125L522 123L526 127L529 128L545 131L551 134L551 139L539 154L533 175L529 183L528 188L528 198L526 212L527 216L529 216ZM166 318L165 323L158 314L157 310L157 309L162 312L166 318Z";
  const projeter = (lat, lon) => [(lon + 5.2) * Math.cos((46.5 * Math.PI) / 180) * 60, (51.2 - lat) * 60];

  // ---------------------------------------------------------------------------------------
  // Éléments d'une séance : proposition (p…), concept précis (n:<id>) ou paire de mots (t:<id>).
  const typeItem = (id) => (id.startsWith("n:") ? "notion" : id.startsWith("t:") ? "terme" : "prop");
  const objetItem = (id) => ({ prop: () => R.parId[id], notion: () => R.parNotion[id.slice(2)], terme: () => R.parTerme[id.slice(2)] })[typeItem(id)]();
  const court = (t, n = 110) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
  const sigle = (cid) => `<span class="sigle">${esc(cand[cid]?.sigle)}</span>`;
  function libelleItem(id) {
    const o = objetItem(id);
    if (!o) return "Élément introuvable";
    return { prop: () => `« ${court(o.citation)} »`, notion: () => `Concept : ${o.nom}`, terme: () => `Mots : ${o.terme} ou ${(o.concurrents || []).slice(0, 2).join(", ")}` }[typeItem(id)]();
  }
  const taille = (t) => (t.length <= 120 ? "xl" : t.length <= 220 ? "l" : t.length <= 380 ? "m" : "s");
  const usageHTML = (u = {}) => C.candidatures.map((c) => `<span class="${u[c.id] ? "" : "zero"}">${esc(c.sigle)} ${u[c.id] || 0}</span>`).join("");
  // Ce qui s'affiche d'un élément, sur l'écran projeté comme sur le téléphone.
  function sceneItem(id, revele, { projection = false } = {}) {
    const o = objetItem(id);
    if (!o) return `<p class="vide">Cet élément n'existe plus dans le corpus.</p>`;
    if (typeItem(id) === "prop") {
      const auteur = `<div class="revelation sc-auteur"><p>${sigle(o.candidature)} <strong>${esc(cand[o.candidature].nom)}</strong></p><p class="ref">${R.refHTML(o.source)}</p></div>`;
      return `<p class="sc-citation sc-${taille(o.citation)}">« ${esc(o.citation)} »</p>${revele ? auteur : projection ? `<p class="sc-masque">Auteur masqué</p>` : ""}`;
    }
    if (typeItem(id) === "notion") {
      const pos = C.candidatures.filter((c) => o.positions?.[c.id]).map((c) => `<div class="sc-position"><p>${sigle(c.id)} <strong>${esc(c.nom)}</strong></p>${R.lectureHTML(o.positions[c.id])}</div>`).join("");
      return `<p class="mini-titre">Un concept</p><h3 class="sc-titre">${esc(o.nom)}</h3><p class="sc-def">${esc(o.definition)}</p>
        ${o.enjeux ? `<p class="mini-titre">Ce qui est débattu</p><p class="sc-def">${esc(o.enjeux)}</p>` : ""}
        ${revele ? `<div class="revelation"><p class="mini-titre">Ce qu'en disent les partis (${R.abordePar(o)} sur ${C.candidatures.length})</p><div class="sc-positions">${pos}</div></div>` : ""}`;
    }
    const autres = (o.concurrents || []).slice(0, 3);
    const lignes = [[o.terme, o.usage], ...autres.map((m) => [m, R.parTerme[R.parNomTerme[R.sansAccent(m)]]?.usage])]
      .map(([m, u]) => `<div class="sc-usage"><span>${esc(m)}</span><span class="usage-partis">${u ? usageHTML(u) : `<span class="zero">pas de relevé pour ce mot</span>`}</span></div>`).join("");
    return `<p class="mini-titre">Deux façons de dire</p><p class="sc-mots"><span>${esc(o.terme)}</span> <em>ou</em> ${autres.map((m) => `<span>${esc(m)}</span>`).join(" <em>ou</em> ")}</p>
      ${revele ? `<div class="revelation"><p class="sc-def">${esc(o.definition)}</p>${o.lecture ? `<p class="sc-def">${esc(o.lecture)}</p>` : ""}<p class="mini-titre">Nombre de citations qui emploient le mot, par parti</p>${lignes}<p class="ref">Ce comptage mesure la présence du mot dans les documents lus, pas l'importance que le parti lui accorde.</p></div>`
        : `<p class="sc-question">Qui emploie ce mot ?</p>`}`;
  }

  // Sélections par défaut, adaptées à chaque séance type.
  const propsCourtes = (theme) => C.propositions.filter((p) => (!theme || p.theme === theme) && p.citation.length >= 50 && p.citation.length <= 260);
  function unParParti(theme, n) {
    const choisies = [];
    const parParti = C.candidatures.map((c) => R.melange(propsCourtes(theme).filter((p) => p.candidature === c.id)));
    for (let tour = 0; choisies.length < n && tour < 4; tour++) parParti.forEach((l) => { if (choisies.length < n && l[tour]) choisies.push(l[tour].id); });
    return R.melange(choisies);
  }
  function conceptParDefaut(nid) {
    const n = R.parNotion[nid] || R.parNotion["droit-du-sol"] || (R.essentiels || R.NOTIONS)[0];
    const appuis = C.candidatures.map((c) => n.positions?.[c.id]?.appuis?.find((a) => R.parId[a])).filter(Boolean);
    return ["n:" + n.id, ...R.melange(appuis)];
  }
  function motsParDefaut() {
    const vus = new Set(), liste = [];
    const ajouter = (v) => { if (!v || vus.has(v.id)) return; vus.add(v.id); liste.push("t:" + v.id); (v.concurrents || []).forEach((m) => vus.add(R.parNomTerme[R.sansAccent(m)])); };
    ["charges-sociales", "mega-bassines", "superprofits", "minima-sociaux"].forEach((id) => ajouter(R.parTerme[id]));
    const somme = (u = {}) => Object.keys(u).length;
    [...R.VOCAB].filter((v) => v.concurrents?.some((m) => R.parNomTerme[R.sansAccent(m)]) && somme(v.usage) >= 2)
      .sort((a, b) => somme(b.usage) - somme(a.usage)).forEach((v) => { if (liste.length < 6) ajouter(v); });
    return liste;
  }
  function selectionParDefaut(type, theme) {
    if (type === "aveugle") return unParParti(theme, 8);
    if (type === "programme") return unParParti(theme, 10);
    if (type === "concept") return conceptParDefaut(theme);
    if (type === "mots") return motsParDefaut();
    return [];
  }

  // ---------------------------------------------------------------------------------------
  // Mise en place : la rubrique dans #groupes, la projection et la salle des participants à part.
  const main = $("#contenu");
  main.insertAdjacentHTML("beforeend", `<section class="vue" id="projection" aria-label="Projection" hidden></section><section class="vue" id="salle" aria-label="Salle de séance" hidden></section>`);
  const racine = $("#groupes");
  const SOUS = [["groupes", "Accueil"], ["groupes/composer", "Mode séance"], ["groupes/kit", "Kit d'animation"], ["groupes/animer", "Devenir animateur"], ["groupes/carte", "Carte des séances"]];
  const nav = (actif) => `<nav class="sous-onglets pas-imprimer" aria-label="Groupes">${SOUS.map(([h, n]) => `<a href="#${h}"${h === actif ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>`;
  const page = (actif, html) => { racine.onclick = null; racine.innerHTML = nav(actif) + html; R.montrer("groupes"); };
  const horsLigne = `<p class="avert"><strong>Aperçu.</strong> Cette fonction demande le site en ligne. Le kit, lui, s'imprime dès maintenant.</p>`;
  const lienSalle = (code) => `${location.origin}${location.pathname}#s/${code}`;
  const lienCourt = (code) => `${location.host}/#s/${code}`;
  const telecharger = (nom, contenu, type) => {
    if (R.telecharger) return R.telecharger(nom, contenu, type);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([contenu], { type })); a.download = nom; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const minutes = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Rafraîchissement régulier (pas de connexion permanente chez l'hébergeur) : un seul à la fois.
  let sondage = null;
  const arreterSondage = () => { clearInterval(sondage); sondage = null; };
  function sonder(f, ms) { arreterSondage(); sondage = setInterval(() => { if (document.visibilityState === "visible") f(); }, ms); }
  R.on("vue", (id) => { if (id !== "projection" && id !== "salle") arreterSondage(); });

  // Clés d'animateur : gardées sur cet appareil seulement (mémoire volontaire du site).
  const mesSalles = () => R.lire("groupes-salles", {});
  const garderSalle = (code, info) => R.ecrire("groupes-salles", { ...mesSalles(), [code]: info });

  // ---------------------------------------------------------------------------------------
  // Accueil de la rubrique
  function vueAccueil() {
    const portes = [
      ["groupes/composer", "Mode séance", "Composez une sélection, ouvrez une salle, projetez : la salle vote sur ses téléphones.", "Composer une séance →"],
      ["groupes/kit", "Le kit d'animation", "Quatre séances clés en main, minutées, avec la charte, la fiche de préparation et des cartes à imprimer.", "Lire le kit →"],
      ["groupes/animer", "Devenir animateur", "Recevez les nouvelles séances, déclarez la vôtre, partagez ce qui a marché.", "Rejoindre le réseau →"],
      ["groupes/carte", "La carte des séances", "Où le projet vit ailleurs que sur un écran : les séances à venir et passées, par région.", "Voir la carte →"],
    ];
    page("groupes", `
      <div class="heros">
        <h2 class="gr-titre">Lire les programmes à plusieurs</h2>
        <p class="chapo">Une classe, une médiathèque, une association, un salon : ce site sert aussi à lire et débattre ensemble. Vous projetez des propositions sans leur auteur, la salle vote sur ses téléphones, puis découvre où elle s'accorde. Sans compte ni installation, et sans que personne ne sache qui a voté quoi.</p>
        <form class="gr-rejoindre" id="gr-code-form"><label for="gr-code">Vous participez à une séance ? Entrez le code affiché.</label>
          <span class="choix"><input class="champ gr-code" id="gr-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE"><button class="btn principal" type="submit">Rejoindre</button></span></form>
      </div>
      <div class="portes">${portes.map(([h, t, p, l]) => `<a class="porte" href="#${h}"><h3>${t}</h3><p>${p}</p><span class="lien-fleche">${l}</span></a>`).join("")}</div>
      <h2>Comment se passe une séance</h2>
      <ol class="gr-etapes">
        <li><strong>Composez.</strong> Choisissez une séance type ou faites votre propre sélection : propositions, concepts, paires de mots.</li>
        <li><strong>Ouvrez la salle.</strong> Un code de cinq caractères et un QR code s'affichent. Les participants rejoignent depuis leur téléphone, sans compte.</li>
        <li><strong>Projetez.</strong> Une proposition à la fois, en très gros caractères, auteur masqué. Vous révélez quand vous le décidez.</li>
        <li><strong>Lisez les résultats ensemble.</strong> Un histogramme par proposition, puis la carte des consensus de la salle.</li>
      </ol>
      <p class="aide">Les votes de la salle sont anonymes et effacés après 30 jours. Ils restent dans la salle : ils ne rejoignent la <a href="#consensus">carte nationale des consensus</a> que pour les participants qui cochent eux-mêmes la case prévue, décochée par défaut. Avec des mineurs, ne demandez pas de cocher cette case ; pour les moins de 15 ans, recueillir l'accord des parents relève de l'animateur. Un vote de salle n'est pas un sondage : il dit ce que pensaient les personnes présentes, ce jour-là, sur ces textes-là.</p>
      <h2>Pour qui ?</h2>
      <div class="gr-publics">${PUBLICS.map((p) => `<article class="carte gr-public" id="public-${p.id}"><h3>${esc(p.nom)}</h3>
        <p><span class="mini-titre">À quoi ça vous sert</span><br>${esc(p.usage)}</p>
        <p><span class="mini-titre">Quelle séance choisir</span><br>${esc(p.choix)}</p>
        <p><span class="mini-titre">Ce que vous en retirez</span><br>${esc(p.retire)}</p>
        <p class="actions">${p.seance.map((s) => `<a class="lien-partage" href="#groupes/kit/${s}">${esc(SEANCES[s].titre)}</a>`).join("")}</p></article>`).join("")}</div>
      <p class="aide">En visio, le même mode fonctionne : partagez l'écran de projection et collez le lien de la salle dans la discussion.</p>`);
    $("#gr-code-form").onsubmit = (e) => { e.preventDefault(); const c = $("#gr-code").value.trim().toUpperCase(); if (c.length === 5) R.aller("s/" + c); else $("#gr-code").focus(); };
  }

  // ---------------------------------------------------------------------------------------
  // Kit : quatre séances, charte, fiche de préparation, cartes à imprimer
  function ficheSeanceHTML(id) {
    const s = SEANCES[id];
    return `<article class="kit-fiche" id="kit-${id}">
      <p class="mini-titre">Séance ${s.numero} · ${s.duree} minutes · ${esc(s.taille)}</p>
      <h2>${esc(s.titre)}</h2>
      <p class="kit-objectif"><strong>Objectif.</strong> ${esc(s.objectif)}</p>
      <dl class="kit-infos"><dt>Public</dt><dd>${esc(s.public)}</dd><dt>Matériel</dt><dd>${esc(s.materiel)}</dd><dt>En visio</dt><dd>${esc(s.visio)}</dd></dl>
      <h3>Déroulé</h3>
      <ol class="kit-deroule">${s.deroule.map(([m, t, d]) => `<li><span class="kit-min">${m} min</span><div><strong>${esc(t)}</strong><p>${esc(d)}</p></div></li>`).join("")}</ol>
      <h3>Consignes pour l'animateur</h3><ul class="kit-liste">${s.consignes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <h3>Questions de relance</h3><ul class="kit-liste">${s.relance.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <p class="ref kit-pied">République des mots · kit d'animation · ${esc(location.host)}/#groupes/kit/${id}</p>
    </article>`;
  }
  const charteHTML = () => `<article class="kit-fiche" id="kit-charte"><p class="mini-titre">Kit d'animation · à lire et à afficher</p><h2>Charte de séance</h2>
    <ol class="kit-charte">${CHARTE.map(([t, d]) => `<li><strong>${esc(t)}</strong> ${esc(d)}</li>`).join("")}</ol>
    <p class="ref kit-pied">République des mots · les idées d'abord, les noms ensuite</p></article>`;
  const preparationHTML = () => `<article class="kit-fiche" id="kit-preparation"><p class="mini-titre">Kit d'animation · pour l'animateur</p><h2>Fiche de préparation</h2>
    <p class="kit-objectif">Animer une séance ne demande aucune compétence politique particulière. Votre rôle : tenir le cadre, distribuer la parole, faire revenir au texte. Le site s'occupe des contenus, tous cités mot pour mot.</p>
    ${PREPARATION.map(([t, l]) => `<h3>${esc(t)}</h3><ul class="kit-liste">${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
    <h3>Ce que l'animateur ne fait pas</h3><ul class="kit-liste"><li>Donner son avis ou laisser deviner ses préférences.</li><li>Commenter un résultat comme une victoire ou une défaite.</li><li>Regrouper les résultats par parti : on parle d'idées, une par une.</li></ul>
    <p class="ref kit-pied">République des mots · kit d'animation</p></article>`;

  function vueKit(id) {
    if (id === "cartes") return vueCartes();
    if (id === "imprimer") {
      page("groupes/kit", `<div class="choix pas-imprimer"><button class="btn principal" data-imprimer>Imprimer le kit</button><a class="btn" href="#groupes/kit">Revenir au kit</a></div>
        <div class="kit-tout">${charteHTML()}${preparationHTML()}${Object.keys(SEANCES).map(ficheSeanceHTML).join("")}</div>`);
      return;
    }
    if (SEANCES[id] || id === "charte" || id === "preparation") {
      const corps = SEANCES[id] ? ficheSeanceHTML(id) : id === "charte" ? charteHTML() : preparationHTML();
      const actions = SEANCES[id]
        ? `<a class="btn principal" href="#groupes/composer/${id}">Lancer cette séance</a><a class="btn" href="#groupes/kit/cartes">Cartes à imprimer</a>`
        : `<a class="btn" href="#groupes/kit">Les quatre séances</a>`;
      page("groupes/kit", `<p class="pas-imprimer"><a class="lien-partage" href="#groupes/kit">← Le kit d'animation</a></p>${corps}
        <div class="choix pas-imprimer">${actions}<button class="btn" data-imprimer>Imprimer cette fiche</button></div>`);
      return;
    }
    page("groupes/kit", `
      <div class="titre-section"><h2>Le kit d'animation</h2><span class="choix"><a class="btn" href="#groupes/kit/imprimer">Version imprimable</a><button class="btn" data-telecharger-kit>Télécharger le kit</button></span></div>
      <p class="aide">Quatre séances qui tiennent chacune sur une page : un objectif, un déroulé minuté, les consignes et les questions de relance. Toutes marchent en salle comme en visio. Le kit est libre : adaptez-le à votre public.</p>
      <div class="gr-seances">${Object.entries(SEANCES).map(([k, s]) => `<article class="carte"><p class="mini-titre">Séance ${s.numero} · ${s.duree} min · ${esc(s.taille)}</p><h3>${esc(s.titre)}</h3><p class="def" style="font-style:normal">${esc(s.objectif)}</p>
        <p class="actions"><a class="btn principal" href="#groupes/composer/${k}">Lancer cette séance</a><a class="lien-partage" href="#groupes/kit/${k}">Lire la fiche</a></p></article>`).join("")}</div>
      <h2>Les pièces du kit</h2>
      <div class="grille-tuiles">
        <a class="tuile" href="#groupes/kit/charte">Charte de séance<small>une page à lire et afficher</small></a>
        <a class="tuile" href="#groupes/kit/preparation">Fiche de préparation<small>avant, pendant, après</small></a>
        <a class="tuile" href="#groupes/kit/cartes">Cartes à imprimer<small>format A6, recto : la proposition, verso : l'auteur</small></a>
        <a class="tuile" href="#groupes/retour">Retour d'expérience<small>cinq questions après la séance</small></a>
      </div>`);
  }

  // Cartes A6 : quatre par feuille A4. Le verso est en miroir pour une impression recto verso (bord long).
  function vueCartes() {
    const compo = R.lire("groupes-composition", null);
    const deCompo = (compo?.items || []).filter((i) => typeItem(i) === "prop" && R.parId[i]);
    let ids = deCompo.length ? deCompo : unParParti(C.themes[0].id, 8);
    const dessiner = () => {
      const feuilles = [];
      for (let i = 0; i < ids.length; i += 4) {
        const lot = ids.slice(i, i + 4).map((id) => R.parId[id]);
        while (lot.length < 4) lot.push(null);
        feuilles.push(`<div class="feuille recto">${lot.map((p, k) => p ? `<div class="carte-a6"><p class="a6-num">${i + k + 1}</p><p class="a6-citation a6-${taille(p.citation)}">« ${esc(p.citation)} »</p><p class="a6-pied">Pour · Partagé · Contre</p></div>` : `<div class="carte-a6 vide-a6"></div>`).join("")}</div>`);
        const miroir = [lot[1], lot[0], lot[3], lot[2]];
        const num = [i + 2, i + 1, i + 4, i + 3];
        feuilles.push(`<div class="feuille verso">${miroir.map((p, k) => p ? `<div class="carte-a6"><p class="a6-num">${num[k]}</p><p class="a6-auteur"><span class="sigle">${esc(cand[p.candidature].sigle)}</span><br>${esc(cand[p.candidature].nom)}</p><p class="a6-source">${esc(p.source.titre)}<br>${esc(R.page(p.source))} · ${esc(p.source.date)}${p.source.archive ? " · archive" : ""}</p><p class="a6-pied">République des mots · ${esc(location.host)}/#prop-${esc(p.id)}</p></div>` : `<div class="carte-a6 vide-a6"></div>`).join("")}</div>`);
      }
      $("#a6-feuilles").innerHTML = feuilles.join("");
      $("#a6-compte").textContent = `${R.pluriel(ids.length, "carte")} sur ${R.pluriel(feuilles.length, "feuille")} A4.`;
    };
    page("groupes/kit", `<div class="pas-imprimer gr-bloc">
        <p><a class="lien-partage" href="#groupes/kit">← Le kit d'animation</a></p>
        <h2>Cartes à imprimer</h2>
        <p class="aide">Pour jouer sans écran, en table : chaque carte porte une proposition au recto, son auteur et sa source au verso. Imprimez en recto verso (retournement sur le bord long), puis découpez en suivant les pointillés : quatre cartes A6 par feuille A4.</p>
        <div class="reglages"><label>Thème <select id="a6-theme">${C.themes.map((t) => `<option value="${t.id}">${esc(t.nom)}</option>`).join("")}</select></label>
          ${deCompo.length ? `<button class="btn" id="a6-compo">Reprendre ma sélection (${deCompo.length})</button>` : ""}
          <button class="btn principal" data-imprimer>Imprimer les cartes</button></div>
        <p class="ref" id="a6-compte" role="status"></p></div>
      <div class="a6-feuilles" id="a6-feuilles"></div>`);
    $("#a6-theme").onchange = (e) => { ids = unParParti(e.target.value, 8); dessiner(); };
    if ($("#a6-compo")) $("#a6-compo").onclick = () => { ids = deCompo; dessiner(); };
    dessiner();
  }

  // Le kit complet en un fichier autonome, lisible et imprimable hors ligne.
  function telechargerKit() {
    const style = `body{font:16px/1.5 Georgia,serif;color:#1b2130;max-width:760px;margin:2em auto;padding:0 1em}h2,h3,.mini-titre,.kit-min{font-family:system-ui,sans-serif}.mini-titre{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#5a6275}.kit-fiche{break-after:page;margin-bottom:3em}.kit-deroule{list-style:none;padding:0}.kit-deroule li{display:grid;grid-template-columns:70px 1fr;gap:10px;border-top:1px solid #d9dce4;padding:6px 0}.kit-deroule p{margin:2px 0}.ref{font-size:12px;color:#5a6275}dt{font-weight:bold;font-family:system-ui,sans-serif}dd{margin:0 0 6px}@page{size:A4;margin:15mm}`;
    const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Kit d'animation · République des mots</title><style>${style}</style><body><h1>Kit d'animation · République des mots 2027</h1><p>Quatre séances pour lire les programmes à plusieurs, en salle ou en visio. Le mode séance (projection, votes sur téléphone) est sur ${esc(location.host)}/#groupes.</p>${charteHTML()}${preparationHTML()}${Object.keys(SEANCES).map(ficheSeanceHTML).join("")}</body></html>`;
    telecharger("kit-animation-republique-des-mots.html", html, "text/html");
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-imprimer]")) window.print();
    if (e.target.closest("[data-telecharger-kit]")) telechargerKit();
  });

  // ---------------------------------------------------------------------------------------
  // Mode séance : composer
  function vueComposer(type, liste) {
    const precedente = R.lire("groupes-composition", null);
    let compo;
    if (type && liste) compo = { type, theme: C.themes[0].id, items: liste.split(",").filter((i) => objetItem(i)), titre: "" };
    else if (type) compo = { type, theme: type === "concept" ? conceptParDefaut()[0].slice(2) : C.themes[0].id, items: selectionParDefaut(type, C.themes[0].id), titre: "" };
    else compo = precedente || { type: "aveugle", theme: C.themes[0].id, items: selectionParDefaut("aveugle", C.themes[0].id), titre: "" };
    const garder = () => R.ecrire("groupes-composition", compo);
    garder();
    const salles = Object.entries(mesSalles()).filter(([, s]) => s.expire_le > new Date().toISOString()).sort((a, b) => (b[1].cree_le > a[1].cree_le ? 1 : -1));
    page("groupes/composer", `
      <div class="titre-section"><h2>Composer une séance</h2><a class="lien-partage" href="#groupes/kit">Le kit d'animation</a></div>
      <p class="aide">Choisissez une séance type : une sélection adaptée se prépare. Ajustez-la, puis ouvrez la salle. Vous n'avez pas besoin de compte.</p>
      ${R.enLigne ? "" : horsLigne}
      ${salles.length ? `<div class="carte gr-mes-salles"><h3>Vos salles sur cet appareil</h3><ul class="docs">${salles.slice(0, 5).map(([c, s]) => `<li><span><strong class="gr-code-txt">${esc(c)}</strong> · ${esc(NOM_SEANCE[s.seance] || "")}${s.titre ? " · " + esc(s.titre) : ""}</span><span class="actions"><a class="lien-partage" href="#groupes/projeter/${c}">Projeter</a><a class="lien-partage" href="#groupes/resultats/${c}">Résultats</a></span></li>`).join("")}</ul></div>` : ""}
      <fieldset class="reglages gr-types"><legend>Séance</legend>${Object.entries(NOM_SEANCE).map(([k, n]) => `<label class="puce"><input type="radio" name="gr-type" value="${k}"${k === compo.type ? " checked" : ""}> ${esc(n)}</label>`).join("")}</fieldset>
      <div id="gr-param" class="reglages"></div>
      <div class="gr-compo">
        <div class="gr-col">
          <h3 class="mini-titre" id="gr-sel-titre" aria-live="polite"></h3>
          <ol class="gr-selection" id="gr-selection"></ol>
          <label class="ref" for="gr-titre">Titre affiché sur l'écran (facultatif)</label>
          <input class="champ" id="gr-titre" maxlength="120" placeholder="Par exemple : Médiathèque, jeudi 12 mars" value="${esc(compo.titre || "")}">
          <div class="choix"><button class="btn principal" id="gr-ouvrir"${R.enLigne ? "" : " disabled"}>Ouvrir la salle</button><a class="btn" id="gr-lien-sel" href="#">Lien de cette sélection</a><a class="btn" href="#groupes/kit/cartes">Imprimer en cartes</a></div>
          <p class="ref">Ouvrir la salle envoie au site la liste des éléments choisis et le titre, rien sur vous. La salle et ses votes sont effacés après 30 jours.</p>
          <p class="ref" id="gr-etat" role="status"></p>
        </div>
        <div class="gr-col carte">
          <h3>Ajouter</h3>
          <div class="sous-onglets" role="tablist">${[["prop", "Propositions"], ["notion", "Concept"], ["terme", "Paires de mots"]].map(([k, n], i) => `<a href="#" role="tab" data-ajout="${k}"${i === 0 ? ' aria-current="true"' : ""}>${n}</a>`).join("")}</div>
          <div class="reglages"><input type="search" id="gr-cherche" aria-label="Chercher" placeholder="Un mot : retraite, nucléaire, école…"><select id="gr-theme-aj" aria-label="Thème"><option value="">Tous les thèmes</option>${C.themes.map((t) => `<option value="${t.id}">${esc(t.nom)}</option>`).join("")}</select></div>
          <div class="gr-trouves" id="gr-trouves" aria-live="polite"></div>
        </div>
      </div>`);
    let ajout = "prop";
    function dessinerParam() {
      const p = $("#gr-param");
      if (compo.type === "aveugle" || compo.type === "programme") {
        p.innerHTML = `<label>Thème <select id="gr-theme">${C.themes.map((t) => `<option value="${t.id}"${t.id === compo.theme ? " selected" : ""}>${esc(t.nom)}</option>`).join("")}</select></label><button class="btn" id="gr-retirer">Nouveau tirage</button><span class="ref">Une proposition par parti, tirée au hasard, dans un ordre mélangé.</span>`;
        $("#gr-theme").onchange = (e) => { compo.theme = e.target.value; compo.items = selectionParDefaut(compo.type, compo.theme); dessinerSel(); };
        $("#gr-retirer").onclick = () => { compo.items = selectionParDefaut(compo.type, compo.theme); dessinerSel(); };
      } else if (compo.type === "concept") {
        const triees = [...R.NOTIONS].sort((a, b) => R.abordePar(b) - R.abordePar(a) || a.nom.localeCompare(b.nom, "fr"));
        p.innerHTML = `<label>Concept <select id="gr-notion">${triees.map((n) => `<option value="${n.id}"${n.id === compo.theme ? " selected" : ""}>${esc(n.nom)} (${R.abordePar(n)} partis)</option>`).join("")}</select></label><span class="ref">La définition, puis une citation par parti qui en parle.</span>`;
        $("#gr-notion").onchange = (e) => { compo.theme = e.target.value; compo.items = conceptParDefaut(compo.theme); dessinerSel(); };
      } else if (compo.type === "mots") {
        p.innerHTML = `<button class="btn" id="gr-mots-def">Paires proposées</button><span class="ref">Des mots concurrents relevés dans les textes. Ajoutez-en d'autres à droite.</span>`;
        $("#gr-mots-def").onclick = () => { compo.items = motsParDefaut(); dessinerSel(); };
      } else p.innerHTML = `<span class="ref">Ajoutez librement des propositions, un concept ou des paires de mots.</span>`;
    }
    function dessinerSel() {
      const n = compo.items.length, votables = compo.items.filter((i) => typeItem(i) === "prop").length;
      $("#gr-sel-titre").textContent = `Votre sélection : ${R.pluriel(n, "élément")}, dont ${R.pluriel(votables, "proposition")} à voter`;
      $("#gr-selection").innerHTML = n ? compo.items.map((id, i) => `<li><span class="gr-lib">${esc(libelleItem(id))}</span><span class="gr-outils">
        <button class="btn mini" data-monter="${i}" aria-label="Monter"${i ? "" : " disabled"}>↑</button><button class="btn mini" data-descendre="${i}" aria-label="Descendre"${i < n - 1 ? "" : " disabled"}>↓</button><button class="btn mini" data-retirer="${i}" aria-label="Retirer">✕</button></span></li>`).join("")
        : `<li class="vide">Sélection vide : ajoutez des éléments à droite.</li>`;
      $("#gr-ouvrir").disabled = !R.enLigne || !n || n > 40;
      $("#gr-lien-sel").href = `#groupes/composer/${compo.type}/${compo.items.join(",")}`;
      garder(); chercher();
    }
    function chercher() {
      const q = R.sansAccent($("#gr-cherche").value.trim()), th = $("#gr-theme-aj").value;
      let res = [];
      if (ajout === "prop") res = C.propositions.filter((p) => (!th || p.theme === th) && (!q || R.sansAccent(p.citation + " " + (p.intitule || "")).includes(q))).slice(0, q || th ? 30 : 12).map((p) => p.id);
      else if (ajout === "notion") res = R.NOTIONS.filter((n) => (!th || n.theme === th) && (!q || R.sansAccent(n.nom + " " + (n.variantes || []).join(" ")).includes(q))).slice(0, 20).map((n) => "n:" + n.id);
      else res = R.VOCAB.filter((v) => v.concurrents?.length && (!th || v.theme === th) && (!q || R.sansAccent(v.terme + " " + v.concurrents.join(" ")).includes(q))).slice(0, 20).map((v) => "t:" + v.id);
      $("#gr-trouves").innerHTML = res.length ? res.map((id) => `<div class="gr-trouve"><span>${esc(libelleItem(id))}${typeItem(id) === "prop" ? ` <span class="ref">${esc(R.nomTheme[R.parId[id].theme])}</span>` : ""}</span><button class="btn mini" data-ajouter="${esc(id)}"${compo.items.includes(id) ? " disabled" : ""} aria-label="Ajouter à la sélection">${compo.items.includes(id) ? "Ajouté" : "Ajouter"}</button></div>`).join("") : `<p class="vide">Aucun résultat.</p>`;
    }
    racine.querySelectorAll('input[name="gr-type"]').forEach((r) => r.onchange = () => {
      compo.type = r.value;
      compo.theme = r.value === "concept" ? conceptParDefaut()[0].slice(2) : C.themes[0].id;
      compo.items = selectionParDefaut(compo.type, compo.theme);
      dessinerParam(); dessinerSel();
    });
    racine.querySelectorAll("[data-ajout]").forEach((a) => a.onclick = (e) => {
      e.preventDefault(); ajout = a.dataset.ajout;
      racine.querySelectorAll("[data-ajout]").forEach((b) => b === a ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"));
      $("#gr-cherche").placeholder = { prop: "Un mot : retraite, nucléaire, école…", notion: "GPA, droit du sol, CSG…", terme: "charges, bassines, assistanat…" }[ajout];
      chercher();
    });
    $("#gr-cherche").oninput = chercher; $("#gr-theme-aj").onchange = chercher;
    $("#gr-titre").oninput = (e) => { compo.titre = e.target.value; garder(); };
    racine.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const i = +(b.dataset.monter ?? b.dataset.descendre ?? b.dataset.retirer ?? -1);
      if (b.dataset.ajouter) { if (compo.items.length < 40) compo.items.push(b.dataset.ajouter); dessinerSel(); }
      else if (b.dataset.monter) { [compo.items[i - 1], compo.items[i]] = [compo.items[i], compo.items[i - 1]]; dessinerSel(); }
      else if (b.dataset.descendre) { [compo.items[i + 1], compo.items[i]] = [compo.items[i], compo.items[i + 1]]; dessinerSel(); }
      else if (b.dataset.retirer) { compo.items.splice(i, 1); dessinerSel(); }
    };
    $("#gr-ouvrir").onclick = async () => {
      $("#gr-ouvrir").disabled = true; $("#gr-etat").textContent = "Ouverture de la salle…";
      const r = await R.api("seance", { seance: compo.type, titre: compo.titre, items: compo.items });
      if (!r?.ok) { $("#gr-etat").textContent = r?.erreur ?? "Le site ne répond pas. Réessayez dans un instant."; $("#gr-ouvrir").disabled = false; return; }
      garderSalle(r.code, { cle: r.cle, seance: compo.type, titre: compo.titre, cree_le: new Date().toISOString(), expire_le: r.expire_le });
      R.aller("groupes/projeter/" + r.code);
    };
    dessinerParam(); dessinerSel();
  }

  // ---------------------------------------------------------------------------------------
  // Projection : un élément à la fois, très gros caractères, pilotage au clavier.
  const vueProjection = $("#projection");
  let pj = null; // état de la projection en cours
  function vueProjeter(code) {
    const cle = mesSalles()[code]?.cle;
    pj = { code, cle, etat: null, items: [], relance: 0, chrono: { duree: 120, reste: 120, marche: false, t: null } };
    vueProjection.innerHTML = `<div class="projection" id="pj" tabindex="-1">
      <div class="pj-tete"><span class="pj-titre" id="pj-titre"></span><span class="pj-compteur" id="pj-compteur"></span><span class="pj-direct" id="pj-direct" aria-live="polite"></span></div>
      <div class="pj-corps"><div class="pj-scene" id="pj-scene" aria-live="polite"></div>
        <aside class="pj-salle" id="pj-salle"><div class="pj-qr" id="pj-qr"></div><p class="pj-rejoindre">Rejoignez la salle</p><p class="pj-code">${esc(code)}</p><p class="pj-lien">${esc(lienCourt(code))}</p></aside></div>
      <div class="pj-relance" id="pj-relance"></div>
      <div class="pj-bas">
        <div class="choix" id="pj-pilote">
          <button class="btn" id="pj-prec" aria-keyshortcuts="ArrowLeft">← Précédent</button>
          <button class="btn principal" id="pj-reveler" aria-keyshortcuts="r">Révéler</button>
          <button class="btn principal" id="pj-suiv" aria-keyshortcuts="ArrowRight">Suivant →</button>
        </div>
        <div class="pj-chrono"><span class="pj-temps" id="pj-temps" role="timer" aria-live="off">2:00</span>
          <button class="btn mini" data-duree="60">1 min</button><button class="btn mini" data-duree="120">2 min</button><button class="btn mini" data-duree="300">5 min</button>
          <button class="btn mini" id="pj-chrono" aria-keyshortcuts="t">Démarrer</button><button class="btn mini" id="pj-raz">Remettre</button></div>
        <div class="choix"><button class="btn" id="pj-plein" aria-keyshortcuts="f">Plein écran</button><a class="btn" href="#groupes/resultats/${esc(code)}">Résultats</a><button class="btn" id="pj-clore">Clore la salle</button></div>
      </div>
      <p class="ref pj-aide pas-plein">${cle ? "Flèches du clavier pour avancer, R pour révéler, T pour le minuteur, F pour le plein écran. En visio, partagez cet écran et collez le lien de la salle dans la discussion." : "Cet appareil ne pilote pas cette salle : l'écran suit l'animateur. Pour piloter, ouvrez la projection depuis l'appareil qui a créé la salle."}</p>
    </div>`;
    R.montrer("projection");
    $("#pj-qr").innerHTML = QR.svg(lienSalle(code), `QR code pour rejoindre la salle ${code}`);
    if (!cle) $("#pj-pilote").hidden = true, $("#pj-clore").hidden = true;
    $("#pj-prec").onclick = () => piloter("precedent");
    $("#pj-suiv").onclick = () => piloter("suivant");
    $("#pj-reveler").onclick = () => piloter(pj.etat?.revele ? "masquer" : "reveler");
    $("#pj-clore").onclick = () => piloter(pj.etat?.etat === "close" ? "rouvrir" : "clore");
    $("#pj-plein").onclick = pleinEcran;
    $("#pj-chrono").onclick = basculerChrono;
    $("#pj-raz").onclick = () => { pj.chrono.reste = pj.chrono.duree; arreterChrono(); };
    vueProjection.querySelectorAll("[data-duree]").forEach((b) => b.onclick = () => { pj.chrono.duree = pj.chrono.reste = +b.dataset.duree; arreterChrono(); });
    $("#pj-relance").onclick = (e) => { if (e.target.closest("#pj-autre")) { pj.relance++; dessinerRelance(); } };
    actualiser();
    sonder(actualiser, 2500);
  }
  async function actualiser() {
    if (!pj) return;
    const r = await R.api("seance", undefined, "&code=" + pj.code);
    if (!r || r.statut !== 200) {
      $("#pj-scene").innerHTML = `<p class="sc-citation sc-l">${esc(r?.erreur ?? "Le site ne répond pas. La projection reprendra d'elle-même.")}</p>`;
      if (r?.statut === 404) arreterSondage();
      return;
    }
    const change = !pj.etat || r.rang !== pj.etat.rang || r.revele !== pj.etat.revele || r.etat !== pj.etat.etat;
    pj.items = r.items; pj.etat = r;
    dessinerDirect();
    if (change) dessinerProjection();
  }
  function dessinerDirect() {
    const e = pj.etat;
    const vote = e.item && typeItem(e.item) === "prop" ? ` · ${R.pluriel(e.votes_item, "vote")} sur cette proposition` : "";
    $("#pj-direct").textContent = `${R.pluriel(e.participants, "participant")}${vote}`;
  }
  function dessinerProjection() {
    const e = pj.etat;
    $("#pj-titre").textContent = e.titre || NOM_SEANCE[e.seance] || "Séance";
    $("#pj-compteur").textContent = e.rang >= 0 ? `${e.rang + 1} / ${e.total}` : "";
    const sc = $("#pj-scene");
    $("#pj").dataset.phase = e.etat === "close" ? "fin" : e.rang < 0 ? "accueil" : "item";
    if (e.etat === "close") {
      sc.innerHTML = `<p class="sc-citation sc-l">Merci ! La séance est terminée.</p><p class="sc-def">Les votes sont clos. Regardons ensemble où la salle s'accorde et où elle se divise.</p>
        <div class="choix"><a class="btn principal" href="#groupes/resultats/${pj.code}">Voir les résultats de la salle</a><a class="btn" href="#groupes/retour/${pj.code}">Retour d'expérience (animateur)</a></div>`;
    } else if (e.rang < 0) {
      sc.innerHTML = `<p class="sc-bienvenue">Bienvenue</p><p class="sc-def">Sortez votre téléphone, scannez le QR code ou tapez l'adresse, puis entrez le code <strong class="gr-code-txt">${esc(pj.code)}</strong>. Vos votes sont anonymes.</p>
        ${pj.cle ? `<p class="ref">Quand la salle est prête, appuyez sur « Suivant » ou sur la flèche droite.</p>` : ""}`;
    } else sc.innerHTML = sceneItem(e.item, e.revele, { projection: true });
    const prop = e.item && typeItem(e.item) === "prop";
    $("#pj-reveler").textContent = e.revele ? "Masquer" : prop ? "Révéler l'auteur" : "Révéler";
    $("#pj-reveler").disabled = e.rang < 0 || e.etat === "close";
    $("#pj-prec").disabled = e.rang < 0;
    $("#pj-suiv").disabled = e.rang >= e.total - 1 || e.etat === "close";
    $("#pj-clore").textContent = e.etat === "close" ? "Rouvrir la salle" : "Clore la salle";
    dessinerRelance();
  }
  function dessinerRelance() {
    const e = pj.etat, q = SEANCES[e.seance]?.relance || RELANCE_LIBRE;
    $("#pj-relance").innerHTML = e.rang >= 0 && e.etat !== "close" ? `<span class="mini-titre">Question de relance</span><span>${esc(q[pj.relance % q.length])}</span><button class="btn mini" id="pj-autre">Autre question</button>` : "";
  }
  async function piloter(action) {
    if (!pj?.cle) return;
    const r = await R.api("seance-piloter", { code: pj.code, cle: pj.cle, action });
    if (r?.statut === 200) { pj.etat = { ...pj.etat, ...r }; pj.relance = 0; dessinerDirect(); dessinerProjection(); }
    else $("#pj-direct").textContent = r?.erreur ?? "Le site ne répond pas.";
  }
  function pleinEcran() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else $("#pj").requestFullscreen?.().catch(() => {});
  }
  function basculerChrono() { pj.chrono.marche ? arreterChrono() : lancerChrono(); }
  function lancerChrono() {
    const c = pj.chrono; if (c.reste <= 0) c.reste = c.duree;
    c.marche = true; $("#pj-chrono").textContent = "Pause";
    clearInterval(c.t);
    c.t = setInterval(() => { c.reste--; afficherChrono(); if (c.reste <= 0) { arreterChrono(); $("#pj-temps").textContent = "Temps écoulé"; } }, 1000);
    afficherChrono();
  }
  function arreterChrono() { const c = pj.chrono; clearInterval(c.t); c.marche = false; $("#pj-chrono").textContent = "Démarrer"; afficherChrono(); }
  function afficherChrono() { const t = $("#pj-temps"); t.textContent = minutes(Math.max(0, pj.chrono.reste)); t.classList.toggle("fini", pj.chrono.reste <= 0); }
  document.addEventListener("keydown", (e) => {
    if (R.vueCourante !== "projection" || !pj || e.target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (["ArrowRight", "PageDown"].includes(k)) { e.preventDefault(); piloter("suivant"); }
    else if (["ArrowLeft", "PageUp"].includes(k)) { e.preventDefault(); piloter("precedent"); }
    else if (k === "r" || k === "R") piloter(pj.etat?.revele ? "masquer" : "reveler");
    else if (k === "f" || k === "F") pleinEcran();
    else if (k === "t" || k === "T") basculerChrono();
  });
  R.on("vue", (id) => { if (id !== "projection" && pj) { clearInterval(pj.chrono.t); pj = null; } });

  // ---------------------------------------------------------------------------------------
  // Salle des participants : page pensée pour le téléphone (#s/<code>)
  const vueSalle = $("#salle");
  let sl = null;
  function vueParticipant(code) {
    R.montrer("salle");
    // Le choix de mémoire du site peut attendre la fin de la séance : il ne doit pas masquer les boutons de vote.
    const vp = $("#choix-vie-privee"); if (vp) vp.hidden = true;
    if (!code) {
      vueSalle.innerHTML = `<div class="salle"><h2>Rejoindre une séance</h2><form class="carte" id="sl-form"><label for="sl-code">Code affiché par l'animateur (cinq caractères)</label>
        <input class="champ gr-code" id="sl-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE"><button class="btn principal" type="submit">Continuer</button></form></div>`;
      $("#sl-form").onsubmit = (e) => { e.preventDefault(); const c = $("#sl-code").value.trim().toUpperCase(); if (c.length === 5) R.aller("s/" + c); };
      $("#sl-code").focus();
      return;
    }
    sl = { code, etat: null, envoi: false };
    vueSalle.innerHTML = `<div class="salle"><p class="mini-titre">Salle <span class="gr-code-txt">${esc(code)}</span></p><div id="sl-corps" aria-live="polite"><p class="vide">Connexion à la salle…</p></div></div>`;
    if (!R.enLigne) { $("#sl-corps").innerHTML = horsLigne; return; }
    rafraichirSalle();
    sonder(rafraichirSalle, 3000);
  }
  async function rafraichirSalle() {
    if (!sl) return;
    const r = await R.api("seance", undefined, "&code=" + sl.code);
    if (!r || r.statut !== 200) {
      $("#sl-corps").innerHTML = `<div class="carte"><p>${esc(r?.erreur ?? "Le site ne répond pas. La page réessaie toute seule.")}</p><p><a href="#s">Saisir un autre code</a></p></div>`;
      if (r?.statut === 404 || r?.statut === 400) arreterSondage();
      return;
    }
    const avant = sl.etat; sl.etat = r;
    if (!avant || avant.rang !== r.rang || avant.revele !== r.revele || avant.etat !== r.etat || avant.present !== r.present || avant.mon_vote !== r.mon_vote) dessinerSalle();
  }
  function dessinerSalle() {
    const e = sl.etat, corps = $("#sl-corps");
    const titre = e.titre ? `<h2 class="sl-titre">${esc(e.titre)}</h2>` : `<h2 class="sl-titre">${esc(NOM_SEANCE[e.seance] || "Séance")}</h2>`;
    if (!e.present && e.etat !== "close") {
      corps.innerHTML = `${titre}<div class="carte sl-rejoindre"><p>Vous allez voter pour, partagé ou contre sur des propositions présentées sans leur auteur.</p>
        <p class="sl-info">Vos votes sont anonymes et restent dans cette salle.</p>
        <label class="consent"><input type="checkbox" id="sl-carte"> Ajouter aussi mes votes, anonymes, à la carte nationale des consensus. Vous pourrez changer d'avis pendant la séance.</label>
        <button class="btn principal sl-gros" id="sl-rejoindre">Rejoindre la salle</button>
        <p class="ref">Rejoindre dépose un identifiant aléatoire sur cet appareil, sans lien avec votre identité. La salle et ses votes sont effacés après 30 jours.</p></div>`;
      $("#sl-rejoindre").onclick = async () => {
        $("#sl-rejoindre").disabled = true;
        const r = await R.api("seance-rejoindre", { code: sl.code, carte: $("#sl-carte").checked });
        if (r?.ok) { sl.etat = { ...sl.etat, ...r, present: true }; dessinerSalle(); }
        else { $("#sl-rejoindre").disabled = false; corps.insertAdjacentHTML("beforeend", `<p class="ref">${esc(r?.erreur ?? "Le site ne répond pas. Réessayez.")}</p>`); }
      };
      return;
    }
    if (e.etat === "close") {
      corps.innerHTML = `${titre}<div class="carte"><p class="sl-gros-texte">La séance est terminée. Merci !</p><p>Vous pouvez voir les résultats de la salle, et continuer à jouer à l'aveugle sur le site.</p>
        <div class="choix"><a class="btn principal" href="#groupes/resultats/${sl.code}">Résultats de la salle</a><a class="btn" href="#jouer/aveugle">Jouer à l'aveugle</a></div></div>`;
      return;
    }
    if (e.rang < 0) { corps.innerHTML = `${titre}<div class="carte"><p class="sl-gros-texte">Vous avez rejoint la salle.</p><p>La séance va commencer. Gardez cette page ouverte : elle suit l'écran de l'animateur.</p></div>`; return; }
    const prop = typeItem(e.item) === "prop";
    const libelles = { pour: "Pour", partage: "Partagé", contre: "Contre" };
    corps.innerHTML = `${titre}<p class="compteur">Élément ${e.rang + 1} sur ${e.total}</p><div class="scene sl-scene">${sceneItem(e.item, e.revele)}
      ${prop ? `<div class="sl-votes" role="group" aria-label="Votre vote">${Object.entries(libelles).map(([k, n]) => `<button class="btn ${k} sl-vote" data-vote="${k}" aria-pressed="${e.mon_vote === k}">${n}</button>`).join("")}</div>
        <p class="ref" id="sl-statut" role="status">${e.mon_vote ? `Vote enregistré : ${libelles[e.mon_vote].toLowerCase()}. Vous pouvez le changer.` : "Vous pouvez aussi ne pas voter."}</p>`
        : `<p class="ref">Pas de vote sur cet élément : lisez, écoutez, discutez.</p>`}</div>
      <label class="consent sl-carte"><input type="checkbox" id="sl-carte" ${e.carte ? "checked" : ""}> Ajouter aussi mes votes, anonymes, à la carte nationale des consensus</label>`;
    // Cocher ou décocher prend effet tout de suite ; décocher retire de la carte nationale les votes de cette salle.
    $("#sl-carte").onchange = async (ev) => {
      const r = await R.api("seance-rejoindre", { code: sl.code, carte: ev.target.checked });
      if (r?.ok) sl.etat.carte = ev.target.checked; else ev.target.checked = !ev.target.checked;
    };
    corps.querySelectorAll("[data-vote]").forEach((b) => b.onclick = async () => {
      const r = await R.api("seance-vote", { code: sl.code, proposition: e.item, valeur: b.dataset.vote, carte: !!e.carte });
      if (r?.ok) { sl.etat.mon_vote = b.dataset.vote; dessinerSalle(); }
      else { $("#sl-statut").textContent = r?.erreur ?? "Le site ne répond pas. Réessayez."; if (r?.statut === 409) rafraichirSalle(); }
    });
  }
  R.on("vue", (id) => { if (id !== "salle") sl = null; });

  // ---------------------------------------------------------------------------------------
  // Résultats de salle : un histogramme par proposition, puis la carte des consensus.
  async function vueResultats(code) {
    page("groupes/composer", `<div class="titre-section"><h2>Résultats de la salle <span class="gr-code-txt">${esc(code)}</span></h2><span class="choix pas-imprimer"><button class="btn" data-imprimer>Imprimer</button></span></div><div id="rs-corps"><p class="vide">Chargement…</p></div>`);
    const r = R.enLigne ? await R.api("seance-resultats", undefined, "&code=" + code) : null;
    const corps = $("#rs-corps");
    if (!corps) return;
    if (!r || r.statut !== 200) { corps.innerHTML = r ? `<p class="vide">${esc(r.erreur)}</p>` : horsLigne; return; }
    const props = r.items.filter((i) => typeItem(i) === "prop" && R.parId[i]);
    const ligne = (id) => {
      const d = r.decompte[id] || { pour: 0, partage: 0, contre: 0 }, n = d.pour + d.partage + d.contre, p = R.parId[id];
      const pc = (x) => (n ? Math.round((x / n) * 100) : 0);
      return `<div class="rs-ligne"><p class="rs-citation">« ${esc(p.citation)} »</p>
        <div class="empile" role="img" aria-label="${d.pour} pour, ${d.partage} partagé, ${d.contre} contre"><i style="width:${pc(d.pour)}%;background:var(--pour)"></i><i style="width:${pc(d.partage)}%;background:var(--partage)"></i><i style="width:${pc(d.contre)}%;background:var(--contre)"></i></div>
        <p class="ref">${n ? `${d.pour} pour (${pc(d.pour)} %) · ${d.partage} partagé (${pc(d.partage)} %) · ${d.contre} contre (${pc(d.contre)} %)` : "Pas encore de vote"} · ${sigle(p.candidature)} <a href="#prop-${p.id}">source</a></p></div>`;
    };
    const votants = r.votants.map((v, i) => ({ id: v.moi ? "moi" : "v" + i, votes: v.votes }));
    const items = props.filter((id) => r.decompte[id]);
    corps.innerHTML = `
      <p class="avert"><strong>Un vote de salle n'est pas un sondage.</strong> Il dit ce que pensaient les ${R.pluriel(votants.length, "personne")} qui ont voté, ce jour-là, sur ces textes-là. Les résultats se lisent proposition par proposition, jamais par parti.</p>
      ${r.titre ? `<p class="aide">${esc(r.titre)} · ${esc(NOM_SEANCE[r.seance] || "")}${r.etat === "close" ? " · votes clos" : " · votes en cours"}</p>` : ""}
      <div class="legende"><span><b style="background:var(--pour)"></b>Pour</span><span><b style="background:var(--partage)"></b>Partagé</span><span><b style="background:var(--contre)"></b>Contre</span></div>
      <div class="rs-liste">${props.length ? props.map(ligne).join("") : `<p class="vide">Cette séance ne comportait pas de proposition à voter.</p>`}</div>
      <h2>La carte de la salle</h2>
      <p class="aide">Les votants sont regroupés selon leurs votes, sans nom. Une idée rassemble quand chaque groupe l'approuve, pas seulement le plus nombreux.</p>
      <div id="rs-carte"></div>
      <p class="aide">Ces votes comptent aussi, sans nom ni salle, dans la <a href="#consensus">carte des consensus de tout le site</a>.</p>
      <p class="ref">La salle et ses votes sont effacés le ${new Date(r.expire_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</p>
      ${mesSalles()[code] ? `<p class="pas-imprimer"><a class="lien-partage" href="#groupes/projeter/${esc(code)}">Revenir à la projection</a> · <a class="lien-partage" href="#groupes/retour/${esc(code)}">Retour d'expérience</a></p>` : ""}`;
    if (votants.length >= 3 && items.length >= 2 && R.consensus?.carte) R.consensus.carte($("#rs-carte"), votants, items);
    else $("#rs-carte").innerHTML = `<p class="vide">La carte apparaît à partir de trois votants et de deux propositions votées.</p>`;
  }

  // ---------------------------------------------------------------------------------------
  // Réseau d'animateurs
  const optionsPublic = (vide = true) => `${vide ? `<option value="">Choisir…</option>` : ""}${Object.entries(NOM_PUBLIC).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}`;
  function vueAnimer(etat) {
    const message = { confirme: "Inscription confirmée. Vous recevrez les nouvelles séances.", expire: "Ce lien a expiré ou a déjà servi.", desinscrit: "Vous êtes désinscrit. Nous ne vous écrirons plus." }[etat];
    page("groupes/animer", `
      <h2>Devenir animateur</h2>
      <p class="aide">Animer une séance ne demande ni compétence politique ni matériel particulier : un écran, une connexion, et l'envie de faire parler les gens à partir des textes. Le réseau relie celles et ceux qui le font, pour partager ce qui marche.</p>
      ${message ? `<p class="avert" role="status"><strong>${esc(message)}</strong></p>` : ""}
      ${R.enLigne ? "" : horsLigne}
      <div class="partis">
        <article class="carte"><h3>1. Prendre le kit</h3><p>Quatre séances minutées, la charte, la fiche de préparation et les cartes à imprimer.</p>
          <div class="choix"><a class="btn principal" href="#groupes/kit">Lire le kit</a><a class="btn" href="#groupes/kit/imprimer">Imprimer</a><button class="btn" data-telecharger-kit>Télécharger</button></div></article>
        <form class="carte" id="an-inscription" novalidate><h3>2. Recevoir les nouvelles séances</h3>
          <label class="ref" for="an-email">Adresse e-mail</label><input class="champ" type="email" id="an-email" autocomplete="email" required>
          <label class="ref" for="an-public">Votre public</label><select class="champ" id="an-public" required>${optionsPublic()}</select>
          <label class="ref" for="an-commune">Commune (facultatif)</label><input class="champ" id="an-commune" maxlength="120" autocomplete="address-level2">
          <p class="ref">Votre adresse sert seulement à vous envoyer les nouvelles séances, quelques fois par an. Un e-mail de confirmation part d'abord ; chaque message contient un lien de désinscription.</p>
          <button class="btn principal" type="submit">M'inscrire</button><p class="ref" role="status" id="an-etat"></p></form>
      </div>
      <form class="carte" id="an-declarer" novalidate><h3>3. Déclarer votre séance</h3>
        <p>Elle apparaîtra sur la <a href="#groupes/carte">carte des séances</a> après relecture par l'équipe. Nous publions seulement la date, la commune, le public, la séance choisie et, si vous le souhaitez, le nom de la structure. Jamais d'adresse précise ni de nom de personne.</p>
        <div class="an-grille">
          <label><span class="ref">Date</span><input class="champ" type="date" id="dc-date" required min="2026-01-01" max="2028-12-31"></label>
          <fieldset class="an-mode"><legend class="ref">Où ?</legend><label class="puce"><input type="radio" name="dc-mode" value="salle" checked> En salle</label><label class="puce"><input type="radio" name="dc-mode" value="ligne"> En ligne</label></fieldset>
          <label class="dc-salle"><span class="ref">Commune (seulement son nom)</span><input class="champ" id="dc-commune" maxlength="120"></label>
          <label class="dc-salle"><span class="ref">Département</span><select class="champ" id="dc-dep"><option value="">Choisir…</option>${DEPARTEMENTS.map(([c, n]) => `<option value="${c}">${c} ${esc(n)}</option>`).join("")}</select></label>
          <label><span class="ref">Public</span><select class="champ" id="dc-public">${optionsPublic()}</select></label>
          <label><span class="ref">Séance</span><select class="champ" id="dc-seance"><option value="">Choisir…</option>${Object.entries(NOM_SEANCE).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("")}</select></label>
          <label><span class="ref">Structure organisatrice (facultatif)</span><input class="champ" id="dc-orga" maxlength="120" placeholder="Médiathèque, association, lycée…"></label>
          <label><span class="ref">Lien d'inscription (facultatif)</span><input class="champ" type="url" id="dc-lien" maxlength="300" placeholder="https://…"></label>
          <label><span class="ref">Votre e-mail (jamais publié)</span><input class="champ" type="email" id="dc-email" autocomplete="email"></label>
        </div>
        <label class="consent"><input type="checkbox" id="dc-orga-public"> Afficher le nom de la structure sur la carte. Indiquez une structure, pas le nom d'une personne.</label>
        <p class="ref">Votre e-mail sert seulement à l'équipe de relecture, si une précision est nécessaire. Bientôt, les séances pourront aussi être publiées sur Mobilizon, un agenda libre.</p>
        <button class="btn principal" type="submit">Envoyer pour relecture</button><p class="ref" role="status" id="dc-etat"></p></form>
      <article class="carte"><h3>4. Après la séance : votre retour</h3><p>Cinq questions, deux minutes. Vos réponses ne sont lues que par l'équipe et servent à améliorer le kit.</p><p><a class="btn" href="#groupes/retour">Donner mon retour d'expérience</a></p></article>`);
    if (etat) history.replaceState(history.state, "", "#groupes/animer");
    const majMode = () => racine.querySelectorAll(".dc-salle").forEach((l) => { l.hidden = racine.querySelector('input[name="dc-mode"]:checked').value !== "salle"; });
    racine.querySelectorAll('input[name="dc-mode"]').forEach((r) => r.onchange = majMode); majMode();
    const envoyer = async (e, route, donnees, etat, ok) => {
      e.preventDefault();
      if (!R.enLigne) { $(etat).textContent = "L'envoi ouvrira avec le site."; return; }
      const r = await R.api(route, donnees);
      $(etat).textContent = r?.ok ? ok : r?.erreur ?? "Le site ne répond pas. Réessayez dans un instant.";
      if (r?.ok) e.target.reset?.(), majMode();
    };
    $("#an-inscription").onsubmit = (e) => envoyer(e, "animateur-inscription", { email: $("#an-email").value, public: $("#an-public").value, commune: $("#an-commune").value }, "#an-etat", "Vérifiez votre boîte : un e-mail de confirmation vient de partir.");
    $("#an-declarer").onsubmit = (e) => envoyer(e, "seance-declarer", {
      date: $("#dc-date").value, mode: racine.querySelector('input[name="dc-mode"]:checked').value, commune: $("#dc-commune").value, departement: $("#dc-dep").value,
      public: $("#dc-public").value, seance: $("#dc-seance").value, organisateur: $("#dc-orga").value, organisateur_public: $("#dc-orga-public").checked, lien: $("#dc-lien").value, email: $("#dc-email").value,
    }, "#dc-etat", "Merci ! Votre séance sera relue avant d'apparaître sur la carte.");
  }

  // Carte des séances : contour embarqué, aucune requête vers un service de cartes.
  async function vueCarte() {
    page("groupes/carte", `<h2>La carte des séances</h2><p class="aide">Les séances déclarées par les animateurs et relues par l'équipe. Seules la commune et, si elle l'a souhaité, la structure organisatrice sont publiées.</p><div id="ct-corps"><p class="vide">Chargement…</p></div>`);
    const r = R.enLigne ? await R.api("seances-publiques") : null;
    const corps = $("#ct-corps"); if (!corps) return;
    if (!r?.seances) { corps.innerHTML = horsLigne; return; }
    const auj = r.aujourdhui, aVenir = r.seances.filter((s) => s.date >= auj), passees = r.seances.filter((s) => s.date < auj).reverse();
    const date = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    const ligne = (s) => `<li><span><strong>${esc(date(s.date))}</strong> · ${s.mode === "ligne" ? "en ligne" : esc(s.commune || "")} · ${esc(NOM_SEANCE[s.seance] || "")}</span>
      <span class="justif">${esc(NOM_PUBLIC[s.public] || "")}${s.organisateur ? " · " + esc(s.organisateur) : ""}</span>${s.lien ? `<a class="ref" href="${esc(s.lien)}" target="_blank" rel="noopener">S'inscrire</a>` : ""}</li>`;
    const parRegion = (liste) => {
      const g = {};
      liste.forEach((s) => (g[s.mode === "ligne" ? "En ligne" : s.region || "Région non précisée"] ??= []).push(s));
      return Object.keys(g).sort((a, b) => (a === "En ligne") - (b === "En ligne") || a.localeCompare(b, "fr")).map((k) => `<h3 class="mini-titre">${esc(k)} · ${g[k].length}</h3><ul class="docs">${g[k].map(ligne).join("")}</ul>`).join("");
    };
    // Points : une pastille par commune, plus grosse quand plusieurs séances y ont lieu.
    const points = {};
    r.seances.filter((s) => s.lat != null && s.lat > 41 && s.lat < 52 && s.lon > -6 && s.lon < 10).forEach((s) => {
      const k = s.commune + s.departement; (points[k] ??= { s, n: 0, venir: 0 }).n++; if (s.date >= auj) points[k].venir++;
    });
    const pastilles = Object.values(points).map(({ s, n, venir }) => {
      const [x, y] = projeter(s.lat, s.lon);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(6 + Math.sqrt(n) * 3).toFixed(1)}" class="${venir ? "ct-venir" : "ct-passe"}"><title>${esc(s.commune)} : ${R.pluriel(n, "séance")}</title></circle>`;
    }).join("");
    const outre = r.seances.filter((s) => s.mode === "salle" && !(s.lat > 41 && s.lat < 52 && s.lon > -6 && s.lon < 10)).length;
    const enLigne = r.seances.filter((s) => s.mode === "ligne").length;
    corps.innerHTML = r.seances.length ? `<div class="ct-grille">
        <figure class="nuage ct-carte"><svg viewBox="0 0 628 600" role="img" aria-label="Carte de France : ${R.pluriel(r.seances.length, "séance")} publiées. La liste qui suit donne le détail."><path d="${CONTOUR}" class="ct-france"/>${pastilles}</svg>
          <figcaption class="legende"><span><b class="ct-venir"></b>À venir</span><span><b class="ct-passe"></b>Passées</span>${enLigne ? `<span>En ligne : ${enLigne}</span>` : ""}${outre ? `<span>Outre-mer : ${outre}</span>` : ""}</figcaption></figure>
        <div><h2>À venir</h2>${aVenir.length ? parRegion(aVenir) : `<p class="vide">Aucune séance annoncée pour l'instant.</p>`}
          <h2>Passées</h2>${passees.length ? parRegion(passees) : `<p class="vide">Pas encore de séance passée.</p>`}</div></div>`
      : `<div class="carte"><p>Aucune séance publiée pour l'instant. Organisez la première près de chez vous : le kit est prêt.</p><p class="choix"><a class="btn principal" href="#groupes/animer">Déclarer une séance</a><a class="btn" href="#groupes/kit">Lire le kit</a></p></div>`;
    corps.insertAdjacentHTML("beforeend", `<p class="choix"><a class="btn" href="#groupes/animer">Déclarer votre séance</a></p>`);
  }

  // Retour d'expérience en cinq questions
  function vueRetour(code) {
    const s = code && mesSalles()[code];
    page("groupes/animer", `<h2>Retour d'expérience</h2>
      <p class="aide">Cinq questions pour améliorer le kit. Vos réponses ne sont lues que par l'équipe de relecture et ne sont jamais publiées. Ne mentionnez le nom d'aucun participant.</p>
      <form class="carte gr-retour" id="rt-form" novalidate>
        <label><span class="ref">Séance animée</span><select class="champ" id="rt-seance">${Object.entries(NOM_SEANCE).map(([k, n]) => `<option value="${k}"${s?.seance === k ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        ${QUESTIONS_RETOUR.map(([k, q, aide], i) => `<label><span class="rt-q">${i + 1}. ${esc(q)}</span>${aide ? `<span class="ref">${esc(aide)}</span>` : ""}<textarea id="rt-${k}" rows="3" maxlength="1500"></textarea></label>`).join("")}
        <button class="btn principal" type="submit">Envoyer mon retour</button><p class="ref" role="status" id="rt-etat"></p>
      </form>`);
    $("#rt-form").onsubmit = async (e) => {
      e.preventDefault();
      if (!R.enLigne) { $("#rt-etat").textContent = "L'envoi ouvrira avec le site."; return; }
      const reponses = Object.fromEntries(QUESTIONS_RETOUR.map(([k]) => [k, $("#rt-" + k).value]));
      const r = await R.api("retour-seance", { seance: $("#rt-seance").value, code: code || "", reponses });
      $("#rt-etat").textContent = r?.ok ? "Merci ! Votre retour a bien été transmis." : r?.erreur ?? "Le site ne répond pas. Réessayez dans un instant.";
      if (r?.ok) e.target.reset();
    };
  }

  // Modération : séances déclarées et retours d'expérience (comptes modérateurs seulement)
  async function vueModeration() {
    page("groupes/animer", `<h2>Modération des séances</h2><div id="md-corps"><p class="vide">Chargement…</p></div>`);
    const r = R.enLigne ? await R.api("moderation-groupes") : null;
    const corps = $("#md-corps"); if (!corps) return;
    if (!r || r.statut !== 200) {
      corps.innerHTML = r?.statut === 401 ? `<p>Connectez-vous d'abord avec votre adresse de modération, depuis la page <a href="#rejoindre">Participer</a>, puis revenez ici.</p>`
        : r?.statut === 403 ? `<p>Cette page est réservée à l'équipe de modération.</p>` : horsLigne;
      return;
    }
    const statut = { attente: "En attente", publiee: "Publiée", refusee: "Refusée" };
    const carte = (s) => `<article class="carte md-seance" data-statut="${esc(s.statut)}"><h3>${esc(s.date_seance)} · ${s.mode === "ligne" ? "en ligne" : `${esc(s.commune)} (${esc(s.departement)}, ${esc(s.region)})`}</h3>
      <p>${esc(NOM_SEANCE[s.seance] || s.seance)} · ${esc(NOM_PUBLIC[s.public_vise] || s.public_vise)}</p>
      <p class="ref">Structure : ${esc(s.organisateur || "non indiquée")}${s.organisateur ? (+s.organisateur_public ? " (publique)" : " (non publiée)") : ""} · Lien : ${s.lien ? `<a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.lien)}</a>` : "aucun"} · Contact : ${esc(s.email)}</p>
      <p class="ref">Statut : <strong>${statut[s.statut] || esc(s.statut)}</strong> · déclarée le ${esc(s.cree_le.slice(0, 10))}${s.lat == null && s.mode === "salle" ? " · commune non localisée" : ""}</p>
      <div class="choix">${s.statut !== "publiee" ? `<button class="btn juste" data-md="${esc(s.id)}" data-decision="publier">Publier</button>` : ""}${s.statut !== "refusee" ? `<button class="btn" data-md="${esc(s.id)}" data-decision="refuser">${s.statut === "publiee" ? "Retirer" : "Refuser"}</button>` : ""}</div></article>`;
    const attente = r.seances.filter((s) => s.statut === "attente"), autres = r.seances.filter((s) => s.statut !== "attente");
    corps.innerHTML = `<p class="aide">Vérifiez qu'aucune séance ne publie d'adresse précise ni de nom de personne, et que la structure est bien une structure. ${R.pluriel(r.animateurs, "animateur inscrit", "animateurs inscrits")}.</p>
      <h3 class="mini-titre">À relire · ${attente.length}</h3><div class="partis">${attente.map(carte).join("") || `<p class="vide">Rien à relire.</p>`}</div>
      <h3 class="mini-titre">Déjà relues · ${autres.length}</h3><div class="partis">${autres.map(carte).join("") || `<p class="vide">Aucune.</p>`}</div>
      <h2>Retours d'expérience · ${r.retours.length}</h2>
      <div class="partis">${r.retours.map((t) => `<article class="carte"><h3>${esc(NOM_SEANCE[t.seance] || t.seance)}${t.code ? ` · salle ${esc(t.code)}` : ""}</h3><p class="ref">${esc(t.cree_le.slice(0, 10))}</p>
        ${QUESTIONS_RETOUR.filter(([k]) => t.reponses?.[k]).map(([k, q]) => `<p><span class="mini-titre">${esc(q)}</span><br>${esc(t.reponses[k])}</p>`).join("")}</article>`).join("") || `<p class="vide">Aucun retour pour l'instant.</p>`}</div>`;
    corps.onclick = async (e) => {
      const b = e.target.closest("[data-md]"); if (!b) return;
      b.disabled = true;
      const x = await R.api("moderation-groupes", { id: b.dataset.md, decision: b.dataset.decision });
      if (x?.ok) vueModeration(); else { b.disabled = false; alert(x?.erreur ?? "Le site ne répond pas."); }
    };
  }

  // ---------------------------------------------------------------------------------------
  // Adresses
  const CODE = "([A-HJ-NP-Za-hj-np-z2-9]{5})";
  R.route("groupes", vueAccueil);
  R.route(/^groupes\/composer(?:\/([a-z]+)(?:\/(.+))?)?$/, (m) => { if (m[1] && !NOM_SEANCE[m[1]]) return false; vueComposer(m[1], m[2]); });
  R.route(/^groupes\/kit(?:\/([a-z]+))?$/, (m) => vueKit(m[1]));
  R.route(new RegExp(`^groupes/projeter/${CODE}$`), (m) => vueProjeter(m[1].toUpperCase()));
  R.route(new RegExp(`^groupes/resultats/${CODE}$`), (m) => { vueResultats(m[1].toUpperCase()); });
  R.route(/^groupes\/animer(?:\/(confirme|expire|desinscrit))?$/, (m) => vueAnimer(m[1]));
  R.route("groupes/carte", () => { vueCarte(); });
  R.route(new RegExp(`^groupes/retour(?:/${CODE})?$`), (m) => vueRetour(m[1]?.toUpperCase()));
  R.route("groupes/moderation", () => { vueModeration(); });
  R.route(new RegExp(`^s(?:/${CODE}?)?$`), (m) => vueParticipant(m[1]?.toUpperCase()));
});
