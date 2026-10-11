<?php
// Routes de base : votes à l'aveugle, lien magique, profil, lettre d'information.
declare(strict_types=1);

return [
    'POST vote' => function (PDO $db, array $config): void {
        $d = corps();
        $prop = is_string($d['proposition'] ?? null) && preg_match('/^p[0-9a-f]{3,12}$/', $d['proposition']) ? $d['proposition'] : erreur(400, 'Proposition inconnue.');
        $valeur = VALEURS[$d['valeur'] ?? ''] ?? erreur(400, 'Valeur attendue : pour, partage ou contre.');
        limiter($db, $config, 'vote', 300);
        $v = votant($db);
        $db->prepare('DELETE FROM votes WHERE votant_id = ? AND proposition_id = ?')->execute([$v, $prop]);
        $db->prepare('INSERT INTO votes (votant_id, proposition_id, valeur, le) VALUES (?, ?, ?, ?)')->execute([$v, $prop, $valeur, maintenant()]);
        repondre(200, ['ok' => true]);
    },

    // Matrice anonyme des votes pour la carte des consensus : identifiants remplacés par un rang,
    // votants avec moins de 3 votes écartés.
    'GET votes' => function (PDO $db, array $config): void {
        $lignes = $db->query('SELECT votant_id, proposition_id, valeur FROM votes ORDER BY votant_id')->fetchAll();
        $parVotant = [];
        foreach ($lignes as $l) $parVotant[$l['votant_id']][$l['proposition_id']] = (int) $l['valeur'];
        $mien = $_COOKIE['votant'] ?? '';
        $sortie = [];
        foreach ($parVotant as $id => $votes) {
            if (count($votes) < 3) continue;
            $sortie[] = ['moi' => $id === $mien, 'votes' => $votes];
        }
        shuffle($sortie);
        repondre(200, ['votants' => $sortie]);
    },

    'POST lien-magique' => function (PDO $db, array $config): void {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        if (($d['consentement'] ?? false) !== true) erreur(400, 'Le consentement est nécessaire pour créer un compte.');
        limiter($db, $config, 'lien', 5);
        $jeton = creer_jeton($db, 'connexion', $email, DUREE_JETON);
        $lien = $config['url_site'] . '/api/index.php?r=connexion&jeton=' . $jeton;
        envoyer($config, $email, 'Votre lien de connexion', "Bonjour,\n\nPour vous connecter à République des mots, ouvrez ce lien dans les 30 minutes :\n$lien\n\nSi vous n'avez rien demandé, ignorez ce message.\n");
        repondre(200, ['ok' => true]); // même réponse que l'adresse existe ou non
    },

    'GET connexion' => function (PDO $db, array $config): void {
        $email = consommer_jeton($db, 'connexion', (string) ($_GET['jeton'] ?? ''));
        if ($email === null) { header('Location: ' . $config['url_site'] . '/#connexion-expiree'); exit; }
        $q = $db->prepare('SELECT id FROM comptes WHERE email = ?');
        $q->execute([$email]);
        $id = $q->fetchColumn();
        if (!$id) {
            $id = uuid();
            $db->prepare('INSERT INTO comptes (id, email, consentement_le, cree_le) VALUES (?, ?, ?, ?)')->execute([$id, $email, maintenant(), maintenant()]);
        }
        $s = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $db->prepare('INSERT INTO sessions (empreinte, compte_id, expire_le) VALUES (?, ?, ?)')->execute([hash('sha256', $s), $id, maintenant(DUREE_SESSION)]);
        cookie('session', $s, DUREE_SESSION);
        $v = votant($db);
        $db->prepare('DELETE FROM liens_votants WHERE compte_id = ? AND votant_id = ?')->execute([$id, $v]);
        $db->prepare('INSERT INTO liens_votants (compte_id, votant_id) VALUES (?, ?)')->execute([$id, $v]);
        header('Location: ' . $config['url_site'] . '/#bienvenue');
        exit;
    },

    'GET moi' => function (PDO $db, array $config): void {
        $c = compte_courant($db);
        repondre(200, ['connecte' => (bool) $c, 'pseudo' => $c['pseudo'] ?? null, 'commune' => $c ? ['insee' => $c['commune_insee'], 'nom' => $c['commune_nom']] : null]);
    },

    'POST profil' => function (PDO $db, array $config): void {
        $c = compte_courant($db) ?? erreur(401, 'Connectez-vous d\'abord.');
        $d = corps();
        $pseudo = trim((string) ($d['pseudo'] ?? ''));
        if ($pseudo !== '' && !preg_match('/^[\p{L}\p{N} ._-]{2,40}$/u', $pseudo)) erreur(400, 'Pseudonyme : 2 à 40 lettres, chiffres, espaces, points ou tirets.');
        $insee = $d['commune']['insee'] ?? null;
        $nom = $d['commune']['nom'] ?? null;
        if ($insee !== null && !preg_match('/^(\d{5}|2[AB]\d{3})$/', (string) $insee)) erreur(400, 'Code commune invalide.');
        $db->prepare('UPDATE comptes SET pseudo = ?, commune_insee = ?, commune_nom = ? WHERE id = ?')
           ->execute([$pseudo ?: null, $insee, $insee ? mb_substr((string) $nom, 0, 120) : null, $c['id']]);
        repondre(200, ['ok' => true]);
    },

    'POST deconnexion' => function (PDO $db, array $config): void {
        corps();
        $db->prepare('DELETE FROM sessions WHERE empreinte = ?')->execute([hash('sha256', $_COOKIE['session'] ?? '')]);
        cookie('session', '', 'PT1S');
        repondre(200, ['ok' => true]);
    },

    'POST abonnement' => function (PDO $db, array $config): void {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        limiter($db, $config, 'abonnement', 5);
        $q = $db->prepare('SELECT confirme FROM abonnes WHERE email = ?');
        $q->execute([$email]);
        if ($q->fetchColumn() === false) $db->prepare('INSERT INTO abonnes (email, cree_le) VALUES (?, ?)')->execute([$email, maintenant()]);
        $jeton = creer_jeton($db, 'abonnement', $email, 'P7D');
        envoyer($config, $email, 'Confirmez votre inscription', "Bonjour,\n\nPour recevoir la lettre de République des mots, confirmez votre adresse :\n{$config['url_site']}/api/index.php?r=confirmer&jeton=$jeton\n\nSans confirmation, votre adresse sera effacée.\n");
        repondre(200, ['ok' => true]);
    },

    'GET confirmer' => function (PDO $db, array $config): void {
        $email = consommer_jeton($db, 'abonnement', (string) ($_GET['jeton'] ?? ''));
        if ($email !== null) $db->prepare('UPDATE abonnes SET confirme = 1, confirme_le = ? WHERE email = ?')->execute([maintenant(), $email]);
        header('Location: ' . $config['url_site'] . ($email ? '/#abonnement-confirme' : '/#lien-expire'));
        exit;
    },

];
