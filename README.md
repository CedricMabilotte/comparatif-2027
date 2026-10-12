# République des mots 2027

Comparatif participatif des programmes, des concepts et du vocabulaire des candidatures à l'élection présidentielle de 2027.

> **État : prototype (phase M1).** Les données de `data/corpus.json` sont **fictives** et servent à éprouver les mécanismes. Aucun parti réel n'y figure.

## Ce que fait le site

- **Matrice** : thèmes ou concepts en lignes, candidatures choisies en colonnes, chaque case remplie de citations sourcées.
- **Concepts** : pour chaque concept (travail, sécurité, peuple…), ce que chaque candidature met derrière le mot.
- **Vocabulaire** : les mots réellement employés, comptés par parti, avec leurs phrases.
- **Partis** : une fiche par parti avec ses documents de référence ; programme précédent cité en archive tant que le 2027 manque.
- **Partage** : image en trois formats (carré, paysage, vertical), texte prêt à coller, liens vers Bluesky, X, Mastodon, Facebook, LinkedIn, WhatsApp, Telegram.
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

- Code : MIT (fichier `LICENSE`).
- Textes éditoriaux (fiches, définitions, glossaire) et données de classement : Creative Commons BY-SA 4.0, dans la mesure où ils sont protégés par le droit d'auteur (ils ont été rédigés avec l'aide d'une IA, sous la direction de l'éditeur).
- **Les citations des programmes (champ `citation` de `data/corpus.json` et `site/corpus.json`) ne sont couvertes par aucune de ces licences.** Elles appartiennent à leurs auteurs et sont reproduites au titre de la courte citation (CPI, art. L. 122-5, 3°, a), avec leur source.

Éditeur, hébergeur et règle de modération : page « Mentions légales » du site (`#mentions-legales`).
