-- Participation encadrée : rien de ce qu'un visiteur écrit n'est publié sans relecture.
-- Une seule table pour les trois sortes de contributions, pour une file de modération unique :
--   reponse     : « Qu'est-ce qui vous manque pour comprendre ce concept ? » (attente, publie, refuse)
--   signalement : une erreur sur une fiche (attente, corrige, non_retenu), qui alimente le journal public
--   suggestion  : un concept ou un mot proposé (attente, redaction, ajoute, refuse)
-- L'adresse e-mail, facultative, n'est jamais renvoyée publiquement et s'efface une fois le visiteur prévenu.

ALTER TABLE abonnes ADD COLUMN frequence VARCHAR(10) NOT NULL DEFAULT 'semaine';

CREATE TABLE IF NOT EXISTS contributions (
  id VARCHAR(36) PRIMARY KEY,
  genre VARCHAR(12) NOT NULL,
  cible VARCHAR(100),
  nature VARCHAR(20),
  terme VARCHAR(120),
  texte TEXT NOT NULL,
  lieu VARCHAR(300),
  pseudo VARCHAR(40),
  email VARCHAR(254),
  compte_id VARCHAR(36),
  etat VARCHAR(12) NOT NULL DEFAULT 'attente',
  reponse TEXT,
  cree_le VARCHAR(25) NOT NULL,
  traite_le VARCHAR(25)
);

CREATE INDEX contributions_genre_etat ON contributions (genre, etat);
CREATE INDEX contributions_cible ON contributions (cible);

-- Cercles : les comptes qui veulent être prévenus de l'ouverture d'un cercle.
CREATE TABLE IF NOT EXISTS cercles_interets (
  compte_id VARCHAR(36) NOT NULL,
  cercle VARCHAR(20) NOT NULL,
  le VARCHAR(25) NOT NULL,
  PRIMARY KEY (compte_id, cercle)
);
