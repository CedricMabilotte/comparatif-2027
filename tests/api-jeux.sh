#!/usr/bin/env bash
# Test de bout en bout de la route des jeux : envoi des résultats du profil d'idées par e-mail.
# Vérifie l'envoi, les refus, la limite de débit, et que rien n'est enregistré en base.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); PORT=8797
cat > "$T/config.php" <<CONF
<?php return ['dsn' => 'sqlite:$T/test.sqlite', 'url_site' => 'http://localhost:$PORT', 'expediteur' => 'test <t@t>', 'envoi' => 'journal', 'sel' => 'test'];
CONF
mkdir -p "$T/racine"; ln -s "$ICI/api" "$T/racine/api"
JOURNAL="$ICI/api/courrier.log"; touch "$JOURNAL"; AVANT=$(wc -c < "$JOURNAL")
REPUBLIQUE_CONFIG="$T/config.php" php -S localhost:$PORT -t "$T/racine" >/dev/null 2>&1 & PID=$!
trap 'kill $PID; rm -rf "$T"' EXIT; sleep 1
A="http://localhost:$PORT/api/index.php"; ok=0; ko=0
verifie() { if [[ "$2" == *"$3"* ]]; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $1 : $2"; fi; }
post() { curl -s -H 'Content-Type: application/json' -d "$2" "$A?r=$1"; }
MARQUE="essai-$RANDOM-$RANDOM"
nouveau() { tail -c +$((AVANT + 1)) "$JOURNAL"; }

verifie "envoi" "$(post resultats-email "{\"email\":\"Lecteur@Exemple.fr\",\"resume\":\"ÉCOLOGIE\\n- Pour : « une idée » $MARQUE\"}")" '"ok":true'
verifie "courrier écrit" "$(nouveau)" "$MARQUE"
verifie "destinataire" "$(nouveau)" "À: lecteur@exemple.fr"
verifie "sujet" "$(nouveau)" "Sujet: Vos résultats : votre profil d'idées"
verifie "lien du site seul" "$(nouveau)" "http://localhost:$PORT/#jouer/profil"
verifie "adresse non gardée (message)" "$(nouveau)" "elle n'a pas été gardée"
verifie "adresse invalide" "$(post resultats-email '{"email":"pas-une-adresse","resume":"x"}')" 'invalide'
verifie "résumé vide" "$(post resultats-email '{"email":"a@exemple.fr","resume":"  "}')" 'vide'
verifie "lien refusé" "$(post resultats-email '{"email":"a@exemple.fr","resume":"Gagnez ! https://arnaque.example"}')" 'lien'
verifie "trop long" "$(post resultats-email "{\"email\":\"a@exemple.fr\",\"resume\":\"$(head -c 15001 /dev/zero | tr '\0' 'a')\"}")" 'trop long'
verifie "formulaire refusé" "$(curl -s -d 'email=a@exemple.fr' "$A?r=resultats-email")" 'JSON'
# Rien en base : ni l'adresse, ni le texte (seule la table des limites contient une empreinte).
verifie "rien en base" "$(php -r '$d=new PDO("sqlite:'"$T"'/test.sqlite"); $n=0; foreach($d->query("SELECT name FROM sqlite_master WHERE type=\"table\"")->fetchAll(PDO::FETCH_COLUMN) as $t){ foreach($d->query("SELECT * FROM \"$t\"")->fetchAll(PDO::FETCH_ASSOC) as $l){ $j=json_encode($l, JSON_UNESCAPED_UNICODE); if(stripos($j,"lecteur@exemple.fr")!==false||strpos($j,"'"$MARQUE"'")!==false) $n++; } } echo "trouvé:$n";')" 'trouvé:0'
for i in 1 2 3; do post resultats-email '{"email":"b@exemple.fr","resume":"r"}' >/dev/null; done
verifie "cinquième envoi accepté" "$(post resultats-email '{"email":"b@exemple.fr","resume":"r"}')" '"ok":true'
verifie "limite de débit" "$(post resultats-email '{"email":"b@exemple.fr","resume":"r"}')" 'Trop de demandes'
echo "$ok réussis, $ko échoués"; [ $ko -eq 0 ]
