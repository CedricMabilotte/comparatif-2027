<?php
// Copier en config.php (jamais versionné) et adapter.
return [
    'dsn' => 'mysql:host=localhost;dbname=republique;charset=utf8mb4',
    'utilisateur' => 'republique',
    'mot_de_passe' => '',
    'url_site' => 'https://republique.fr',
    'expediteur' => 'Republique des mots <bonjour@republique.fr>',
    // 'mail' : fonction mail() de l'hébergeur ; 'journal' : écrit les messages dans courrier.log (tests).
    'envoi' => 'mail',
    'sel' => 'remplacer-par-une-longue-chaine-aleatoire',
];
