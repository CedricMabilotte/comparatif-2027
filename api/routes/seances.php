<?php
// Groupes : salles de séance (code court, clé d'animateur, votes des participants),
// réseau d'animateurs (inscription confirmée, déclaration de séance modérée, retours d'expérience).
// Les salles sont anonymes et éphémères : tout ce qui les concerne est effacé après 30 jours.
// Les votes de salle ne rejoignent la carte nationale (table « votes ») que si le participant a coché
// la case prévue (salle_presences.carte, décochée par défaut) ; sinon ils restent dans la salle.
declare(strict_types=1);

const GROUPES_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ni 0/O, ni 1/I/L
const GROUPES_DUREE_SALLE = 'P30D';
const GROUPES_SEANCES = ['aveugle', 'concept', 'mots', 'programme', 'libre'];
const GROUPES_PUBLICS = ['enseignants', 'bibliotheques', 'education-populaire', 'collectifs', 'proches', 'visio', 'autre'];
const GROUPES_REGIONS = [
    'Auvergne-Rhône-Alpes' => ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
    'Bourgogne-Franche-Comté' => ['21', '25', '39', '58', '70', '71', '89', '90'],
    'Bretagne' => ['22', '29', '35', '56'],
    'Centre-Val de Loire' => ['18', '28', '36', '37', '41', '45'],
    'Corse' => ['2A', '2B'],
    'Grand Est' => ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
    'Hauts-de-France' => ['02', '59', '60', '62', '80'],
    'Île-de-France' => ['75', '77', '78', '91', '92', '93', '94', '95'],
    'Normandie' => ['14', '27', '50', '61', '76'],
    'Nouvelle-Aquitaine' => ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
    'Occitanie' => ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
    'Pays de la Loire' => ['44', '49', '53', '72', '85'],
    "Provence-Alpes-Côte d'Azur" => ['04', '05', '06', '13', '83', '84'],
    'Guadeloupe' => ['971'], 'Martinique' => ['972'], 'Guyane' => ['973'], 'La Réunion' => ['974'], 'Mayotte' => ['976'],
];
// Centre approximatif de chaque région métropolitaine, quand la commune n'a pas pu être localisée.
const GROUPES_CENTRES = [
    'Auvergne-Rhône-Alpes' => [45.5, 4.5], 'Bourgogne-Franche-Comté' => [47.2, 4.8], 'Bretagne' => [48.2, -2.9],
    'Centre-Val de Loire' => [47.5, 1.7], 'Corse' => [42.15, 9.1], 'Grand Est' => [48.7, 5.6], 'Hauts-de-France' => [50.0, 2.8],
    'Île-de-France' => [48.7, 2.5], 'Normandie' => [49.1, 0.1], 'Nouvelle-Aquitaine' => [45.2, 0.2], 'Occitanie' => [43.7, 2.2],
    'Pays de la Loire' => [47.4, -0.8], "Provence-Alpes-Côte d'Azur" => [43.9, 6.1],
];

