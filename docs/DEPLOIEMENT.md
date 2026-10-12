# Mise en ligne sur Gandi Simple Hosting

Cible : l'instance Simple Hosting existante de Cedric (PHP 8.4, Paris SD6), vhosts `republique.fr` (le site) et `www.republique.fr` (redirection vers l'apex).

## État au 2026-10-10
- Domaine passé du DNS « classique » de Gandi à LiveDNS (`POST /v5/domain/domains/republique.fr/livedns`). La zone a été recopiée à l'identique (MX, SPF, sous-domaines mail).
- Les anciens enregistrements de parking (`@ A 217.70.184.38`, `www CNAME webredir.vip.gandi.net.`) ont été supprimés, puis les deux vhosts créés avec `linked_dns_zone.allow_alteration: true` : Simple Hosting a posé lui-même `@ A/AAAA` (racine) et `www CNAME webacc12.sd6.ghst.net.`.
- Base : SQLite, dans `/vhosts/republique.fr/donnees/republique.sqlite`, hors de la racine web. Pas de mot de passe à gérer ; passer à MySQL si le trafic l'exige (le DSN suffit, l'API est compatible).

## Source de déploiement : la branche main
Depuis le 2026-10-12, `main` est la seule source de ce qui est servi sur republique.fr : le site (PR #1) et le test « boussole d'idées » (PR #2) y sont fusionnés. On ne déploie plus depuis `prototype-v2` ni depuis une branche de travail : elles n'ont pas tout (`prototype-v2` n'a pas le test, et redéployer depuis elle effacerait l'encart du test sur l'accueil).

Marche à suivre :
1. Fusionner la modification dans `main` (par une PR).
2. Dans un clone à jour de `main` : `git switch main && git pull`.
3. Construire : `node scripts/construire.mjs` (il faut les textes sources, voir `scripts/telecharger-sources.sh`).
4. Avant d'envoyer : `bash scripts/comparer-en-ligne.sh`. Un « ÉCART » sur un fichier que la modification ne touche pas veut dire que le site en ligne contient quelque chose que `main` n'a pas : s'arrêter et le rapatrier dans `main` d'abord.
5. Envoyer par SFTP (lot complet ci-dessous, ou `scripts/deployer-boussole.sh` pour le seul test).

## Contenu déployé
- `site/` → `/vhosts/republique.fr/htdocs/` : page, `corpus.json`, scripts, pages de partage `c/` et `t/`, test `test/`, `sitemap.xml`.
- `api/index.php` → `htdocs/api/`, avec un `config.php` créé au déploiement (jamais versionné, `sel` aléatoire, `envoi => 'mail'`).
- `/vhosts/www.republique.fr/htdocs/index.html` : redirection vers `https://republique.fr`.
- Dépôt par SFTP : `sftp.sd6.gpaas.net`, utilisateur = identifiant de l'instance, clé de Cedric.

## Première initialisation
Créer le dossier `donnees/` hors de la racine web. L'API crée et met à jour la base elle-même : chaque fichier `api/migrations/NNN-nom.sql` est appliqué une seule fois, à la première requête qui suit son dépôt.

## Pièges
- LiveDNS : écrire un enregistrement par `PUT .../records/@/A`, jamais `/records/@` (écraserait MX et SPF).
- Les box gardent l'ancienne adresse jusqu'à la fin de son TTL (3 h sur l'ancienne zone Gandi) : baisser le TTL à 300 s la veille d'un changement d'adresse.
- Le vhost répond « Vhost unknown » et le certificat HTTPS n'est émis qu'après propagation des serveurs de noms.

## Vérifier
`curl https://republique.fr/api/index.php?r=moi` doit répondre `{"connecte":false,...}`.

## Données personnelles
- Les votes sont liés à un identifiant aléatoire (`votants`), le lien avec un compte est dans `liens_votants`.
- La table `abonnes` sert de liste de diffusion en attendant l'outil d'envoi.
- La purge est automatique (`entretenir()` dans `api/commun.php`, au plus une fois par heure, déclenchée par la première requête) : jetons et sessions expirés, limites de débit échues, abonnés et animateurs non confirmés après 7 jours, salles de séance après 30 jours, adresse des séances déclarées 3 mois après la séance, contributions refusées et retours de séance après un an, comptes sans connexion depuis 3 ans, votes de la carte nationale au 1er janvier 2028. Ces durées sont affichées dans la page « Vie privée » (`site/js/accueil.js`) : modifier les deux ensemble.
- Chaque message de la lettre doit contenir le lien donné par `lien_desinscription()` (route `desinscription`).
