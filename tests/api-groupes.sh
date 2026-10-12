#!/usr/bin/env bash
# Test de bout en bout des routes « Groupes » sur SQLite : salle, deux participants, pilotage,
# résultats, expiration, réseau d'animateurs, déclaration de séance, modération, retours.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); PORT=8798
cat > "$T/config.php" <<CONF
<?php return ['dsn' => 'sqlite:$T/test.sqlite', 'url_site' => 'http://localhost:$PORT', 'expediteur' => 'test <t@t>', 'envoi' => 'journal', 'sel' => 'test',
  'moderateurs' => ['moderation@exemple.fr'], 'geo_api' => 'http://localhost:$PORT/geo'];
CONF
# Faux service de géographie : le test ne dépend d'aucun réseau extérieur.
mkdir -p "$T/racine/geo/communes"; ln -s "$ICI/api" "$T/racine/api"
cat > "$T/racine/geo/communes/index.php" <<'GEO'
<?php header('Content-Type: application/json');
echo ($_GET['nom'] ?? '') === 'rennes' ? '[{"nom":"Rennes","centre":{"type":"Point","coordinates":[-1.68,48.11]},"region":{"code":"53","nom":"Bretagne"}}]' : '[]';
GEO
PHP_CLI_SERVER_WORKERS=4 REPUBLIQUE_CONFIG="$T/config.php" php -S localhost:$PORT -t "$T/racine" >/dev/null 2>&1 & PID=$!
trap 'kill $PID; rm -rf "$T"; rm -f "$ICI/api/courrier.log"' EXIT; sleep 1
A="http://localhost:$PORT/api/index.php"; ok=0; ko=0
verifie() { if [[ "$2" == *"$3"* ]]; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $1 : $2"; fi; }
post() { curl -s -b "$T/$1" -c "$T/$1" -H 'Content-Type: application/json' -d "$3" "$A?r=$2"; }
get() { curl -s -b "$T/$1" -c "$T/$1" "$A?r=$2"; }
champ() { php -r 'echo json_decode(stream_get_contents(STDIN), true)[$argv[1]] ?? "";' "$1"; }

# Salle : création, code lisible, clé secrète
R=$(post anim seance '{"seance":"aveugle","titre":"Médiathèque test","items":["p27a1058e","p042bcf5e","p70aecf38","n:educations-a"]}')
verifie "création" "$R" '"ok":true'
CODE=$(echo "$R" | champ code); CLE=$(echo "$R" | champ cle)
[[ "$CODE" =~ ^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$ ]] && ok=$((ok+1)) || { ko=$((ko+1)); echo "ÉCHEC code lisible : $CODE"; }
verifie "type inconnu" "$(post anim seance '{"seance":"meeting","items":["p27a1058e"]}')" 'Type de séance'
verifie "élément invalide" "$(post anim seance '{"seance":"libre","items":["<script>"]}')" 'Élément inconnu'
verifie "état initial" "$(get p1 "seance&code=$CODE")" '"rang":-1'
verifie "code minuscule accepté" "$(get p1 "seance&code=${CODE,,}")" "\"code\":\"$CODE\""
verifie "code invalide" "$(get p1 'seance&code=AB0O1')" 'invalide'
verifie "salle inconnue" "$(get p1 'seance&code=ZZZZZ')" 'expiré'

# Participants : rejoindre est explicite, puis vote sur l'élément présenté
verifie "vote sans rejoindre" "$(post p1 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"pour\"}")" 'pas encore été présentée'
# p1 coche la case « carte nationale », p2 non (case décochée par défaut)
verifie "rejoindre p1" "$(post p1 seance-rejoindre "{\"code\":\"$CODE\",\"carte\":true}")" '"participants":1'
verifie "accord p1" "$(get p1 "seance&code=$CODE")" '"carte":true'
verifie "rejoindre p2" "$(post p2 seance-rejoindre "{\"code\":\"$CODE\"}")" '"participants":2'
verifie "sans accord p2" "$(get p2 "seance&code=$CODE")" '"carte":false'
verifie "mauvaise clé" "$(post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"faux\",\"action\":\"suivant\"}")" 'ne pilote pas'
verifie "suivant" "$(post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"suivant\"}")" '"item":"p27a1058e"'
verifie "vote étranger" "$(post p3 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"pour\"}")" 'Rejoignez'
verifie "vote p1" "$(post p1 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"pour\"}")" '"ok":true'
verifie "vote p2" "$(post p2 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"contre\"}")" '"ok":true'
verifie "vote futur" "$(post p2 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p042bcf5e\",\"valeur\":\"contre\"}")" 'pas encore'
verifie "valeur invalide" "$(post p2 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"oui\"}")" 'Valeur attendue'
E=$(get p1 "seance&code=$CODE"); verifie "votes reçus" "$E" '"votes_item":2'; verifie "mon vote" "$E" '"mon_vote":"pour"'
verifie "révéler" "$(post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"reveler\"}")" '"revele":true'
verifie "avancer masque" "$(post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"suivant\"}")" '"revele":false'
post p1 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p042bcf5e\",\"valeur\":\"partage\"}" >/dev/null
post p2 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p042bcf5e\",\"valeur\":\"partage\"}" >/dev/null
post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"suivant\"}" >/dev/null
post p1 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p70aecf38\",\"valeur\":\"contre\"}" >/dev/null
verifie "revote" "$(post p1 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"partage\"}")" '"ok":true'
verifie "fin de liste" "$(post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"aller\",\"rang\":99}")" '"item":"n:educations-a"'

