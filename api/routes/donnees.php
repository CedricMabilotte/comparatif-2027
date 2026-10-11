<?php
// Espace personnel : voir ses données, effacer ses votes, supprimer son compte, sauvegarder ce que
// le navigateur retient. Chaque écriture exige du JSON (corps()), ce qui la protège des envois croisés.
declare(strict_types=1);

const SAUVEGARDE_MAX = 200 * 1024; // octets, une fois sérialisée

// Identifiant de votant du cookie, lu sans en créer un.
function dn_votant_cookie(PDO $db): ?string {
    $v = $_COOKIE['votant'] ?? '';
    if (!preg_match('/^[0-9a-f-]{36}$/', $v)) return null;
    $q = $db->prepare('SELECT 1 FROM votants WHERE id = ?');
    $q->execute([$v]);
    return $q->fetchColumn() ? $v : null;
}

return [
    'GET mes-donnees' => function (PDO $db, array $config): void {
        limiter($db, $config, 'mes-donnees', 120);
        $c = compte_courant($db);
        $votants = [];
        if ($v = dn_votant_cookie($db)) $votants[] = $v;
        if ($c) {
            $q = $db->prepare('SELECT votant_id FROM liens_votants WHERE compte_id = ?');
            $q->execute([$c['id']]);
            $votants = array_values(array_unique([...$votants, ...$q->fetchAll(PDO::FETCH_COLUMN)]));
        }
        $votes = [];
        if ($votants) {
            $q = $db->prepare('SELECT proposition_id, valeur, le FROM votes WHERE votant_id IN (' . implode(', ', array_fill(0, count($votants), '?')) . ') ORDER BY le');
            $q->execute($votants);
            foreach ($q->fetchAll() as $l) $votes[] = ['proposition' => $l['proposition_id'], 'valeur' => array_search((int) $l['valeur'], VALEURS, true), 'le' => $l['le']];
        }
        $contributions = []; $abonnement = null; $cercles = [];
        if ($c) {
            $q = $db->prepare('SELECT genre, COALESCE(cible, terme) AS cible, texte, etat, cree_le FROM contributions WHERE compte_id = ? ORDER BY cree_le');
            $q->execute([$c['id']]);
            $contributions = $q->fetchAll();
            $q = $db->prepare('SELECT frequence, confirme FROM abonnes WHERE email = ?');
            $q->execute([$c['email']]);
            if ($a = $q->fetch()) $abonnement = ['frequence' => $a['frequence'], 'confirme' => (bool) $a['confirme']];
            $q = $db->prepare('SELECT cercle FROM cercles_interets WHERE compte_id = ? ORDER BY cercle');
            $q->execute([$c['id']]);
            $cercles = $q->fetchAll(PDO::FETCH_COLUMN);
        }
        repondre(200, [
            'compte' => $c ? ['email' => $c['email'], 'pseudo' => $c['pseudo'], 'commune' => $c['commune_nom'], 'cree_le' => $c['cree_le']] : null,
            'votes' => $votes, 'contributions' => $contributions, 'abonnement' => $abonnement, 'cercles' => $cercles,
        ]);
    },

    'POST supprimer-compte' => function (PDO $db, array $config): void {
        corps();
        $c = compte_courant($db) ?? erreur(401, 'Connectez-vous d\'abord.');
        effacer_compte($db, $c['id']);
        cookie('session', '', 'PT1S');
        cookie('votant', '', 'PT1S');
        repondre(200, ['ok' => true]);
    },

    // Votes de la carte nationale déposés depuis ce navigateur (sans compte).
    'POST effacer-votes' => function (PDO $db, array $config): void {
        corps();
        limiter($db, $config, 'effacer-votes', 30);
        $n = 0;
        if ($v = dn_votant_cookie($db)) {
            $q = $db->prepare('DELETE FROM votes WHERE votant_id = ?');
            $q->execute([$v]);
            $n = $q->rowCount();
        }
        repondre(200, ['ok' => true, 'n' => $n]);
    },

    'GET sauvegarde' => function (PDO $db, array $config): void {
        $c = compte_courant($db) ?? erreur(401, 'Connectez-vous d\'abord.');
        limiter($db, $config, 'sauvegarde-lire', 120);
        $q = $db->prepare('SELECT donnees, le FROM sauvegardes WHERE compte_id = ?');
        $q->execute([$c['id']]);
        $s = $q->fetch();
        repondre(200, ['donnees' => $s ? json_decode($s['donnees']) : null, 'le' => $s['le'] ?? null]);
    },

    'POST sauvegarde' => function (PDO $db, array $config): void {
        $c = compte_courant($db) ?? erreur(401, 'Connectez-vous d\'abord.');
        corps();
        // Relu sans tableau associatif, pour garder la distinction entre {} et [].
        $brut = json_decode(file_get_contents('php://input') ?: '');
        if (!is_object($brut) || !isset($brut->donnees) || !is_object($brut->donnees)) erreur(400, 'Un objet « donnees » est attendu.');
        $json = json_encode($brut->donnees, JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > SAUVEGARDE_MAX) erreur(413, 'Sauvegarde trop volumineuse (200 Ko au plus).');
        limiter($db, $config, 'sauvegarde', 60);
        $le = maintenant();
        $db->prepare('DELETE FROM sauvegardes WHERE compte_id = ?')->execute([$c['id']]);
        $db->prepare('INSERT INTO sauvegardes (compte_id, donnees, le) VALUES (?, ?, ?)')->execute([$c['id'], $json, $le]);
        repondre(200, ['ok' => true, 'le' => $le]);
    },
];
