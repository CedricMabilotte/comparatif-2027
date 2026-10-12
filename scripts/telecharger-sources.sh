#!/usr/bin/env bash
# Reconstitue les textes sources (sources/*.txt) à partir de data/referentiel.json.
# Garde les fichiers d'origine dans sources/brut/. Nécessite curl, pdftotext (poppler) et python3 avec bs4.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p sources/brut
UA="Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
python3 -c 'import json; [print(d["id"], d.get("fichier", d["id"]), d.get("telechargement", d["url"])) for d in json.load(open("data/referentiel.json"))["documents"]]' |
while read -r id fichier url; do
  brut="sources/brut/$fichier"
  [ -s "sources/$fichier.txt" ] && continue
  curl -sSL --compressed -m 120 -A "$UA" -o "$brut.tmp" "$url" || { echo "ÉCHEC $id"; continue; }
  if file -b "$brut.tmp" | grep -q gzip; then mv "$brut.tmp" "$brut.gz"; gunzip -f "$brut.gz"; else mv "$brut.tmp" "$brut"; fi
  if file -b "$brut" | grep -q PDF; then
    pdftotext -enc UTF-8 "$brut" "sources/$fichier.txt"
  else
    python3 - "$brut" "sources/$fichier.txt" <<'PY'
import sys
from bs4 import BeautifulSoup
s = BeautifulSoup(open(sys.argv[1], encoding="utf-8", errors="ignore"), "html.parser")
for t in s(["script", "style", "nav", "header", "footer", "noscript", "form", "svg"]): t.decompose()
m = s.find("main") or s.find("article") or s.body or s
open(sys.argv[2], "w").write("\n".join(l.strip() for l in m.get_text("\n").split("\n") if l.strip()) + "\n")
PY
  fi
  echo "ok $id"
done
