<?php
// Routes des jeux : envoi par e-mail des résultats du test « Votre profil d'idées ».
// Rien n'est enregistré en base : ni l'adresse, ni le résumé. Seule la limite de débit garde,
// une heure, une empreinte de l'adresse IP (table limites), comme pour les autres envois.
declare(strict_types=1);

return [
    'POST resultats-email' => function (PDO $db, array $config): void {
        $d = corps();
        $email = email_valide($d['email'] ?? null);
        $resume = is_string($d['resume'] ?? null) ? trim(str_replace("\r", '', $d['resume'])) : '';
        if ($resume === '') erreur(400, 'Le résumé est vide.');
        if (mb_strlen($resume) > 15000) erreur(400, 'Le résumé est trop long.');
        // Pas de lien dans le texte fourni : la route ne doit pas servir à envoyer autre chose que des résultats.
        if (preg_match('~https?://|www\.~i', $resume)) erreur(400, 'Le résumé ne doit pas contenir de lien.');
        limiter($db, $config, 'resultats', 5);
        $resume = (string) preg_replace('/[^\P{C}\n\t]/u', '', $resume);
        $texte = "Bonjour,\n\nVoici les résultats que vous avez demandé à recevoir depuis République des mots.\n\n"
            . $resume
            . "\n\nRefaire le test ou relire les sources : {$config['url_site']}/#jouer/profil\n\n"
            . "Votre adresse a servi seulement à cet envoi : elle n'a pas été gardée.\n"
            . "Si vous n'avez rien demandé, ignorez ce message.\n";
        envoyer($config, $email, "Vos résultats : votre profil d'idées", $texte);
        repondre(200, ['ok' => true]);
    },
];
