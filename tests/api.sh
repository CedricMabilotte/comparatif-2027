#!/usr/bin/env bash
# Test de bout en bout de l'API sur SQLite : votes, lien magique, profil, abonnement.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); PORT=8799
cat > "$T/config.php" <<CONF
<?php return ['dsn' => 'sqlite:$T/test.sqlite', 'url_site' => 'http://localhost:$PORT', 'expediteur' => 'test <t@t>', 'envoi' => 'journal', 'sel' => 'test'];
CONF
php -r "\$db=new PDO('sqlite:$T/test.sqlite'); \$db->exec(file_get_contents('$ICI/api/schema.sql'));"
mkdir -p "$T/racine"; ln -s "$ICI/api" "$T/racine/api"
REPUBLIQUE_CONFIG="$T/config.php" php -S localhost:$PORT -t "$T/racine" >/dev/null 2>&1 & PID=$!
trap 'kill $PID; rm -rf "$T"; rm -f "$ICI/api/courrier.log"' EXIT; sleep 1
A="http://localhost:$PORT/api/index.php"; J="$T/cookies"; ok=0; ko=0
verifie() { if [[ "$2" == *"$3"* ]]; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $1 : $2"; fi; }
post() { curl -s -b "$J" -c "$J" -H 'Content-Type: application/json' -d "$2" "$A?r=$1"; }

verifie "vote" "$(post vote '{"proposition":"p001","valeur":"pour"}')" '"ok":true'
post vote '{"proposition":"p002","valeur":"contre"}' >/dev/null; post vote '{"proposition":"p003","valeur":"partage"}' >/dev/null
verifie "revote" "$(post vote '{"proposition":"p001","valeur":"contre"}')" '"ok":true'
verifie "valeur invalide" "$(post vote '{"proposition":"p001","valeur":"oui"}')" 'Valeur attendue'
verifie "formulaire refusé" "$(curl -s -d 'proposition=p001' "$A?r=vote")" 'JSON'
verifie "matrice" "$(curl -s -b "$J" "$A?r=votes")" '"moi":true,"votes":{"p001":-1,"p002":-1,"p003":0}'
verifie "sans consentement" "$(post lien-magique '{"email":"a@exemple.fr"}')" 'consentement'
verifie "lien magique" "$(post lien-magique '{"email":"A@Exemple.fr","consentement":true}')" '"ok":true'
LIEN=$(grep -o "http://[^ ]*r=connexion[^ ]*" "$ICI/api/courrier.log" | tail -1)
verifie "connexion" "$(curl -s -o /dev/null -w '%{redirect_url}' -b "$J" -c "$J" "$LIEN")" '#bienvenue'
verifie "jeton à usage unique" "$(curl -s -o /dev/null -w '%{redirect_url}' "$LIEN")" '#connexion-expiree'
verifie "moi" "$(curl -s -b "$J" "$A?r=moi")" '"connecte":true'
verifie "profil" "$(post profil '{"pseudo":"Lectrice 42","commune":{"insee":"75056","nom":"Paris"}}')" '"ok":true'
verifie "profil lu" "$(curl -s -b "$J" "$A?r=moi")" '"nom":"Paris"'
verifie "commune invalide" "$(post profil '{"commune":{"insee":"7505","nom":"x"}}')" 'invalide'
verifie "abonnement" "$(post abonnement '{"email":"b@exemple.fr"}')" '"ok":true'
CONF_L=$(grep -o "http://[^ ]*r=confirmer[^ ]*" "$ICI/api/courrier.log" | tail -1)
verifie "confirmation" "$(curl -s -o /dev/null -w '%{redirect_url}' "$CONF_L")" '#abonnement-confirme'
verifie "déconnexion" "$(post deconnexion '{}')" '"ok":true'
verifie "moi après" "$(curl -s -b "$J" "$A?r=moi")" '"connecte":false'
for i in 1 2 3 4; do post lien-magique '{"email":"c@exemple.fr","consentement":true}' >/dev/null; done
verifie "limite de débit" "$(post lien-magique '{"email":"c@exemple.fr","consentement":true}')" 'Trop de demandes'
echo "$ok réussis, $ko échoués"; [ $ko -eq 0 ]