# Résultats de salle et carte globale
RES=$(get p1 "seance-resultats&code=$CODE")
verifie "décompte p1" "$RES" '"p27a1058e":{"pour":0,"partage":1,"contre":1}'
verifie "décompte p2" "$RES" '"p042bcf5e":{"pour":0,"partage":2,"contre":0}'
verifie "matrice de salle" "$RES" '"moi":true,"votes":{'
verifie "pas d'identifiant" "$(echo "$RES" | grep -c votant_id || true)" '0'
G=$(get p1 votes); verifie "carte globale" "$G" '"moi":true'; verifie "vote de salle global" "$G" '"p70aecf38":-1'
verifie "votes de p2 restés dans la salle" "$(php -r '$d = new PDO("sqlite:" . $argv[1]); echo $d->query("SELECT COUNT(*) FROM votes")->fetchColumn();' "$T/test.sqlite")" '3'

# Clôture, puis expiration après 30 jours (nettoyée à la création d'une autre salle)
verifie "clore" "$(post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"clore\"}")" '"etat":"close"'
verifie "vote après clôture" "$(post p1 seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p27a1058e\",\"valeur\":\"pour\"}")" 'close'
verifie "résultats après clôture" "$(get p2 "seance-resultats&code=$CODE")" '"etat":"close"'
php -r '$d = new PDO("sqlite:" . $argv[1]); $d->exec("UPDATE salles SET expire_le = \"2020-01-01T00:00:00Z\"");' "$T/test.sqlite"
post anim seance '{"seance":"mots","items":["t:assainir-les-finances-publiques"]}' >/dev/null
verifie "salle expirée" "$(get p1 "seance&code=$CODE")" 'expiré'
verifie "votes de salle effacés" "$(php -r '$d = new PDO("sqlite:" . $argv[1]); echo $d->query("SELECT COUNT(*) FROM salle_votes")->fetchColumn(), "/", $d->query("SELECT COUNT(*) FROM votes")->fetchColumn();' "$T/test.sqlite")" '0/3'

# Réseau d'animateurs : inscription confirmée par e-mail, désinscription
verifie "inscription sans public" "$(post x animateur-inscription '{"email":"anim@exemple.fr"}')" 'public'
verifie "inscription" "$(post x animateur-inscription '{"email":"Anim@Exemple.fr","public":"bibliotheques","commune":"Rennes"}')" '"ok":true'
L=$(grep -o "http://[^ ]*r=animateur-confirmer[^ ]*" "$ICI/api/courrier.log" | tail -1)
verifie "confirmation" "$(curl -s -o /dev/null -w '%{redirect_url}' "$L")" '#groupes/animer/confirme'
verifie "jeton unique" "$(curl -s -o /dev/null -w '%{redirect_url}' "$L")" '#groupes/animer/expire'
D=$(grep -o "http://[^ ]*r=animateur-desinscrire[^ ]*" "$ICI/api/courrier.log" | tail -1)
verifie "désinscription" "$(curl -s -o /dev/null -w '%{redirect_url}' "$D")" '#groupes/animer/desinscrit'

