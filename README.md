# République des mots 2027

Comparatif participatif des programmes, des concepts et du vocabulaire des candidatures à l'élection présidentielle de 2027.

> **État : prototype (phase M1).** Les données de `data/corpus.json` sont **fictives** et servent à éprouver les mécanismes. Aucun parti réel n'y figure.

## Ce que fait le site

- **Matrice** : thèmes ou concepts en lignes, candidatures choisies en colonnes, chaque case remplie de citations sourcées.
- **Lexique** : pour chaque concept (travail, sécurité, peuple…), ce que chaque candidature met derrière le mot.
- **À l'aveugle** : on juge une proposition sans savoir de qui elle vient ; l'auteur est révélé après le vote.
- **Qui a dit ça ?** : un quiz pour deviner quelle candidature a écrit quoi.

## Principe de fiabilité

L'unité de base est la **proposition** : une phrase citée mot pour mot, avec son document source, sa page et sa date. `scripts/verifier-citations.mjs` contrôle que chaque citation figure dans sa source ; une fiche qui échoue n'est pas publiable.

## Utilisation

```sh
node scripts/construire.mjs        # vérifie les citations et prépare site/
python3 -m http.server -d site     # puis ouvrir http://localhost:8000
```

## Organisation

- `data/corpus.json` : candidatures, thèmes, concepts, propositions, lexique.
- `sources/` : textes des documents sources, pour la vérification.
- `site/` : le site statique.
- `docs/CHARTE.md` : règles éditoriales et de participation.

## Licences

Code : MIT. Données : Licence Ouverte Etalab 2.0 (à confirmer avant publication du corpus réel).
