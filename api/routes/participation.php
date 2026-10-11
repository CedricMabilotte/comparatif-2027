<?php
// Participation encadrée : questions sous les concepts, signalements d'erreurs et journal public
// des corrections, mots proposés, lettre avec choix de la fréquence, cercles, file de modération.
// Toute écriture est limitée en débit ; rien n'est publié sans relecture ; aucune adresse n'est renvoyée
// publiquement.
declare(strict_types=1);

const PA_NATURES = ['citation', 'classement', 'definition', 'neutralite', 'autre'];
const PA_CERCLES = ['lexique', 'verification', 'locaux'];
// Actions de modération permises pour chaque sorte de contribution, et l'état qu'elles donnent.
const PA_ACTIONS = [
    'reponse' => ['publier' => 'publie', 'refuser' => 'refuse'],
    'signalement' => ['corrige' => 'corrige', 'non_retenu' => 'non_retenu'],
    'suggestion' => ['redaction' => 'redaction', 'ajoute' => 'ajoute', 'refuser' => 'refuse'],
];

// Texte saisi : chaîne nettoyée, longueur bornée, obligatoire ou non.
function pa_texte(array $d, string $cle, int $max, bool $requis, string $nom): ?string {
    $t = is_string($d[$cle] ?? null) ? trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $d[$cle]) ?? '') : '';
    if ($t === '') { if ($requis) erreur(400, "$nom : ce champ est nécessaire."); return null; }
    if (mb_strlen($t) > $max) erreur(400, "$nom : $max caractères au plus.");
    return $t;
}
function pa_cible(mixed $c): string {
    if (!is_string($c) || !preg_match('/^(notion|terme|prop|parti):[a-z0-9-]{1,80}$/', $c)) erreur(400, 'Fiche inconnue.');
    return $c;
}
function pa_pseudo(array $d): ?string {
    $p = pa_texte($d, 'pseudo', 40, false, 'Pseudonyme');
    if ($p !== null && !preg_match('/^[\p{L}\p{N} ._\'-]{2,40}$/u', $p)) erreur(400, 'Pseudonyme : 2 à 40 lettres, chiffres, espaces, points ou tirets.');
    return $p;
}
function pa_email(array $d): ?string {
    $e = is_string($d['email'] ?? null) ? trim($d['email']) : '';
    return $e === '' ? null : email_valide($e);
}
// Champ piège invisible (« site ») ou envoi en moins de deux secondes : on répond comme si tout allait
// bien, sans rien enregistrer, pour ne pas renseigner les robots.
function pa_robot(array $d): bool {
    return trim((string) ($d['site'] ?? '')) !== '' || (is_int($d['duree'] ?? null) && $d['duree'] < 2000);
}
function pa_enregistrer(PDO $db, array $champs): void {
    $champs += ['id' => uuid(), 'etat' => 'attente', 'cree_le' => maintenant()];
    $c = compte_courant($db);
    if ($c) $champs['compte_id'] = $c['id'];
    $cles = array_keys($champs);
    $db->prepare('INSERT INTO contributions (' . implode(', ', $cles) . ') VALUES (' . implode(', ', array_fill(0, count($cles), '?')) . ')')
       ->execute(array_values($champs));
}