# Déclaration de séance : modérée avant publication
verifie "déclaration en salle" "$(post x seance-declarer '{"date":"2027-03-12","mode":"salle","commune":"rennes","departement":"35","public":"bibliotheques","seance":"aveugle","organisateur":"Médiathèque des Champs Libres","organisateur_public":true,"lien":"https://mobilizon.fr/events/x","email":"orga@exemple.fr"}')" '"ok":true'
verifie "déclaration en ligne" "$(post x seance-declarer '{"date":"2027-01-20","mode":"ligne","public":"visio","seance":"mots","organisateur":"Jean Dupont","email":"jd@exemple.fr"}')" '"ok":true'
verifie "commune hors base" "$(post x seance-declarer '{"date":"2026-11-02","mode":"salle","commune":"Plouc-sur-Mer","departement":"29","public":"collectifs","seance":"concept","email":"c@exemple.fr"}')" '"ok":true'
verifie "adresse refusée" "$(post y seance-declarer '{"date":"2027-03-12","mode":"salle","commune":"12, rue de la Paix","departement":"75","public":"proches","seance":"aveugle","email":"o@exemple.fr"}')" 'sans adresse'
verifie "département inconnu" "$(post y seance-declarer '{"date":"2027-03-12","mode":"salle","commune":"Paris","departement":"99","public":"proches","seance":"aveugle","email":"o@exemple.fr"}')" 'Département'
verifie "lien non https" "$(post y seance-declarer '{"date":"2027-03-12","mode":"ligne","public":"proches","seance":"aveugle","lien":"javascript:alert(1)","email":"o@exemple.fr"}')" 'https'
verifie "rien de publié" "$(get x seances-publiques)" '"seances":[]'
verifie "modération anonyme" "$(get x moderation-groupes)" 'Connectez-vous'
post mod lien-magique '{"email":"moderation@exemple.fr","consentement":true}' >/dev/null
curl -s -o /dev/null -b "$T/mod" -c "$T/mod" "$(grep -o "http://[^ ]*r=connexion[^ ]*" "$ICI/api/courrier.log" | tail -1)"
M=$(get mod moderation-groupes)
verifie "liste à modérer" "$M" '"statut":"attente"'
verifie "localisation" "$M" '"lat":48.11'
verifie "centre de région" "$M" '"region":"Bretagne","lat":48.2'
ID=$(echo "$M" | php -r 'foreach (json_decode(stream_get_contents(STDIN), true)["seances"] as $s) if ($s["commune"] === "Rennes") echo $s["id"];')
ID2=$(echo "$M" | php -r 'foreach (json_decode(stream_get_contents(STDIN), true)["seances"] as $s) if ($s["mode"] === "ligne") echo $s["id"];')
verifie "publier" "$(post mod moderation-groupes "{\"id\":\"$ID\",\"decision\":\"publier\"}")" '"statut":"publiee"'
post mod moderation-groupes "{\"id\":\"$ID2\",\"decision\":\"publier\"}" >/dev/null
P=$(get x seances-publiques)
verifie "publiée" "$P" '"commune":"Rennes"'
verifie "structure publique" "$P" '"organisateur":"Médiathèque des Champs Libres"'
verifie "nom non public masqué" "$(echo "$P" | grep -c 'Jean Dupont' || true)" '0'
verifie "e-mail jamais publié" "$(echo "$P" | grep -c 'exemple.fr' || true)" '0'
verifie "refuser" "$(post mod moderation-groupes "{\"id\":\"$ID\",\"decision\":\"refuser\"}")" '"statut":"refusee"'
verifie "retirée" "$(get x seances-publiques | grep -c Rennes || true)" '0'
post autre lien-magique '{"email":"curieux@exemple.fr","consentement":true}' >/dev/null
curl -s -o /dev/null -b "$T/autre" -c "$T/autre" "$(grep -o "http://[^ ]*r=connexion[^ ]*" "$ICI/api/courrier.log" | tail -1)"
verifie "non modérateur" "$(get autre moderation-groupes)" 'Réservé'

# Retour d'expérience : visible par la modération seulement
verifie "retour vide" "$(post x retour-seance '{"seance":"aveugle","reponses":{}}')" 'au moins'
verifie "retour" "$(post x retour-seance "{\"seance\":\"aveugle\",\"code\":\"$CODE\",\"reponses\":{\"participants\":\"14\",\"reussi\":\"La révélation des auteurs\",\"neutralite\":\"Oui\"}}")" '"ok":true'
verifie "retour lu" "$(get mod moderation-groupes)" 'La révélation des auteurs'

# Limite de débit à l'ouverture des salles
for i in $(seq 1 18); do post z seance '{"seance":"libre","items":["p27a1058e"]}' >/dev/null; done
verifie "limite de débit" "$(post z seance '{"seance":"libre","items":["p27a1058e"]}')" 'Trop de demandes'

echo "$ok réussis, $ko échoués"; [ $ko -eq 0 ]
