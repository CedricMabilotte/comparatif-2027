#!/usr/bin/env bash
# Compare les fichiers de site/ de ce clone avec ceux servis sur republique.fr (lecture seule, rien n'est envoyé).
# À lancer avant tout déploiement : un écart signale un fichier modifié en ligne ou un clone en retard.
# Usage, depuis la racine du dépôt : bash scripts/comparer-en-ligne.sh [fichier relatif à site/ ...]
set -uo pipefail
cd "$(dirname "$0")/.."
FICHIERS=("$@"); [ ${#FICHIERS[@]} -gt 0 ] || FICHIERS=(index.html js/accueil.js style.css sitemap.xml corpus.json test/index.html test/test.js test/donnees.json)
ecarts=0
for f in "${FICHIERS[@]}"; do
  local_=$(sha256sum "site/$f" | cut -c1-16)
  enligne=$(curl -sf "https://republique.fr/$f?v=$RANDOM" | sha256sum | cut -c1-16)
  if [ "$local_" = "$enligne" ]; then echo "identique  $f"; else echo "ÉCART      $f"; ecarts=$((ecarts+1)); fi
done
[ "$ecarts" -eq 0 ] && echo "Tout est identique." || { echo "$ecarts écart(s) : ne pas déployer avant d'avoir compris pourquoi."; exit 1; }
