<?php
// Outils communs de l'API : connexion à la base, réponses, jetons, cookies, limites, migrations.
declare(strict_types=1);

$config = require getenv('REPUBLIQUE_CONFIG') ?: __DIR__ . '/config.php';
$db = new PDO($config['dsn'], $config['utilisateur'] ?? null, $config['mot_de_passe'] ?? null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

const DUREE_JETON = 'PT30M';
const DUREE_SESSION = 'P90D';
// Durées de conservation annoncées dans la page « Vie privée » : les deux doivent rester d'accord.
const DUREE_NON_CONFIRME = 'P7D';       // abonnés et animateurs qui n'ont pas confirmé leur adresse
const DUREE_COMPTE_INACTIF = 'P3Y';     // comptes sans connexion depuis
const DUREE_APRES_SEANCE = 'P3M';       // adresse d'une séance déclarée, après la date de la séance
const DUREE_NON_PUBLIE = 'P1Y';         // contributions refusées, retours de séance
const DUREE_VOTANT_VIDE = 'P2Y';        // identifiant de votant resté sans vote (durée du cookie)
const FIN_VOTES = '2028-01-01T00:00:00Z'; // les votes de la carte nationale sont effacés à cette date
const FREQUENCE_ENTRETIEN = 'PT1H';
const VALEURS = ['pour' => 1, 'partage' => 0, 'contre' => -1];

function maintenant(string $decalage = ''): string {
    $d = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if ($decalage) $d = $d->add(new DateInterval($decalage));
    return $d->format('Y-m-d\TH:i:s\Z');
}
function il_y_a(string $duree): string {
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->sub(new DateInterval($duree))->format('Y-m-d\TH:i:s\Z');
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
    $q = $db->prepare('SELECT c.id, c.email, c.pseudo, c.commune_insee, c.commune_nom, c.cree_le FROM sessions s JOIN comptes c ON c.id = s.compte_id WHERE s.empreinte = ? AND s.expire_le > ?');
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


// Migrations : chaque fichier migrations/NNN-nom.sql est appliqué une seule fois, dans l'ordre.
function migrer(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS migrations (nom VARCHAR(100) PRIMARY KEY, le VARCHAR(25) NOT NULL)');
    $faites = array_flip($db->query('SELECT nom FROM migrations')->fetchAll(PDO::FETCH_COLUMN));
    foreach (glob(__DIR__ . '/migrations/*.sql') as $f) {
        $nom = basename($f, '.sql');
        if (isset($faites[$nom])) continue;
        $sql = preg_replace('/^\s*--.*$/m', '', (string) file_get_contents($f));
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $requete) $db->exec($requete);
        $db->prepare('INSERT INTO migrations (nom, le) VALUES (?, ?)')->execute([$nom, maintenant()]);
    }
}
// Modérateurs : adresses listées dans config.php ('moderateurs' => [...]).
function moderateur(PDO $db, array $config): array {
    $c = compte_courant($db) ?? erreur(401, 'Connectez-vous d\'abord.');
    $q = $db->prepare('SELECT email FROM comptes WHERE id = ?');
    $q->execute([$c['id']]);
    if (!in_array($q->fetchColumn(), $config['moderateurs'] ?? [], true)) erreur(403, 'Réservé à la modération.');
    return $c;
}

// Lien de désinscription de la lettre : le jeton est dérivé de l'adresse et du sel (toujours le même
// pour une adresse, donc valable dans chaque message) ; seule son empreinte est gardée en base.
function lien_desinscription(PDO $db, array $config, string $email): string {
    $jeton = rtrim(strtr(base64_encode(hash_hmac('sha256', 'desinscription|' . $email, $config['sel'], true)), '+/', '-_'), '=');
    $db->prepare('UPDATE abonnes SET cle_desinscription = ? WHERE email = ?')->execute([hash('sha256', $jeton), $email]);
    return $config['url_site'] . '/api/index.php?r=desinscription&jeton=' . $jeton;
}

// Effacer un compte et tout ce qui s'y rattache. Les contributions publiées restent, sans auteur.
function effacer_compte(PDO $db, string $id): void {
    $q = $db->prepare('SELECT email FROM comptes WHERE id = ?');
    $q->execute([$id]);
    $email = $q->fetchColumn();
    $q = $db->prepare('SELECT votant_id FROM liens_votants WHERE compte_id = ?');
    $q->execute([$id]);
    $votants = $q->fetchAll(PDO::FETCH_COLUMN);
    $db->beginTransaction();
    foreach ($votants as $v) {
        foreach (['votes', 'salle_votes', 'salle_presences'] as $t) $db->prepare("DELETE FROM $t WHERE votant_id = ?")->execute([$v]);
        $db->prepare('DELETE FROM votants WHERE id = ?')->execute([$v]);
    }
    foreach (['liens_votants', 'sessions', 'sauvegardes', 'cercles_interets'] as $t) $db->prepare("DELETE FROM $t WHERE compte_id = ?")->execute([$id]);
    $db->prepare('UPDATE contributions SET compte_id = NULL, email = NULL, pseudo = NULL WHERE compte_id = ?')->execute([$id]);
    if ($email) {
        $db->prepare('DELETE FROM abonnes WHERE email = ?')->execute([$email]);
        $db->prepare('UPDATE contributions SET email = NULL WHERE email = ?')->execute([$email]);
    }
    $db->prepare('DELETE FROM comptes WHERE id = ?')->execute([$id]);
    $db->commit();
}

// Purge automatique, au plus une fois par heure, lancée par la première requête qui passe.
function entretenir(PDO $db): void {
    $q = $db->prepare('SELECT le FROM entretien WHERE tache = ?');
    $q->execute(['purge']);
    $le = $q->fetchColumn();
    if ($le !== false && $le > il_y_a(FREQUENCE_ENTRETIEN)) return;
    $db->prepare('DELETE FROM entretien WHERE tache = ?')->execute(['purge']);
    $db->prepare('INSERT INTO entretien (tache, le) VALUES (?, ?)')->execute(['purge', maintenant()]);
    $maintenant = maintenant();
    $faire = fn (string $sql, array $p = []) => $db->prepare($sql)->execute($p);
    $faire('DELETE FROM jetons WHERE expire_le < ?', [$maintenant]);
    $faire('DELETE FROM sessions WHERE expire_le < ?', [$maintenant]);
    $faire('DELETE FROM limites WHERE fenetre < ?', [$maintenant]);
    $faire('DELETE FROM abonnes WHERE confirme = 0 AND cree_le < ?', [il_y_a(DUREE_NON_CONFIRME)]);
    $faire('DELETE FROM animateurs WHERE confirme = 0 AND cree_le < ?', [il_y_a(DUREE_NON_CONFIRME)]);
    // Salles de séance : 30 jours après leur ouverture (date d'expiration fixée à la création).
    foreach (['salle_votes', 'salle_presences'] as $t) $faire("DELETE FROM $t WHERE code IN (SELECT code FROM salles WHERE expire_le < ?)", [$maintenant]);
    $faire('DELETE FROM salles WHERE expire_le < ?', [$maintenant]);
    $faire("UPDATE seances_declarees SET email = '' WHERE email <> '' AND date_seance < ?", [substr(il_y_a(DUREE_APRES_SEANCE), 0, 10)]);
    $faire("DELETE FROM contributions WHERE etat = 'refuse' AND traite_le < ?", [il_y_a(DUREE_NON_PUBLIE)]);
    $faire('DELETE FROM retours_seance WHERE cree_le < ?', [il_y_a(DUREE_NON_PUBLIE)]);
    if ($maintenant >= FIN_VOTES) $faire('DELETE FROM votes');
    $faire('DELETE FROM votants WHERE cree_le < ? AND id NOT IN (SELECT votant_id FROM votes) AND id NOT IN (SELECT votant_id FROM liens_votants) AND id NOT IN (SELECT votant_id FROM salle_presences)', [il_y_a(DUREE_VOTANT_VIDE)]);
    $q = $db->prepare('SELECT id FROM comptes WHERE COALESCE(vu_le, cree_le) < ?');
    $q->execute([il_y_a(DUREE_COMPTE_INACTIF)]);
    foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $id) effacer_compte($db, $id);
}
