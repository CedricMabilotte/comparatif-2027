-- Données personnelles : tenir les durées annoncées et les droits des personnes.
--   salle_presences.carte   : le participant a coché « ajouter aussi mes votes à la carte nationale » (0 par défaut)
--   abonnes.cle_desinscription : empreinte du jeton de désinscription glissé dans chaque message
--   comptes.vu_le           : dernière connexion, pour effacer les comptes inactifs depuis 3 ans
--   sauvegardes             : copie de ce que le navigateur retient, déposée par le titulaire d'un compte
--   entretien               : date du dernier passage de chaque purge automatique

ALTER TABLE salle_presences ADD COLUMN carte SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE abonnes ADD COLUMN cle_desinscription CHAR(64);

ALTER TABLE comptes ADD COLUMN vu_le VARCHAR(25);

CREATE TABLE IF NOT EXISTS sauvegardes (
  compte_id VARCHAR(36) PRIMARY KEY,
  donnees MEDIUMTEXT NOT NULL,
  le VARCHAR(25) NOT NULL
);

CREATE TABLE IF NOT EXISTS entretien (
  tache VARCHAR(30) PRIMARY KEY,
  le VARCHAR(25) NOT NULL
)
