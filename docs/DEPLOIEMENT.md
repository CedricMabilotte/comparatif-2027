# Mise en ligne sur Gandi Simple Hosting

Cible : l'instance Simple Hosting existante (PHP + base de données), un vhost `republique.fr` et `www.republique.fr`.

## Contenu déployé
- `site/` → racine du vhost (`htdocs/`) : page, `corpus.json`, `consensus.js`.
- `api/` → `htdocs/api/` : `index.php`, `schema.sql`, et un `config.php` créé sur le serveur (jamais versionné, voir `config.exemple.php`).

## Étapes
1. Créer la base (MySQL/MariaDB de l'instance) et importer `api/schema.sql`.
2. Créer `htdocs/api/config.php` avec le DSN, un `sel` aléatoire et `envoi => 'mail'`.
3. Créer les vhosts `republique.fr` et `www.republique.fr` sur l'instance.
4. DNS (LiveDNS) : créer la zone, puis `@ A` vers l'IP du frontal Simple Hosting et `www CNAME` vers l'hôte de l'instance. Écrire `@ A` par `PUT /livedns/.../records/@/A`, jamais `/records/@` (écraserait MX et SPF).
5. Vérifier l'envoi d'e-mails (lien magique) depuis l'instance ; à défaut, brancher un SMTP.
6. Tester : `curl https://republique.fr/api/index.php?r=moi` doit répondre `{"connecte":false,...}`.

## Données personnelles
- Les votes sont liés à un identifiant aléatoire (`votants`), le lien avec un compte est dans `liens_votants`.
- La table `abonnes` sert de liste de diffusion en attendant l'outil d'envoi (phpList ou Listmonk, décision en cours).
- Purger régulièrement `jetons`, `sessions` expirées et `abonnes` non confirmés depuis plus de 7 jours.
