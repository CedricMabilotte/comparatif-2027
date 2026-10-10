<?php
// API de la couche participative : votes à l'aveugle, lien magique, profil, lettre d'information.
// Routage : /api/index.php?r=<route>. Réponses JSON, sauf les liens cliqués depuis un e-mail.
declare(strict_types=1);

$config = require getenv('REPUBLIQUE_CONFIG') ?: __DIR__ . '/config.php';
$db = new PDO($config['dsn'], $config['utilisateur'] ?? null, $config['mot_de_passe'] ?? null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

const DUREE_JETON = 'PT30M';
const DUREE_SESSION = 'P90D';
const VALEURS = ['pour' => 1, 'partage' => 0, 'contre' => -1];

function maintenant(string $decalage = ''): string {
    $d = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if ($decalage) $d = $d->add(new DateInterval($decalage));
    return $d->format('Y-m-d\TH:i:s\Z');
}
function uuid(): string {
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
function repondre(int $code, array $corps): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($corps, JSON_UNESCAPED_UNICODE);
    exit;
}
function erreur(int $code, string $message): never { repondre($code, ['erreur' => $message]); }
function corps(): array {
    // Exiger du JSON bloque les envois de formulaires depuis un autre site (pas de requête « simple »).
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) erreur(415, 'Le corps doit être en JSON.');
    $d = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($d)) erreur(400, 'JSON invalide.');
    return $d;
}
function email_valide(mixed $e): string {
    $e = is_string($e) ? strtolower(trim($e)) : '';
    if (!filter_var($e, FILTER_VALIDATE_EMAIL) || strlen($e) > 254) erreur(400, 'Adresse e-mail invalide.');
    return $e;
}
function limiter(PDO $db, array $config, string $quoi, int $max, string $fenetre = 'PT1H'): void {
    $cle = hash('sha256', $config['sel'] . '|' . $quoi . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
    $l = $db->prepare('SELECT fenetre, compte FROM limites WHERE cle = ?');
    $l->execute([$cle]);
    $ligne = $l->fetch();
    if (!$ligne || $ligne['fenetre'] < maintenant()) {
        $db->prepare('DELETE FROM limites WHERE cle = ?')->execute([$cle]);
        $db->prepare('INSERT INTO limites (cle, fenetre, compte) VALUES (?, ?, 1)')->execute([$cle, maintenant($fenetre)]);
        return;
    }
    if ($ligne['compte'] >= $max) erreur(429, 'Trop de demandes. Réessayez plus tard.');
    $db->prepare('UPDATE limites SET compte = compte + 1 WHERE cle = ?')->execute([$cle]);
}
function envoyer(array $config, string $a, string $sujet, string $texte): void {
    if ($config['envoi'] === 'journal') {
        file_put_contents(__DIR__ . '/courrier.log', "À: $a\nSujet: $sujet\n\n$texte\n---\n", FILE_APPEND);
        return;
    }
    $entetes = "From: {$config['expediteur']}\r\nContent-Type: text/plain; charset=utf-8\r\n";
    mail($a, '=?UTF-8?B?' . base64_encode($sujet) . '?=', $texte, $entetes);
}
function creer_jeton(PDO $db, string $usage, string $email, string $duree): string {
    $jeton = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $db->prepare('INSERT INTO jetons (empreinte, usage, email, expire_le) VALUES (?, ?, ?, ?)')
       ->execute([hash('sha256', $jeton), $usage, $email, maintenant($duree)]);
    return $jeton;
}
function consommer_jeton(PDO $db, string $usage, string $jeton): ?string {
    $empreinte = hash('sha256', $jeton);
    $q = $db->prepare('SELECT email, expire_le, utilise FROM jetons WHERE empreinte = ? AND usage = ?');
    $q->execute([$empreinte, $usage]);
    $j = $q->fetch();
    if (!$j || $j['utilise'] || $j['expire_le'] < maintenant()) return null;
    $db->prepare('UPDATE jetons SET utilise = 1 WHERE empreinte = ?')->execute([$empreinte]);
    return $j['email'];
}
function cookie(string $nom, string $valeur, string $duree): void {
    $fin = (new DateTimeImmutable())->add(new DateInterval($duree))->getTimestamp();
    setcookie($nom, $valeur, ['expires' => $fin, 'path' => '/', 'secure' => ($_SERVER['HTTPS'] ?? '') !== '', 'httponly' => true, 'samesite' => 'Lax']);
}
function compte_courant(PDO $db): ?array {
    $s = $_COOKIE['session'] ?? '';
    if ($s === '') return null;
    $q = $db->prepare('SELECT c.id, c.pseudo, c.commune_insee, c.commune_nom FROM sessions s JOIN comptes c ON c.id = s.compte_id WHERE s.empreinte = ? AND s.expire_le > ?');
    $q->execute([hash('sha256', $s), maintenant()]);
    return $q->fetch() ?: null;
}
// Identifiant de votant : aléatoire, dans un cookie, sans lien avec l'identité.
function votant(PDO $db): string {
    $v = $_COOKIE['votant'] ?? '';
    if (preg_match('/^[0-9a-f-]{36}$/', $v)) {
        $q = $db->prepare('SELECT 1 FROM votants WHERE id = ?');
        $q->execute([$v]);
        if ($q->fetch()) return $v;
    }
    $v = uuid();
    $db->prepare('INSERT INTO votants (id, cree_le) VALUES (?, ?)')->execute([$v, maintenant()]);
    cookie('votant', $v, 'P2Y');
    return $v;
}

$route = $_GET['r'] ?? '';
$methode = $_SERVER['REQUEST_METHOD'];

try {
    switch ("$methode $route") {

    case 'POST vote': {
        $d = corps();
        $prop = is_string($d['proposition'] ?? null) && preg_match('/^p\d{3,6}$/', $d['proposition']) ? $d['proposition'] : erreur(400, 'Proposition inconnue.');
        $valeur = VALEURS[$d['valeur'] ?? ''] ?? erreur(400, 'Valeur attendue : pour, partage ou contre.');
        limiter($db, $config, 'vote', 300);
        $v = votant($db);
        $db->prepare('DELETE FROM votes WHERE votant_id = ? AND proposition_id = ?')->execute([$v, $prop]);
        $db->prepare('INSERT INTO votes (votant_id, proposition_id, valeur, le) VALUES (?, ?, ?, ?)')->execute([$v, $prop, $valeur, maintenant()]);
        repondre(200, ['ok' => true]);
    }

    // Matrice anonyme des votes pour la carte des consensus : identifiants remplacés par un rang,
    // votants avec moins de 3 votes écartés.
    case 'GET votes': {
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
    }

    case 'POST lien-magique': {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        if (($d['consentement'] ?? false) !== true) erreur(400, 'Le consentement est nécessaire pour créer un compte.');
        limiter($db, $config, 'lien', 5);
        $jeton = creer_jeton($db, 'connexion', $email, DUREE_JETON);
        $lien = $config['url_site'] . '/api/index.php?r=connexion&jeton=' . $jeton;
        envoyer($config, $email, 'Votre lien de connexion', "Bonjour,\n\nPour vous connecter à République des mots, ouvrez ce lien dans les 30 minutes :\n$lien\n\nSi vous n'avez rien demandé, ignorez ce message.\n");
        repondre(200, ['ok' => true]); // même réponse que l'adresse existe ou non
    }

    case 'GET connexion': {
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
    }

    case 'GET moi': {
        $c = compte_courant($db);
        repondre(200, ['connecte' => (bool) $c, 'pseudo' => $c['pseudo'] ?? null, 'commune' => $c ? ['insee' => $c['commune_insee'], 'nom' => $c['commune_nom']] : null]);
    }

    case 'POST profil': {
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
    }

    case 'POST deconnexion': {
        corps();
        $db->prepare('DELETE FROM sessions WHERE empreinte = ?')->execute([hash('sha256', $_COOKIE['session'] ?? '')]);
        cookie('session', '', 'PT1S');
        repondre(200, ['ok' => true]);
    }

    case 'POST abonnement': {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        limiter($db, $config, 'abonnement', 5);
        $q = $db->prepare('SELECT confirme FROM abonnes WHERE email = ?');
        $q->execute([$email]);
        if ($q->fetchColumn() === false) $db->prepare('INSERT INTO abonnes (email, cree_le) VALUES (?, ?)')->execute([$email, maintenant()]);
        $jeton = creer_jeton($db, 'abonnement', $email, 'P7D');
        envoyer($config, $email, 'Confirmez votre inscription', "Bonjour,\n\nPour recevoir la lettre de République des mots, confirmez votre adresse :\n{$config['url_site']}/api/index.php?r=confirmer&jeton=$jeton\n\nSans confirmation, votre adresse sera effacée.\n");
        repondre(200, ['ok' => true]);
    }

    case 'GET confirmer': {
        $email = consommer_jeton($db, 'abonnement', (string) ($_GET['jeton'] ?? ''));
        if ($email !== null) $db->prepare('UPDATE abonnes SET confirme = 1, confirme_le = ? WHERE email = ?')->execute([maintenant(), $email]);
        header('Location: ' . $config['url_site'] . ($email ? '/#abonnement-confirme' : '/#lien-expire'));
        exit;
    }

    default:
        erreur(404, 'Route inconnue.');
    }
} catch (PDOException $e) {
    error_log('API republique : ' . $e->getMessage());
    erreur(500, 'Erreur interne.');
}
