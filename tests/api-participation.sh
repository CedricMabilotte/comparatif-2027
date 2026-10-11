#!/usr/bin/env bash
# Test de bout en bout de la participation encadrée sur SQLite : question sous un concept, signalement,
# mot proposé, lettre avec fréquence, cercles, limite de débit, modération, publication, journal public.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); PORT=8797
LOG="$ICI/api/courrier.log"; touch "$LOG"; DEBUT=$(wc -l < "$LOG")
cat > "$T/config.php" <<CONF
<?php return ['dsn' => 'sqlite:$T/test.sqlite', 'url_site' => 'http://localhost:$PORT', 'expediteur' => 'test <t@t>', 'envoi' => 'journal', 'sel' => 'test', 'moderateurs' => ['moderation@exemple.fr']];
CONF
mkdir -p "$T/racine"; ln -s "$ICI/api" "$T/racine/api"
REPUBLIQUE_CONFIG="$T/config.php" php -S localhost:$PORT -t "$T/racine" >/dev/null 2>&1 & PID=$!
trap 'kill $PID; rm -rf "$T"' EXIT; sleep 1
A="http://localhost:$PORT/api/index.php"; ok=0; ko=0
verifie() { if [[ "$2" == *"$3"* ]]; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $1 : $2"; fi; }
absent() { if [[ "$2" != *"$3"* ]]; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $1 : « $3 » ne devrait pas figurer dans $2"; fi; }
# post <jarre de cookies> <route> <json>
post() { curl -s -b "$1" -c "$1" -H 'Content-Type: application/json' -d "$3" "$A?r=$2"; }
get() { curl -s -b "$1" -c "$1" "$A?r=$2"; }
nouveau_courrier() { tail -n +$((DEBUT + 1)) "$LOG"; }
connecter() { # connecte la jarre $1 avec l'adresse $2
  post "$1" lien-magique "{\"email\":\"$2\",\"consentement\":true}" >/dev/null
  local l; l=$(nouveau_courrier | grep -o "http://[^ ]*r=connexion[^ ]*" | tail -1)
  curl -s -o /dev/null -b "$1" -c "$1" "$l"
}
V="$T/visiteur"; M="$T/moderation"; X="$T/autre"

# Envois des visiteurs
verifie "réponse" "$(post $V reponse '{"cible":"notion:gpa","texte":"Un exemple <b>concret</b> de pays où c est autorisé.","pseudo":"Lectrice","duree":9000}')" '"ok":true'
verifie "réponse vide" "$(post $V reponse '{"cible":"notion:gpa","texte":"   "}')" 'nécessaire'
verifie "réponse trop longue" "$(post $V reponse "{\"cible\":\"notion:gpa\",\"texte\":\"$(printf 'a%.0s' {1..1001})\"}")" '1000 caractères'
verifie "fiche inconnue" "$(post $V reponse '{"cible":"autre:x","texte":"bonjour"}')" 'Fiche inconnue'
verifie "formulaire refusé" "$(curl -s -d 'cible=notion:gpa&texte=x' "$A?r=reponse")" 'JSON'
verifie "piège : réponse muette" "$(post $V reponse '{"cible":"notion:gpa","texte":"spam","site":"http://spam"}')" '"ok":true'
verifie "rien de publié avant relecture" "$(get $V 'reponses&cible=notion:gpa')" '"reponses":[]'
verifie "signalement" "$(post $V signalement '{"cible":"terme:choc-des-savoirs","nature":"citation","texte":"La citation est tronquée.","email":"lecteur@exemple.fr","duree":5000}')" '"ok":true'
verifie "nature inconnue" "$(post $V signalement '{"cible":"terme:choc-des-savoirs","nature":"x","texte":"y"}')" 'nature'
verifie "adresse invalide" "$(post $V signalement '{"cible":"parti:rn","nature":"autre","texte":"y","email":"pas-une-adresse"}')" 'invalide'
verifie "signalement 2" "$(post $V signalement '{"cible":"parti:rn","nature":"neutralite","texte":"Le mot « radical » est évaluatif."}')" '"ok":true'
verifie "mot proposé" "$(post $V suggestion '{"terme":"Péréquation","texte":"Revient souvent dans les débats sur les communes.","lieu":"Programmes municipaux","email":"curieux@exemple.fr"}')" '"ok":true'
verifie "mot sans terme" "$(post $V suggestion '{"texte":"x"}')" 'Terme'
verifie "rien de proposé publié" "$(get $V suggestions)" '"suggestions":[]'
verifie "journal vide" "$(get $V corrections)" '"attente":2'

# Limite de débit : 10 contributions par heure et par adresse IP (5 déjà comptées, piège compris ;
# les envois invalides sont refusés avant d'être comptés)
for i in 1 2 3 4 5; do post $V reponse '{"cible":"notion:gpa","texte":"encore"}' >/dev/null; done
verifie "limite de débit" "$(post $V reponse '{"cible":"notion:gpa","texte":"une de trop"}')" 'Trop de demandes'

# Lettre avec fréquence
verifie "lettre quotidienne" "$(post $X lettre '{"email":"lettre@exemple.fr","frequence":"jour"}')" '"ok":true'
verifie "e-mail de la lettre" "$(nouveau_courrier | grep -A6 'lettre@exemple.fr')" 'chaque matin'
verifie "fréquence inconnue" "$(post $X lettre '{"email":"lettre@exemple.fr","frequence":"mois"}')" 'fréquence'
C_L=$(nouveau_courrier | grep -o "http://[^ ]*r=confirmer[^ ]*" | tail -1)
verifie "confirmation" "$(curl -s -o /dev/null -w '%{redirect_url}' "$C_L")" '#abonnement-confirme'

# Modération : refusée aux visiteurs, ouverte au compte modérateur
verifie "modération sans compte" "$(get $X moderation)" 'Connectez-vous'
connecter $X "simple@exemple.fr"
verifie "modération non modérateur" "$(get $X moderation)" 'Réservé à la modération'
verifie "cercle" "$(post $X cercle '{"cercle":"lexique"}')" '"ok":true'
verifie "cercles comptés" "$(get $X cercles)" '"lexique":1'
verifie "commune libre" "$(post $X profil-commune '{"nom":"Saint-Étienne (42)"}')" '"ok":true'
verifie "commune lue" "$(get $X moi)" 'Saint-Étienne (42)'
connecter $M "moderation@exemple.fr"
FILE=$(get $M moderation)
verifie "file" "$FILE" '"attente":['
verifie "adresse visible en modération" "$FILE" 'lecteur@exemple.fr'
absent "piège non enregistré" "$FILE" 'spam'
id_de() { php -r '$d = json_decode(stream_get_contents(STDIN), true); foreach ($d["attente"] as $c) if (str_contains($c["texte"], $argv[1])) { echo $c["id"]; exit; }' "$1" <<< "$FILE"; }
R1=$(id_de "concret"); S1=$(id_de "tronquée"); S2=$(id_de "radical"); P1=$(id_de "communes")
verifie "action impossible" "$(post $M moderer "{\"id\":\"$R1\",\"action\":\"corrige\"}")" 'Action impossible'
verifie "publier" "$(post $M moderer "{\"id\":\"$R1\",\"action\":\"publier\",\"reponse\":\"Voir la section Repères.\"}")" '"etat":"publie"'
R=$(get $V 'reponses&cible=notion:gpa')
verifie "réponse publiée" "$R" 'concret'
verifie "réponse de la modération" "$R" 'Voir la section Repères.'
absent "aucune adresse publique" "$R" '@'
verifie "note obligatoire" "$(post $M moderer "{\"id\":\"$S1\",\"action\":\"corrige\"}")" 'note publique'
verifie "corrigé" "$(post $M moderer "{\"id\":\"$S1\",\"action\":\"corrige\",\"reponse\":\"Citation complétée d'après la page 12.\"}")" '"etat":"corrige"'
verifie "signaleur prévenu" "$(nouveau_courrier | grep -A6 'À: lecteur@exemple.fr')" 'a été corrigée'
verifie "non retenu" "$(post $M moderer "{\"id\":\"$S2\",\"action\":\"non_retenu\",\"reponse\":\"Le mot figure dans la citation, pas dans notre texte.\"}")" '"etat":"non_retenu"'
J=$(get $V corrections)
verifie "journal : correction" "$J" "Citation complétée"
verifie "journal : non retenu" "$J" '"etat":"non_retenu"'
verifie "journal : compteurs" "$J" '"corrige":1,"non_retenu":1'
absent "journal sans texte du visiteur" "$J" 'tronquée'
absent "journal sans adresse" "$J" 'lecteur@'
verifie "mot en rédaction" "$(post $M moderer "{\"id\":\"$P1\",\"action\":\"redaction\"}")" '"etat":"redaction"'
verifie "proposé visible" "$(get $V suggestions)" '"terme":"Péréquation"'
absent "proposé sans adresse" "$(get $V suggestions)" 'curieux@'
verifie "mot ajouté" "$(post $M moderer "{\"id\":\"$P1\",\"action\":\"ajoute\"}")" '"etat":"ajoute"'
verifie "proposeur prévenu" "$(nouveau_courrier | grep -A6 'À: curieux@exemple.fr' | tail -7)" 'a maintenant sa fiche'
verifie "adresse effacée après" "$(get $M moderation)" '"email":null'
echo "$ok réussis, $ko échoués"; [ $ko -eq 0 ]