function groupes_purger(PDO $db): void {
    $vieilles = $db->prepare('SELECT code FROM salles WHERE expire_le < ?');
    $vieilles->execute([maintenant()]);
    foreach ($vieilles->fetchAll(PDO::FETCH_COLUMN) as $code) {
        foreach (['salle_votes', 'salle_presences', 'salles'] as $t) $db->prepare("DELETE FROM $t WHERE code = ?")->execute([$code]);
    }
}
function groupes_code_valide(mixed $c): string {
    $c = strtoupper(trim((string) $c));
    if (!preg_match('/^[' . GROUPES_ALPHABET . ']{5}$/', $c)) erreur(400, 'Code de salle invalide.');
    return $c;
}
function groupes_salle(PDO $db, string $code): array {
    $q = $db->prepare('SELECT * FROM salles WHERE code = ? AND expire_le > ?');
    $q->execute([$code, maintenant()]);
    return $q->fetch() ?: erreur(404, 'Cette salle n\'existe pas ou a expiré.');
}
// État public d'une salle : ce que voient la projection et les téléphones.
function groupes_etat(PDO $db, array $s): array {
    $items = json_decode($s['items'], true);
    $rang = (int) $s['rang'];
    $courant = $items[$rang] ?? null;
    $n = function (string $sql, array $p) use ($db): int { $q = $db->prepare($sql); $q->execute($p); return (int) $q->fetchColumn(); };
    $etat = [
        'code' => $s['code'], 'seance' => $s['seance'], 'titre' => $s['titre'], 'etat' => $s['etat'],
        'rang' => $rang, 'total' => count($items), 'item' => $courant, 'revele' => (bool) $s['revele'],
        'participants' => $n('SELECT COUNT(*) FROM salle_presences WHERE code = ?', [$s['code']]),
        'votes' => $n('SELECT COUNT(*) FROM salle_votes WHERE code = ?', [$s['code']]),
        'votes_item' => $courant ? $n('SELECT COUNT(*) FROM salle_votes WHERE code = ? AND proposition_id = ?', [$s['code'], $courant]) : 0,
        'expire_le' => $s['expire_le'],
    ];
    // Le téléphone retrouve son propre vote (cookie aléatoire, lu sans en créer un).
    $v = $_COOKIE['votant'] ?? '';
    if (preg_match('/^[0-9a-f-]{36}$/', $v)) {
        if ($courant) {
            $q = $db->prepare('SELECT valeur FROM salle_votes WHERE code = ? AND votant_id = ? AND proposition_id = ?');
            $q->execute([$s['code'], $v, $courant]);
            $val = $q->fetchColumn();
            $etat['mon_vote'] = $val === false ? null : array_search((int) $val, VALEURS, true);
        }
        $q = $db->prepare('SELECT carte FROM salle_presences WHERE code = ? AND votant_id = ?');
        $q->execute([$s['code'], $v]);
        $carte = $q->fetchColumn();
        $etat['present'] = $carte !== false;
        $etat['carte'] = (bool) $carte;
    }
    return $etat;
}
function groupes_texte(mixed $t, int $max): ?string {
    $t = trim(preg_replace('/\s+/u', ' ', (string) ($t ?? '')));
    return $t === '' ? null : mb_substr($t, 0, $max);
}
function groupes_region(string $dep): ?string {
    foreach (GROUPES_REGIONS as $r => $deps) if (in_array($dep, $deps, true)) return $r;
    return null;
}
// Centre de la commune, cherché une seule fois au moment de la déclaration (geo.api.gouv.fr,
// service public sans clé). Le navigateur des visiteurs n'appelle jamais ce service.
function groupes_localiser(array $config, string $commune, string $dep): ?array {
    $base = $config['geo_api'] ?? 'https://geo.api.gouv.fr';
    if (!$base) return null;
    $url = $base . '/communes?' . http_build_query(['nom' => $commune, 'codeDepartement' => $dep, 'fields' => 'nom,centre,region', 'boost' => 'population', 'limit' => 1]);
    $ctx = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true]]);
    $r = @file_get_contents($url, false, $ctx);
    $d = $r ? json_decode($r, true) : null;
    $c = $d[0]['centre']['coordinates'] ?? null;
    if (!is_array($c) || count($c) !== 2) return null;
    return ['nom' => (string) $d[0]['nom'], 'lon' => (float) $c[0], 'lat' => (float) $c[1]];
}

