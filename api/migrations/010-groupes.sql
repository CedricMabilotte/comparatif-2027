-- Groupes : salles de séance (code éphémère, effacées après 30 jours), votes de salle,
-- réseau d'animateurs (inscriptions confirmées par e-mail), séances déclarées (modérées
-- avant publication) et retours d'expérience (lus par la modération seulement).
-- Compatible SQLite et MySQL : dates en texte ISO, pas d'auto-incrément.

CREATE TABLE IF NOT EXISTS salles (
  code CHAR(5) PRIMARY KEY,
  cle_empreinte CHAR(64) NOT NULL,
  seance VARCHAR(20) NOT NULL,
  titre VARCHAR(120),
  items TEXT NOT NULL,
  rang INT NOT NULL DEFAULT -1,
  revele SMALLINT NOT NULL DEFAULT 0,
  etat VARCHAR(10) NOT NULL DEFAULT 'ouverte',
  cree_le VARCHAR(25) NOT NULL,
  expire_le VARCHAR(25) NOT NULL
);

CREATE INDEX salles_expire ON salles (expire_le);

CREATE TABLE IF NOT EXISTS salle_presences (
  code CHAR(5) NOT NULL,
  votant_id VARCHAR(36) NOT NULL,
  le VARCHAR(25) NOT NULL,
  PRIMARY KEY (code, votant_id)
);

CREATE TABLE IF NOT EXISTS salle_votes (
  code CHAR(5) NOT NULL,
  votant_id VARCHAR(36) NOT NULL,
  proposition_id VARCHAR(20) NOT NULL,
  valeur SMALLINT NOT NULL,
  le VARCHAR(25) NOT NULL,
  PRIMARY KEY (code, votant_id, proposition_id)
);

CREATE TABLE IF NOT EXISTS animateurs (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  public_vise VARCHAR(30) NOT NULL,
  commune VARCHAR(120),
  confirme SMALLINT NOT NULL DEFAULT 0,
  cle_desinscription CHAR(64) NOT NULL,
  cree_le VARCHAR(25) NOT NULL,
  confirme_le VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS seances_declarees (
  id VARCHAR(36) PRIMARY KEY,
  date_seance CHAR(10) NOT NULL,
  mode VARCHAR(10) NOT NULL,
  commune VARCHAR(120),
  departement VARCHAR(3),
  region VARCHAR(60),
  lat REAL,
  lon REAL,
  public_vise VARCHAR(30) NOT NULL,
  seance VARCHAR(20) NOT NULL,
  organisateur VARCHAR(120),
  organisateur_public SMALLINT NOT NULL DEFAULT 0,
  lien VARCHAR(300),
  email VARCHAR(254) NOT NULL,
  statut VARCHAR(10) NOT NULL DEFAULT 'attente',
  cree_le VARCHAR(25) NOT NULL,
  modere_le VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS retours_seance (
  id VARCHAR(36) PRIMARY KEY,
  code CHAR(5),
  seance VARCHAR(20) NOT NULL,
  reponses TEXT NOT NULL,
  cree_le VARCHAR(25) NOT NULL
)
