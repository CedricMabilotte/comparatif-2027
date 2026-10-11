#!/usr/bin/env bash
# Test de bout en bout des droits des personnes sur SQLite : mes données, effacement des votes,
# sauvegarde, suppression du compte, désinscription de la lettre, accord pour la carte nationale
# en séance, purge automatique.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); T=$(mktemp -d); PORT=8796
cat > "$T/config.php" <<CONF
<?php return ['dsn' => 'sqlite:$T/test.sqlite', 'url_site' => 'http://localhost:$PORT', 'expediteur' => 'test <t@t>', 'envoi' => 'journal', 'sel' => 'test',
  'moderateurs' => ['moderation@exemple.fr']];
CONF
mkdir -p "$T/racine"; ln -s "$ICI/api" "$T/racine/api"
REPUBLIQUE_CONFIG="$T/config.php" php -S localhost:$PORT -t "$T/racine" >/dev/null 2>&1 & PID=$!
trap 'kill $PID; rm -rf "$T"; rm -f "$ICI/api/courrier.log"' EXIT; sleep 1
A="http://localhost:$PORT/api/index.php"; ok=0; ko=0
verifie() { if [[ "$2" == *"$3"* ]]; then ok=$((ok+1)); else ko=$((ko+1)); echo "ÉCHEC $1 : $2"; fi; }
post() { curl -s -b "$T/$1" -c "$T/$1" -H 'Content-Type: application/json' -d "$3" "$A?r=$2"; }
get() { curl -s -b "$T/$1" -c "$T/$1" "$A?r=$2"; }
code() { curl -s -o /dev/null -w '%{http_code}' -b "$T/$1" -c "$T/$1" -H 'Content-Type: application/json' -d "$3" "$A?r=$2"; }
sql() { php -r '$d = new PDO("sqlite:" . $argv[1]); $r = $d->query($argv[2]); echo $r ? implode("|", $r->fetchAll(PDO::FETCH_COLUMN)) : "";' "$T/test.sqlite" "$1"; }
connecter() { post "$1" lien-magique "{\"email\":\"$2\",\"consentement\":true}" >/dev/null
  curl -s -o /dev/null -b "$T/$1" -c "$T/$1" "$(grep -o "http://[^ ]*r=connexion[^ ]*" "$ICI/api/courrier.log" | tail -1)"; }

# Visiteur sans compte : ses votes, puis leur effacement
verifie "mes données vides" "$(get anon mes-donnees)" '"compte":null,"votes":[],"contributions":[],"abonnement":null,"cercles":[]'
for p in p001 p002 p003; do post anon vote "{\"proposition\":\"$p\",\"valeur\":\"pour\"}" >/dev/null; done
verifie "mes votes" "$(get anon mes-donnees)" '{"proposition":"p001","valeur":"pour","le":"'
verifie "effacer sans JSON" "$(curl -s -b "$T/anon" -d 'x' "$A?r=effacer-votes")" 'JSON'
verifie "effacer mes votes" "$(post anon effacer-votes '{}')" '"ok":true,"n":3'
verifie "votes effacés" "$(get anon mes-donnees)" '"votes":[]'
verifie "sans cookie" "$(post vide effacer-votes '{}')" '"n":0'

# Sauvegarde et suppression : réservées aux comptes
verifie "sauvegarde anonyme" "$(get anon sauvegarde)" 'Connectez-vous'
verifie "sauvegarde anonyme 401" "$(code anon sauvegarde '{"donnees":{}}')" '401'
verifie "suppression anonyme 401" "$(code anon supprimer-compte '{}')" '401'

# Un compte avec des votes, un profil, la lettre, un cercle et une contribution publiée
connecter moi 'Moi@Exemple.fr'
post moi vote '{"proposition":"p004","valeur":"contre"}' >/dev/null
post moi vote '{"proposition":"p005","valeur":"partage"}' >/dev/null
post moi profil '{"pseudo":"Lectrice 7"}' >/dev/null
post moi profil-commune '{"nom":"Quimper"}' >/dev/null
post moi lettre '{"email":"moi@exemple.fr","frequence":"jour"}' >/dev/null
post moi cercle '{"cercle":"lexique"}' >/dev/null
post moi reponse '{"cible":"notion:laicite","texte":"Un exemple concret manque.","pseudo":"Lectrice 7"}' >/dev/null
connecter mod 'moderation@exemple.fr'
ID=$(get mod moderation | php -r 'foreach (json_decode(stream_get_contents(STDIN), true)["attente"] as $c) if ($c["genre"] === "reponse") echo $c["id"];')
post mod moderer "{\"id\":\"$ID\",\"action\":\"publier\"}" >/dev/null
M=$(get moi mes-donnees)
verifie "compte" "$M" '"compte":{"email":"moi@exemple.fr","pseudo":"Lectrice 7","commune":"Quimper","cree_le":"'
verifie "votes du compte" "$M" '{"proposition":"p004","valeur":"contre"'
verifie "contributions" "$M" '"contributions":[{"genre":"reponse","cible":"notion:laicite","texte":"Un exemple concret manque.","etat":"publie"'
verifie "abonnement" "$M" '"abonnement":{"frequence":"jour","confirme":false}'
verifie "cercles" "$M" '"cercles":["lexique"]'

# Sauvegarde : objet JSON, 200 Ko au plus
verifie "sauvegarde vide" "$(get moi sauvegarde)" '"donnees":null'
verifie "sauvegarde" "$(post moi sauvegarde '{"donnees":{"votes":{"p001":"pour"},"vide":{}}}')" '"ok":true,"le":"'
verifie "sauvegarde relue" "$(get moi sauvegarde)" '"donnees":{"votes":{"p001":"pour"},"vide":{}},"le":"'
verifie "pas un objet" "$(post moi sauvegarde '{"donnees":[1,2]}')" 'objet'
php -r 'echo json_encode(["donnees" => ["x" => str_repeat("a", 210000)]]);' > "$T/gros.json"
verifie "trop volumineuse" "$(code moi sauvegarde @"$T/gros.json")" '413'

# Désinscription de la lettre : lien présent dans le message de confirmation
D=$(grep -o "http://[^ ]*r=desinscription[^ ]*" "$ICI/api/courrier.log" | tail -1)
verifie "lien de désinscription" "$D" 'jeton='
verifie "jeton inconnu" "$(curl -s -o /dev/null -w '%{redirect_url}' "$A?r=desinscription&jeton=faux")" '#desinscrit'
verifie "toujours abonnée" "$(sql "SELECT COUNT(*) FROM abonnes WHERE email = 'moi@exemple.fr'")" '1'
verifie "désinscription" "$(curl -s -o /dev/null -w '%{redirect_url}' "$D")" '#desinscrit'
verifie "adresse effacée" "$(sql "SELECT COUNT(*) FROM abonnes WHERE email = 'moi@exemple.fr'")" '0'
post moi lettre '{"email":"moi@exemple.fr","frequence":"semaine"}' >/dev/null
verifie "même lien à chaque message" "$(grep -o "http://[^ ]*r=desinscription[^ ]*" "$ICI/api/courrier.log" | tail -1)" "$D"

# Suppression du compte : tout part, sauf le texte publié, désormais sans auteur
IDC=$(sql "SELECT id FROM comptes WHERE email = 'moi@exemple.fr'")
verifie "suppression" "$(post moi supprimer-compte '{}')" '"ok":true'
verifie "déconnecté" "$(get moi moi)" '"connecte":false'
verifie "plus de compte" "$(get moi mes-donnees)" '"compte":null,"votes":[]'
verifie "tables vidées" "$(sql "SELECT (SELECT COUNT(*) FROM comptes WHERE id = '$IDC') + (SELECT COUNT(*) FROM sessions WHERE compte_id = '$IDC') + (SELECT COUNT(*) FROM liens_votants WHERE compte_id = '$IDC') + (SELECT COUNT(*) FROM sauvegardes) + (SELECT COUNT(*) FROM cercles_interets) + (SELECT COUNT(*) FROM abonnes WHERE email = 'moi@exemple.fr') + (SELECT COUNT(*) FROM votes WHERE proposition_id IN ('p004', 'p005'))")" '0'
verifie "texte publié gardé" "$(sql "SELECT texte || '/' || COALESCE(compte_id, '-') || '/' || COALESCE(pseudo, '-') || '/' || COALESCE(email, '-') FROM contributions WHERE id = '$ID'")" 'Un exemple concret manque./-/-/-'
verifie "toujours publié" "$(get x 'reponses&cible=notion:laicite')" 'Un exemple concret manque.'

# Séance : les votes restent dans la salle sauf accord explicite, retirable
R=$(post anim seance '{"seance":"aveugle","items":["p0aa1","p0aa2"]}')
CODE=$(echo "$R" | php -r 'echo json_decode(stream_get_contents(STDIN), true)["code"];'); CLE=$(echo "$R" | php -r 'echo json_decode(stream_get_contents(STDIN), true)["cle"];')
post anim seance-piloter "{\"code\":\"$CODE\",\"cle\":\"$CLE\",\"action\":\"suivant\"}" >/dev/null
verifie "rejoindre sans accord" "$(post el seance-rejoindre "{\"code\":\"$CODE\"}")" '"carte":false'
verifie "vote de salle" "$(post el seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p0aa1\",\"valeur\":\"pour\"}")" '"carte":false'
verifie "resté dans la salle" "$(sql "SELECT COUNT(*) FROM votes WHERE proposition_id = 'p0aa1'")" '0'
verifie "accord coché" "$(post el seance-vote "{\"code\":\"$CODE\",\"proposition\":\"p0aa1\",\"valeur\":\"contre\",\"carte\":true}")" '"carte":true'
verifie "versé à la carte" "$(sql "SELECT valeur FROM votes WHERE proposition_id = 'p0aa1'")" '-1'
verifie "accord retiré" "$(post el seance-rejoindre "{\"code\":\"$CODE\",\"carte\":false}")" '"carte":false'
verifie "retiré de la carte" "$(sql "SELECT COUNT(*) FROM votes WHERE proposition_id = 'p0aa1'")" '0'
verifie "gardé dans la salle" "$(sql "SELECT COUNT(*) FROM salle_votes WHERE proposition_id = 'p0aa1'")" '1'

