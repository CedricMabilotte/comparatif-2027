# Mise en ligne sur Gandi Simple Hosting

Cible : l'instance Simple Hosting existante de Cedric (PHP 8.4, Paris SD6), vhosts `republique.fr` (le site) et `www.republique.fr` (redirection vers l'apex).

## État au 2026-10-10
- Domaine passé du DNS « classique » de Gandi à LiveDNS (`POST /v5/domain/domains/republique.fr/livedns`). La zone a été recopiée à l'identique (MX, SPF, sous-domaines mail).
- Les anciens enregistrements de parking (`@ A 217.70.184.38`, `www CNAME webredir.vip.gandi.net.`) ont été supprimés, puis les deux vhosts créés avec `linked_dns_zone.allow_alteration: true` : Simple Hosting a posé lui-même `@ A/AAAA` (racine) et `www CNAME webacc12.sd6.ghst.net.`.
- Base : SQLite, dans `/vhosts/republique.fr/donnees/republique.sqlite`, hors de la racine web. Pas de mot de passe à gérer ; passer à MySQL si le trafic l'exige (le DSN suffit, l'API est compatible).

## Contenu déployé
- `site/` → `/vhosts/republique.fr/htdocs/` : page, `corpus.json`, `consensus.js`.
- `api/index.php` → `htdocs/api/`, avec un `config.php` créé au déploiement (jamais versionné, `sel` aléatoire, `envoi => 'mail'`).
- `/vhosts/www.republique.fr/htdocs/index.html` : redirection vers `https://republique.fr`.
- Dépôt par SFTP : `sftp.sd6.gpaas.net`, utilisateur = identifiant de l'instance, clé de Cedric.

## Première initialisation
Déposer temporairement `api/schema.sql` et un script qui crée `donnees/` et la base, l'appeler une fois, puis supprimer les deux fichiers.

## Pièges
- LiveDNS : écrire un enregistrement par `PUT .../records/@/A`, jamais `/records/@` (écraserait MX et SPF).
- Le vhost répond « Vhost unknown » et le certificat HTTPS n'est émis qu'après propagation des serveurs de noms.

## Vérifier
`curl https://republique.fr/api/index.php?r=moi` doit répondre `{"connecte":false,...}`.

## Données personnelles
- Les votes sont liés à un identifiant aléatoire (`votants`), le lien avec un compte est dans `liens_votants`.
- La table `abonnes` sert de liste de diffusion en attendant l'outil d'envoi.
- Purger régulièrement `jetons`, `sessions` expirées et `abonnes` non confirmés depuis plus de 7 jours.
