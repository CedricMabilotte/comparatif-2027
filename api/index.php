<?php
// API de la couche participative. Routage : /api/index.php?r=<route>.
// Chaque fichier routes/*.php renvoie un tableau 'MÉTHODE route' => fonction(PDO $db, array $config).
// Réponses JSON, sauf les liens cliqués depuis un e-mail.
declare(strict_types=1);
require __DIR__ . '/commun.php';

$route = $_GET['r'] ?? '';
$methode = $_SERVER['REQUEST_METHOD'];

try {
    migrer($db);
    $routes = [];
    foreach (glob(__DIR__ . '/routes/*.php') as $f) $routes += require $f;
    $f = $routes["$methode $route"] ?? erreur(404, 'Route inconnue.');
    $f($db, $config);
} catch (PDOException $e) {
    error_log('API republique : ' . $e->getMessage());
    erreur(500, 'Erreur interne.');
}