# Purge automatique, au plus une fois par heure
php -r '$d = new PDO("sqlite:" . $argv[1]);
  $d->exec("INSERT INTO jetons (empreinte, usage, email, expire_le) VALUES (\"j1\", \"connexion\", \"p@e.fr\", \"2020-01-01T00:00:00Z\")");
  $d->exec("INSERT INTO sessions (empreinte, compte_id, expire_le) VALUES (\"s1\", \"c1\", \"2020-01-01T00:00:00Z\")");
  $d->exec("INSERT INTO abonnes (email, confirme, cree_le) VALUES (\"vieux@e.fr\", 0, \"2020-01-01T00:00:00Z\"), (\"recent@e.fr\", 0, \"2099-01-01T00:00:00Z\"), (\"fidele@e.fr\", 1, \"2020-01-01T00:00:00Z\")");
  $d->exec("UPDATE salles SET expire_le = \"2020-01-01T00:00:00Z\"");
  $d->exec("INSERT INTO comptes (id, email, consentement_le, cree_le, vu_le) VALUES (\"c1\", \"oublie@e.fr\", \"2020-01-01T00:00:00Z\", \"2020-01-01T00:00:00Z\", \"2020-01-01T00:00:00Z\")");
  $d->exec("INSERT INTO seances_declarees (id, date_seance, mode, public_vise, seance, email, cree_le) VALUES (\"d1\", \"2020-01-01\", \"ligne\", \"autre\", \"libre\", \"orga@e.fr\", \"2019-12-01T00:00:00Z\")");
  $d->exec("UPDATE entretien SET le = \"2020-01-01T00:00:00Z\"");' "$T/test.sqlite"
get x moi >/dev/null
verifie "purge" "$(sql "SELECT (SELECT COUNT(*) FROM jetons WHERE expire_le < '2021') || '/' || (SELECT COUNT(*) FROM sessions WHERE empreinte = 's1') || '/' || (SELECT COUNT(*) FROM salles) || '/' || (SELECT COUNT(*) FROM salle_votes) || '/' || (SELECT COUNT(*) FROM comptes WHERE id = 'c1') || '/' || (SELECT email FROM seances_declarees WHERE id = 'd1')")" '0/0/0/0/0/'
verifie "abonnés non confirmés" "$(sql "SELECT email FROM abonnes ORDER BY email")" 'fidele@e.fr|recent@e.fr'
php -r '$d = new PDO("sqlite:" . $argv[1]); $d->exec("INSERT INTO jetons (empreinte, usage, email, expire_le) VALUES (\"j2\", \"connexion\", \"p@e.fr\", \"2020-01-01T00:00:00Z\")");' "$T/test.sqlite"
get x moi >/dev/null
verifie "une fois par heure" "$(sql "SELECT COUNT(*) FROM jetons WHERE empreinte = 'j2'")" '1'

echo "$ok réussis, $ko échoués"; [ $ko -eq 0 ]