return [
    // Ouvrir une salle. La clé d'animateur n'est renvoyée qu'une fois ; seule son empreinte est gardée.
    'POST seance' => function (PDO $db, array $config): void {
        $d = corps();
        $seance = in_array($d['seance'] ?? '', GROUPES_SEANCES, true) ? $d['seance'] : erreur(400, 'Type de séance inconnu.');
        $items = $d['items'] ?? null;
        if (!is_array($items) || !$items || count($items) > 40) erreur(400, 'Choisissez entre 1 et 40 éléments.');
        foreach ($items as $i) {
            if (!is_string($i) || !preg_match('/^(p[0-9a-f]{3,12}|[nt]:[a-z0-9-]{1,100})$/', $i)) erreur(400, 'Élément inconnu dans la sélection.');
        }
        limiter($db, $config, 'salle', 20);
        groupes_purger($db);
        $code = '';
        for ($essai = 0; $essai < 20 && $code === ''; $essai++) {
            $c = '';
            for ($k = 0; $k < 5; $k++) $c .= GROUPES_ALPHABET[random_int(0, strlen(GROUPES_ALPHABET) - 1)];
            $q = $db->prepare('SELECT 1 FROM salles WHERE code = ?');
            $q->execute([$c]);
            if (!$q->fetch()) $code = $c;
        }
        if ($code === '') erreur(503, 'Aucun code libre. Réessayez.');
        $cle = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
        $db->prepare('INSERT INTO salles (code, cle_empreinte, seance, titre, items, rang, revele, etat, cree_le, expire_le) VALUES (?, ?, ?, ?, ?, -1, 0, ?, ?, ?)')
           ->execute([$code, hash('sha256', $cle), $seance, groupes_texte($d['titre'] ?? null, 120), json_encode(array_values(array_unique($items))), 'ouverte', maintenant(), maintenant(GROUPES_DUREE_SALLE)]);
        repondre(200, ['ok' => true, 'code' => $code, 'cle' => $cle, 'items' => array_values(array_unique($items)), 'expire_le' => maintenant(GROUPES_DUREE_SALLE)]);
    },

    'GET seance' => function (PDO $db, array $config): void {
        $s = groupes_salle($db, groupes_code_valide($_GET['code'] ?? ''));
        $etat = groupes_etat($db, $s);
        $etat['items'] = json_decode($s['items'], true);
        repondre(200, $etat);
    },

    // L'animateur pilote : élément suivant ou précédent, révéler l'auteur, clore ou rouvrir.
    'POST seance-piloter' => function (PDO $db, array $config): void {
        $d = corps();
        $s = groupes_salle($db, groupes_code_valide($d['code'] ?? ''));
        if (!hash_equals($s['cle_empreinte'], hash('sha256', (string) ($d['cle'] ?? '')))) erreur(403, 'Cet appareil ne pilote pas cette salle.');
        $total = count(json_decode($s['items'], true));
        $rang = (int) $s['rang']; $revele = (int) $s['revele']; $etat = $s['etat'];
        switch ($d['action'] ?? '') {
            case 'suivant': $rang = min($total - 1, $rang + 1); $revele = 0; break;
            case 'precedent': $rang = max(-1, $rang - 1); $revele = 0; break;
            case 'aller':
                $rang = max(-1, min($total - 1, (int) ($d['rang'] ?? 0))); $revele = 0; break;
            case 'reveler': $revele = 1; break;
            case 'masquer': $revele = 0; break;
            case 'clore': $etat = 'close'; break;
            case 'rouvrir': $etat = 'ouverte'; break;
            default: erreur(400, 'Action inconnue.');
        }
        $db->prepare('UPDATE salles SET rang = ?, revele = ?, etat = ? WHERE code = ?')->execute([$rang, $revele, $etat, $s['code']]);
        repondre(200, groupes_etat($db, ['rang' => $rang, 'revele' => $revele, 'etat' => $etat] + $s));
    },

    // Rejoindre est un geste explicite : c'est lui qui crée le cookie de votant aléatoire.
    // « carte » : true seulement si le participant a coché la case de la carte nationale.
    'POST seance-rejoindre' => function (PDO $db, array $config): void {
        $d = corps();
        $s = groupes_salle($db, groupes_code_valide($d['code'] ?? ''));
        limiter($db, $config, 'rejoindre', 300); // une classe partage souvent une seule adresse IP
        $v = votant($db);
        $carte = ($d['carte'] ?? false) === true;
        if (!$carte) $db->prepare('DELETE FROM votes WHERE votant_id = ? AND proposition_id IN (SELECT proposition_id FROM salle_votes WHERE code = ? AND votant_id = ?) AND EXISTS (SELECT 1 FROM salle_presences WHERE code = ? AND votant_id = ? AND carte = 1)')->execute([$v, $s['code'], $v, $s['code'], $v]);
        $db->prepare('DELETE FROM salle_presences WHERE code = ? AND votant_id = ?')->execute([$s['code'], $v]);
        $db->prepare('INSERT INTO salle_presences (code, votant_id, le, carte) VALUES (?, ?, ?, ?)')->execute([$s['code'], $v, maintenant(), $carte ? 1 : 0]);
        $_COOKIE['votant'] = $v;
        repondre(200, ['ok' => true] + groupes_etat($db, $s));
    },

    'POST seance-vote' => function (PDO $db, array $config): void {
        $d = corps();
        $s = groupes_salle($db, groupes_code_valide($d['code'] ?? ''));
        if ($s['etat'] !== 'ouverte') erreur(409, 'La séance est close : les votes sont terminés.');
        $prop = (string) ($d['proposition'] ?? '');
        $items = json_decode($s['items'], true);
        $pos = array_search($prop, $items, true);
        if (!preg_match('/^p[0-9a-f]{3,12}$/', $prop) || $pos === false) erreur(400, 'Cette proposition ne fait pas partie de la séance.');
        if ($pos > (int) $s['rang']) erreur(409, 'Cette proposition n\'a pas encore été présentée.');
        $valeur = VALEURS[$d['valeur'] ?? ''] ?? erreur(400, 'Valeur attendue : pour, partage ou contre.');
        limiter($db, $config, 'vote-salle', 3000);
        $v = $_COOKIE['votant'] ?? '';
        $q = $db->prepare('SELECT carte FROM salle_presences WHERE code = ? AND votant_id = ?');
        $q->execute([$s['code'], $v]);
        $carte = $q->fetchColumn();
        if ($carte === false) erreur(403, 'Rejoignez d\'abord la salle.');
        $carte = (bool) $carte;
        // La case peut être cochée ou décochée en cours de séance.
        if (is_bool($d['carte'] ?? null) && $d['carte'] !== $carte) {
            $carte = $d['carte'];
            $db->prepare('UPDATE salle_presences SET carte = ? WHERE code = ? AND votant_id = ?')->execute([$carte ? 1 : 0, $s['code'], $v]);
            // Accord retiré : les votes de cette salle déjà versés à la carte nationale en sont retirés.
            if (!$carte) $db->prepare('DELETE FROM votes WHERE votant_id = ? AND proposition_id IN (SELECT proposition_id FROM salle_votes WHERE code = ? AND votant_id = ?)')->execute([$v, $s['code'], $v]);
        }
        $le = maintenant();
        $db->prepare('DELETE FROM salle_votes WHERE code = ? AND votant_id = ? AND proposition_id = ?')->execute([$s['code'], $v, $prop]);
        $db->prepare('INSERT INTO salle_votes (code, votant_id, proposition_id, valeur, le) VALUES (?, ?, ?, ?, ?)')->execute([$s['code'], $v, $prop, $valeur, $le]);
        // Avec l'accord du participant seulement, le même vote, sans nom ni salle, rejoint la carte nationale.
        if ($carte) {
            $db->prepare('DELETE FROM votes WHERE votant_id = ? AND proposition_id = ?')->execute([$v, $prop]);
            $db->prepare('INSERT INTO votes (votant_id, proposition_id, valeur, le) VALUES (?, ?, ?, ?)')->execute([$v, $prop, $valeur, $le]);
        }
        repondre(200, ['ok' => true, 'mon_vote' => $d['valeur'], 'carte' => $carte]);
    },

    // Résultats : décompte par proposition et matrice anonyme (identifiants remplacés, ordre mélangé).
    'GET seance-resultats' => function (PDO $db, array $config): void {
        $s = groupes_salle($db, groupes_code_valide($_GET['code'] ?? ''));
        $q = $db->prepare('SELECT votant_id, proposition_id, valeur FROM salle_votes WHERE code = ?');
        $q->execute([$s['code']]);
        $parVotant = []; $decompte = [];
        foreach ($q->fetchAll() as $l) {
            $parVotant[$l['votant_id']][$l['proposition_id']] = (int) $l['valeur'];
            $cle = array_search((int) $l['valeur'], VALEURS, true);
            $decompte[$l['proposition_id']] ??= ['pour' => 0, 'partage' => 0, 'contre' => 0];
            $decompte[$l['proposition_id']][$cle]++;
        }
        $mien = $_COOKIE['votant'] ?? '';
        $votants = [];
        foreach ($parVotant as $id => $votes) $votants[] = ['moi' => $id === $mien, 'votes' => $votes];
        shuffle($votants);
        repondre(200, ['code' => $s['code'], 'seance' => $s['seance'], 'titre' => $s['titre'], 'etat' => $s['etat'],
            'items' => json_decode($s['items'], true), 'decompte' => (object) $decompte, 'votants' => $votants, 'expire_le' => $s['expire_le']]);
    },

    // Réseau d'animateurs : inscription confirmée par e-mail, désinscription par un lien permanent.
    'POST animateur-inscription' => function (PDO $db, array $config): void {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        $public = in_array($d['public'] ?? '', GROUPES_PUBLICS, true) ? $d['public'] : erreur(400, 'Choisissez votre public.');
        limiter($db, $config, 'animateur', 5);
        $cle = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
        $q = $db->prepare('SELECT id FROM animateurs WHERE email = ?');
        $q->execute([$email]);
        $id = $q->fetchColumn();
        if ($id) $db->prepare('UPDATE animateurs SET public_vise = ?, commune = ?, cle_desinscription = ? WHERE id = ?')->execute([$public, groupes_texte($d['commune'] ?? null, 120), hash('sha256', $cle), $id]);
        else {
            $id = uuid();
            $db->prepare('INSERT INTO animateurs (id, email, public_vise, commune, confirme, cle_desinscription, cree_le) VALUES (?, ?, ?, ?, 0, ?, ?)')
               ->execute([$id, $email, $public, groupes_texte($d['commune'] ?? null, 120), hash('sha256', $cle), maintenant()]);
        }
        $jeton = creer_jeton($db, 'animateur', $email, 'P7D');
        $api = $config['url_site'] . '/api/index.php';
        envoyer($config, $email, 'Confirmez votre inscription au réseau d\'animateurs',
            "Bonjour,\n\nPour recevoir les nouvelles séances de République des mots, confirmez votre adresse dans les 7 jours :\n$api?r=animateur-confirmer&jeton=$jeton\n\n"
            . "Sans confirmation, nous ne vous écrirons pas.\nPour vous désinscrire à tout moment :\n$api?r=animateur-desinscrire&id=$id&cle=$cle\n");
        repondre(200, ['ok' => true]);
    },

    'GET animateur-confirmer' => function (PDO $db, array $config): void {
        $email = consommer_jeton($db, 'animateur', (string) ($_GET['jeton'] ?? ''));
        if ($email !== null) $db->prepare('UPDATE animateurs SET confirme = 1, confirme_le = ? WHERE email = ?')->execute([maintenant(), $email]);
        header('Location: ' . $config['url_site'] . '/#groupes/animer/' . ($email ? 'confirme' : 'expire'));
        exit;
    },

    'GET animateur-desinscrire' => function (PDO $db, array $config): void {
        $q = $db->prepare('SELECT cle_desinscription FROM animateurs WHERE id = ?');
        $q->execute([(string) ($_GET['id'] ?? '')]);
        $empreinte = $q->fetchColumn();
        $ok = $empreinte && hash_equals($empreinte, hash('sha256', (string) ($_GET['cle'] ?? '')));
        if ($ok) $db->prepare('DELETE FROM animateurs WHERE id = ?')->execute([(string) $_GET['id']]);
        header('Location: ' . $config['url_site'] . '/#groupes/animer/' . ($ok ? 'desinscrit' : 'expire'));
        exit;
    },

    // Déclarer une séance : publiée seulement après relecture. Ni adresse précise ni nom de personne.
    'POST seance-declarer' => function (PDO $db, array $config): void {
        $d = corps();
        $date = (string) ($d['date'] ?? '');
        $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$dt || $dt->format('Y-m-d') !== $date || $date < '2026-01-01' || $date > '2028-12-31') erreur(400, 'Date invalide.');
        $mode = in_array($d['mode'] ?? '', ['salle', 'ligne'], true) ? $d['mode'] : erreur(400, 'En salle ou en ligne ?');
        $public = in_array($d['public'] ?? '', GROUPES_PUBLICS, true) ? $d['public'] : erreur(400, 'Choisissez le public.');
        $seance = in_array($d['seance'] ?? '', GROUPES_SEANCES, true) ? $d['seance'] : erreur(400, 'Choisissez la séance.');
        $email = email_valide($d['email'] ?? null);
        $lien = groupes_texte($d['lien'] ?? null, 300);
        if ($lien !== null && (!filter_var($lien, FILTER_VALIDATE_URL) || !str_starts_with($lien, 'https://'))) erreur(400, 'Le lien d\'inscription doit commencer par https://.');
        $commune = $dep = $region = $lat = $lon = null;
        if ($mode === 'salle') {
            $commune = groupes_texte($d['commune'] ?? null, 120) ?? erreur(400, 'Indiquez la commune.');
            if (!preg_match('/^[\p{L}\p{N}\' ().-]{1,120}$/u', $commune)) erreur(400, 'Indiquez seulement le nom de la commune, sans adresse.');
            $dep = strtoupper((string) ($d['departement'] ?? ''));
            $region = groupes_region($dep) ?? erreur(400, 'Département inconnu.');
        }
        $organisateur = groupes_texte($d['organisateur'] ?? null, 120);
        limiter($db, $config, 'declarer', 5);
        if ($mode === 'salle') {
            $geo = groupes_localiser($config, $commune, $dep);
            if ($geo) { $commune = $geo['nom']; $lat = $geo['lat']; $lon = $geo['lon']; }
            elseif (isset(GROUPES_CENTRES[$region])) [$lat, $lon] = GROUPES_CENTRES[$region];
        }
        $id = uuid();
        $db->prepare('INSERT INTO seances_declarees (id, date_seance, mode, commune, departement, region, lat, lon, public_vise, seance, organisateur, organisateur_public, lien, email, statut, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
           ->execute([$id, $date, $mode, $commune, $dep, $region, $lat, $lon, $public, $seance, $organisateur, ($d['organisateur_public'] ?? false) === true && $organisateur ? 1 : 0, $lien, $email, 'attente', maintenant()]);
        foreach ($config['moderateurs'] ?? [] as $m) {
            envoyer($config, $m, 'Une séance attend votre relecture', "Une séance du $date vient d'être déclarée.\nRelecture : {$config['url_site']}/#groupes/moderation\n");
        }
        repondre(200, ['ok' => true]);
    },

    'GET seances-publiques' => function (PDO $db, array $config): void {
        $l = $db->query("SELECT id, date_seance, mode, commune, departement, region, lat, lon, public_vise, seance, organisateur, organisateur_public, lien FROM seances_declarees WHERE statut = 'publiee' ORDER BY date_seance")->fetchAll();
        $sortie = array_map(fn ($s) => [
            'id' => $s['id'], 'date' => $s['date_seance'], 'mode' => $s['mode'], 'commune' => $s['commune'], 'departement' => $s['departement'],
            'region' => $s['region'], 'lat' => $s['lat'] === null ? null : (float) $s['lat'], 'lon' => $s['lon'] === null ? null : (float) $s['lon'],
            'public' => $s['public_vise'], 'seance' => $s['seance'], 'organisateur' => $s['organisateur_public'] ? $s['organisateur'] : null, 'lien' => $s['lien'],
        ], $l);
        repondre(200, ['seances' => $sortie, 'aujourdhui' => substr(maintenant(), 0, 10)]);
    },

    // Retour d'expérience en cinq questions : lu par la modération seulement.
    'POST retour-seance' => function (PDO $db, array $config): void {
        $d = corps();
        $seance = in_array($d['seance'] ?? '', GROUPES_SEANCES, true) ? $d['seance'] : erreur(400, 'Choisissez la séance.');
        $r = is_array($d['reponses'] ?? null) ? $d['reponses'] : erreur(400, 'Réponses manquantes.');
        $propres = [];
        foreach (['participants', 'reussi', 'difficile', 'neutralite', 'manque'] as $k) $propres[$k] = groupes_texte($r[$k] ?? null, 1500);
        if (!array_filter($propres)) erreur(400, 'Répondez au moins à une question.');
        $code = isset($d['code']) && $d['code'] !== '' ? groupes_code_valide($d['code']) : null;
        limiter($db, $config, 'retour', 10);
        $db->prepare('INSERT INTO retours_seance (id, code, seance, reponses, cree_le) VALUES (?, ?, ?, ?, ?)')
           ->execute([uuid(), $code, $seance, json_encode($propres, JSON_UNESCAPED_UNICODE), maintenant()]);
        repondre(200, ['ok' => true]);
    },

    'GET moderation-groupes' => function (PDO $db, array $config): void {
        moderateur($db, $config);
        $seances = $db->query('SELECT * FROM seances_declarees ORDER BY cree_le DESC')->fetchAll();
        $retours = $db->query('SELECT * FROM retours_seance ORDER BY cree_le DESC')->fetchAll();
        foreach ($retours as &$r) $r['reponses'] = json_decode($r['reponses'], true);
        $animateurs = (int) $db->query('SELECT COUNT(*) FROM animateurs WHERE confirme = 1')->fetchColumn();
        repondre(200, ['seances' => $seances, 'retours' => $retours, 'animateurs' => $animateurs]);
    },

    'POST moderation-groupes' => function (PDO $db, array $config): void {
        moderateur($db, $config);
        $d = corps();
        $statut = ['publier' => 'publiee', 'refuser' => 'refusee', 'attente' => 'attente'][$d['decision'] ?? ''] ?? erreur(400, 'Décision inconnue.');
        $q = $db->prepare('UPDATE seances_declarees SET statut = ?, modere_le = ? WHERE id = ?');
        $q->execute([$statut, maintenant(), (string) ($d['id'] ?? '')]);
        if (!$q->rowCount()) erreur(404, 'Séance introuvable.');
        repondre(200, ['ok' => true, 'statut' => $statut]);
    },
];
