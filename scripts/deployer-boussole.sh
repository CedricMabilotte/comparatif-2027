#!/usr/bin/env bash
# Met en ligne le test « boussole d'idées » sur republique.fr (Gandi Simple Hosting, SFTP) depuis ce clone.
# N'envoie que site/test/ et les trois fichiers du site qu'il modifie ; ne touche jamais api/config.php.
# Usage, depuis la racine du dépôt : bash scripts/deployer-boussole.sh
# Variables facultatives : CLE (clé SSH, défaut ~/.ssh/id_freechi_rsa), INSTANCE (identifiant de l'instance Gandi).
set -euo pipefail
cd "$(dirname "$0")/.."
CLE="${CLE:-$HOME/.ssh/id_freechi_rsa}"
INSTANCE="${INSTANCE:-cebe488a-38bf-11ec-bef2-00163e9db362}"
RACINE=/vhosts/republique.fr/htdocs
[ -f site/test/index.html ] && [ -f site/test/og/test.png ] || { echo "site/test/ incomplet : êtes-vous sur la bonne branche ?" >&2; exit 1; }

lot=$(mktemp)
{
  echo "-mkdir $RACINE/test"
  echo "-mkdir $RACINE/test/p"
  echo "-mkdir $RACINE/test/og"
  for f in index.html etoile.js test.js test.css archivo.css donnees.json; do echo "put site/test/$f $RACINE/test/$f"; done
  echo "-mkdir $RACINE/polices"
  echo "put site/polices/Archivo-var-latin.woff2 $RACINE/polices/Archivo-var-latin.woff2"
  echo "put site/polices/Archivo-var-latin-ext.woff2 $RACINE/polices/Archivo-var-latin-ext.woff2"
  echo "put site/test/p/* $RACINE/test/p/"
  echo "put site/test/og/* $RACINE/test/og/"
  echo "put site/js/accueil.js $RACINE/js/accueil.js"
  echo "put site/style.css $RACINE/style.css"
  echo "put site/sitemap.xml $RACINE/sitemap.xml"
} > "$lot"
echo "Envoi vers republique.fr (environ 170 fichiers)…"
sftp -q -i "$CLE" -o BatchMode=yes -b "$lot" "$INSTANCE@sftp.sd6.gpaas.net" >/dev/null
rm -f "$lot"

echo "Vérification :"
for u in / /test/ /test/archivo.css /polices/Archivo-var-latin.woff2 /test/donnees.json /test/p/aabb.html /test/og/aabb.png; do
  printf '  %-22s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "https://republique.fr$u?v=$RANDOM")"
done
echo "Terminé. Le test : https://republique.fr/test/"
