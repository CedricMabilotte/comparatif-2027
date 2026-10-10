-- Schéma compatible MySQL/MariaDB (Gandi Simple Hosting) et SQLite (tests).
-- Les votes sont rattachés à un identifiant de votant aléatoire, jamais directement à un compte :
-- le lien compte <-> votant vit dans une table à part, que l'on peut purger sans perdre les votes.

CREATE TABLE IF NOT EXISTS comptes (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  pseudo VARCHAR(40),
  commune_insee CHAR(5),
  commune_nom VARCHAR(120),
  consentement_le VARCHAR(25) NOT NULL,
  cree_le VARCHAR(25) NOT NULL
);

CREATE TABLE IF NOT EXISTS votants (
  id VARCHAR(36) PRIMARY KEY,
  cree_le VARCHAR(25) NOT NULL
);

CREATE TABLE IF NOT EXISTS liens_votants (
  compte_id VARCHAR(36) NOT NULL,
  votant_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (compte_id, votant_id)
);

CREATE TABLE IF NOT EXISTS votes (
  votant_id VARCHAR(36) NOT NULL,
  proposition_id VARCHAR(20) NOT NULL,
  valeur SMALLINT NOT NULL,
  le VARCHAR(25) NOT NULL,
  PRIMARY KEY (votant_id, proposition_id)
);

CREATE TABLE IF NOT EXISTS jetons (
  empreinte CHAR(64) PRIMARY KEY,
  usage VARCHAR(20) NOT NULL,
  email VARCHAR(254) NOT NULL,
  expire_le VARCHAR(25) NOT NULL,
  utilise SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  empreinte CHAR(64) PRIMARY KEY,
  compte_id VARCHAR(36) NOT NULL,
  expire_le VARCHAR(25) NOT NULL
);

CREATE TABLE IF NOT EXISTS abonnes (
  email VARCHAR(254) PRIMARY KEY,
  confirme SMALLINT NOT NULL DEFAULT 0,
  cree_le VARCHAR(25) NOT NULL,
  confirme_le VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS limites (
  cle CHAR(64) PRIMARY KEY,
  fenetre VARCHAR(25) NOT NULL,
  compte INT NOT NULL
);