return [
    // Une réponse à « Qu'est-ce qui vous manque pour comprendre ce concept ? »
    'POST reponse' => function (PDO $db, array $config): void {
        $d = corps();
        $cible = pa_cible($d['cible'] ?? null);
        $texte = pa_texte($d, 'texte', 1000, true, 'Réponse');
        $pseudo = pa_pseudo($d);
        limiter($db, $config, 'contribution', 10);
        if (!pa_robot($d)) pa_enregistrer($db, ['genre' => 'reponse', 'cible' => $cible, 'texte' => $texte, 'pseudo' => $pseudo]);
        repondre(200, ['ok' => true]);
    },

    // Réponses publiées sous une fiche, avec la réponse de la modération.
    'GET reponses' => function (PDO $db, array $config): void {
        $cible = pa_cible($_GET['cible'] ?? null);
        $q = $db->prepare("SELECT pseudo, texte, reponse, traite_le AS le FROM contributions WHERE genre = 'reponse' AND etat = 'publie' AND cible = ? ORDER BY traite_le DESC LIMIT 50");
        $q->execute([$cible]);
        repondre(200, ['reponses' => $q->fetchAll()]);
    },

    'POST signalement' => function (PDO $db, array $config): void {
        $d = corps();
        $cible = pa_cible($d['cible'] ?? null);
        $nature = in_array($d['nature'] ?? null, PA_NATURES, true) ? $d['nature'] : erreur(400, 'Choisissez la nature de l\'erreur.');
        $texte = pa_texte($d, 'texte', 1000, true, 'Précision');
        $email = pa_email($d);
        limiter($db, $config, 'contribution', 10);
        if (!pa_robot($d)) pa_enregistrer($db, ['genre' => 'signalement', 'cible' => $cible, 'nature' => $nature, 'texte' => $texte, 'email' => $email]);
        repondre(200, ['ok' => true]);
    },

    // Journal public : chaque signalement traité, avec la note de la modération ; le texte du visiteur
    // n'est pas republié. Les compteurs disent aussi combien attendent encore.
    'GET corrections' => function (PDO $db, array $config): void {
        $l = $db->query("SELECT cible, nature, etat, reponse AS note, cree_le, traite_le FROM contributions WHERE genre = 'signalement' AND etat IN ('corrige', 'non_retenu') ORDER BY traite_le DESC LIMIT 300")->fetchAll();
        $n = $db->query("SELECT etat, COUNT(*) AS n FROM contributions WHERE genre = 'signalement' GROUP BY etat")->fetchAll(PDO::FETCH_KEY_PAIR);
        repondre(200, ['corrections' => $l, 'compte' => ['attente' => (int) ($n['attente'] ?? 0), 'corrige' => (int) ($n['corrige'] ?? 0), 'non_retenu' => (int) ($n['non_retenu'] ?? 0)]]);
    },

    'POST suggestion' => function (PDO $db, array $config): void {
        $d = corps();
        $terme = pa_texte($d, 'terme', 120, true, 'Terme');
        $texte = pa_texte($d, 'texte', 1000, true, 'Pourquoi il compte');
        $lieu = pa_texte($d, 'lieu', 300, false, 'Où on le rencontre');
        $pseudo = pa_pseudo($d);
        $email = pa_email($d);
        limiter($db, $config, 'contribution', 10);
        if (!pa_robot($d)) pa_enregistrer($db, ['genre' => 'suggestion', 'terme' => $terme, 'texte' => $texte, 'lieu' => $lieu, 'pseudo' => $pseudo, 'email' => $email]);
        repondre(200, ['ok' => true]);
    },

    // « Proposés par les visiteurs » : seulement les mots acceptés.
    'GET suggestions' => function (PDO $db, array $config): void {
        $l = $db->query("SELECT terme, pseudo, etat, reponse, traite_le AS le FROM contributions WHERE genre = 'suggestion' AND etat IN ('redaction', 'ajoute') ORDER BY traite_le DESC LIMIT 200")->fetchAll();
        repondre(200, ['suggestions' => $l]);
    },

    // La lettre, avec le choix de la fréquence. La confirmation passe par « GET confirmer » (routes de base).
    'POST lettre' => function (PDO $db, array $config): void {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        $frequence = in_array($d['frequence'] ?? null, ['jour', 'semaine'], true) ? $d['frequence'] : erreur(400, 'Choisissez une fréquence.');
        limiter($db, $config, 'abonnement', 5);
        $q = $db->prepare('SELECT confirme FROM abonnes WHERE email = ?');
        $q->execute([$email]);
        if ($q->fetchColumn() === false) $db->prepare('INSERT INTO abonnes (email, cree_le, frequence) VALUES (?, ?, ?)')->execute([$email, maintenant(), $frequence]);
        else $db->prepare('UPDATE abonnes SET frequence = ? WHERE email = ?')->execute([$frequence, $email]);
        $jeton = creer_jeton($db, 'abonnement', $email, 'P7D');
        $rythme = $frequence === 'jour' ? 'chaque matin' : 'chaque dimanche';
        envoyer($config, $email, 'Confirmez votre inscription', "Bonjour,\n\nVous avez demandé à recevoir un concept $rythme. Pour confirmer votre adresse, ouvrez ce lien :\n{$config['url_site']}/api/index.php?r=confirmer&jeton=$jeton\n\nSans confirmation, votre adresse sera effacée. Chaque lettre comporte un lien de désinscription.\n");
        repondre(200, ['ok' => true]);
    },

    // Commune en texte libre (sans code officiel) : la route « profil » l'efface, on l'écrit donc après.
    'POST profil-commune' => function (PDO $db, array $config): void {
        $c = compte_courant($db) ?? erreur(401, 'Connectez-vous d\'abord.');
        $d = corps();
        $nom = pa_texte($d, 'nom', 120, false, 'Commune');
        if ($nom !== null && !preg_match('/^[\p{L}\p{N} ()\'.-]{2,120}$/u', $nom)) erreur(400, 'Commune : lettres, chiffres, espaces, tirets ou parenthèses.');
        limiter($db, $config, 'profil', 30);
        if ($nom !== null || ($d['effacer'] ?? false) === true)
            $db->prepare('UPDATE comptes SET commune_nom = ?, commune_insee = NULL WHERE id = ?')->execute([$nom, $c['id']]);
        repondre(200, ['ok' => true]);
    },

    // Cercles : compte des personnes en attente (public) et ceux que j'ai rejoints.
    'GET cercles' => function (PDO $db, array $config): void {
        $n = $db->query('SELECT cercle, COUNT(*) AS n FROM cercles_interets GROUP BY cercle')->fetchAll(PDO::FETCH_KEY_PAIR);
        $miens = [];
        if ($c = compte_courant($db)) {
            $q = $db->prepare('SELECT cercle FROM cercles_interets WHERE compte_id = ?');
            $q->execute([$c['id']]);
            $miens = $q->fetchAll(PDO::FETCH_COLUMN);
        }
        repondre(200, ['compte' => array_map('intval', $n), 'miens' => $miens]);
    },

    'POST cercle' => function (PDO $db, array $config): void {
        $c = compte_courant($db) ?? erreur(401, 'Créez un compte ou connectez-vous d\'abord.');
        $d = corps();
        $cercle = in_array($d['cercle'] ?? null, PA_CERCLES, true) ? $d['cercle'] : erreur(400, 'Cercle inconnu.');
        limiter($db, $config, 'cercle', 30);
        $db->prepare('DELETE FROM cercles_interets WHERE compte_id = ? AND cercle = ?')->execute([$c['id'], $cercle]);
        if (($d['rejoindre'] ?? true) !== false) $db->prepare('INSERT INTO cercles_interets (compte_id, cercle, le) VALUES (?, ?, ?)')->execute([$c['id'], $cercle, maintenant()]);
        repondre(200, ['ok' => true]);
    },

    // Sans erreur pour un visiteur ordinaire : dit seulement si le compte connecté modère, et combien attendent.
    'GET moderation-acces' => function (PDO $db, array $config): void {
        $c = compte_courant($db);
        $email = null;
        if ($c) { $q = $db->prepare('SELECT email FROM comptes WHERE id = ?'); $q->execute([$c['id']]); $email = $q->fetchColumn(); }
        if (!$email || !in_array($email, $config['moderateurs'] ?? [], true)) repondre(200, ['moderateur' => false, 'connecte' => (bool) $c]);
        $n = $db->query("SELECT COUNT(*) FROM contributions WHERE etat = 'attente'")->fetchColumn();
        repondre(200, ['moderateur' => true, 'connecte' => true, 'attente' => (int) $n]);
    },

    // File de modération : tout ce qui attend, puis les 60 derniers éléments traités.
    'GET moderation' => function (PDO $db, array $config): void {
        moderateur($db, $config);
        $champs = 'id, genre, cible, nature, terme, texte, lieu, pseudo, email, etat, reponse, cree_le, traite_le';
        $attente = $db->query("SELECT $champs FROM contributions WHERE etat = 'attente' ORDER BY cree_le")->fetchAll();
        $traites = $db->query("SELECT $champs FROM contributions WHERE etat <> 'attente' ORDER BY traite_le DESC LIMIT 60")->fetchAll();
        repondre(200, ['attente' => $attente, 'traites' => $traites]);
    },

    // Publier, refuser, répondre ; clore un signalement avec une note publique ; faire avancer un mot proposé.
    // Le visiteur qui a laissé son adresse est prévenu, puis son adresse est effacée.
    'POST moderer' => function (PDO $db, array $config): void {
        moderateur($db, $config);
        $d = corps();
        limiter($db, $config, 'moderer', 600);
        $q = $db->prepare('SELECT * FROM contributions WHERE id = ?');
        $q->execute([(string) ($d['id'] ?? '')]);
        $c = $q->fetch() ?: erreur(404, 'Élément introuvable.');
        $etat = PA_ACTIONS[$c['genre']][$d['action'] ?? ''] ?? erreur(400, 'Action impossible pour cet élément.');
        $reponse = pa_texte($d, 'reponse', 2000, false, 'Réponse');
        if ($c['genre'] === 'signalement' && $reponse === null) erreur(400, 'Une note publique est nécessaire : elle figure dans le journal des corrections.');
        $db->prepare('UPDATE contributions SET etat = ?, reponse = ?, traite_le = ? WHERE id = ?')->execute([$etat, $reponse, maintenant(), $c['id']]);
        if ($c['email']) {
            $quoi = $c['genre'] === 'signalement'
                ? ($etat === 'corrige' ? 'L\'erreur que vous avez signalée a été corrigée.' : 'Votre signalement a été examiné ; la fiche n\'a pas été modifiée.')
                : ['redaction' => "Le mot « {$c['terme']} » que vous avez proposé est retenu : sa fiche est en rédaction.", 'ajoute' => "Le mot « {$c['terme']} » que vous avez proposé a maintenant sa fiche.", 'refuse' => "Le mot « {$c['terme']} » que vous avez proposé n'a pas été retenu."][$etat];
            $suite = $c['genre'] === 'signalement' ? "Le journal public des corrections : {$config['url_site']}/#corrections" : "Les mots proposés par les visiteurs : {$config['url_site']}/#rejoindre/proposer";
            envoyer($config, $c['email'], 'Votre contribution à République des mots', "Bonjour,\n\n$quoi\n" . ($reponse ? "\nNote de la modération : $reponse\n" : '') . "\n$suite\n\nMerci. Votre adresse vient d'être effacée de nos fichiers.\n");
            if ($etat !== 'redaction') $db->prepare('UPDATE contributions SET email = NULL WHERE id = ?')->execute([$c['id']]);
        }
        repondre(200, ['ok' => true, 'etat' => $etat]);
    },
];
