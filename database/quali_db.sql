CREATE DATABASE IF NOT EXISTS quali_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quali_db;

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code_client VARCHAR(100) NOT NULL UNIQUE,
  designation VARCHAR(255) NOT NULL,
  adresse TEXT,
  ville VARCHAR(150),
  telephone VARCHAR(100),
  fax VARCHAR(100),
  email VARCHAR(255),
  statut VARCHAR(100) DEFAULT 'Actif',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code_interne VARCHAR(100) NOT NULL UNIQUE,
  designation VARCHAR(255) NOT NULL,
  domaine VARCHAR(150),
  marque VARCHAR(150),
  modele VARCHAR(150),
  numero_serie VARCHAR(150),
  localisation VARCHAR(255),
  statut VARCHAR(100) DEFAULT 'Valide',
  date_derniere_verification DATE NULL,
  date_prochaine_verification DATE NULL,
  incertitude VARCHAR(150),
  controle_intermediaire VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS etalonnages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipement_id INT NOT NULL,
  reference_etalonnage VARCHAR(150) NOT NULL UNIQUE,
  laboratoire VARCHAR(255),
  date_etalonnage DATE NULL,
  date_prochain_etalonnage DATE NULL,
  resultat VARCHAR(150),
  certificat VARCHAR(255),
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_etalonnages_equipement
    FOREIGN KEY (equipement_id) REFERENCES equipements(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_audit VARCHAR(150) NOT NULL UNIQUE,
  type_audit VARCHAR(150) DEFAULT 'Audit interne',
  perimetre TEXT,
  auditeur VARCHAR(255),
  date_audit DATE NULL,
  statut VARCHAR(100) DEFAULT 'Planifie',
  conclusion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS non_conformites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  audit_id INT NULL,
  reference_nc VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  gravite VARCHAR(100),
  action_corrective TEXT,
  responsable VARCHAR(255),
  echeance DATE NULL,
  statut VARCHAR(100) DEFAULT 'Ouverte',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_non_conformites_audit
    FOREIGN KEY (audit_id) REFERENCES audits(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risques (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chapitre VARCHAR(255) NOT NULL,
  risque TEXT NOT NULL,
  probabilite_initiale TINYINT UNSIGNED DEFAULT 0,
  gravite_initiale TINYINT UNSIGNED DEFAULT 0,
  criticite_initiale INT UNSIGNED DEFAULT 0,
  actions TEXT,
  delai VARCHAR(255),
  responsable VARCHAR(255),
  suivi VARCHAR(255),
  probabilite_residuelle TINYINT UNSIGNED DEFAULT 0,
  gravite_residuelle TINYINT UNSIGNED DEFAULT 0,
  criticite_residuelle INT UNSIGNED DEFAULT 0,
  critere_evaluation TEXT,
  efficacite TEXT,
  statut VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS swot (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type_element ENUM('Forces','Faiblesses','Opportunites','Menaces') NOT NULL,
  element TEXT NOT NULL,
  plan_action TEXT,
  responsable VARCHAR(255),
  delai VARCHAR(255),
  suivi VARCHAR(100) DEFAULT 'en cours',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enquetes_satisfaction (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  reference_enquete VARCHAR(150) NOT NULL UNIQUE,
  date_enquete DATE NULL,
  contact_client VARCHAR(255),
  score_global DECIMAL(5,2) DEFAULT 0,
  commentaire TEXT,
  statut VARCHAR(100) DEFAULT 'Brouillon',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_enquetes_satisfaction_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS satisfaction_reponses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enquete_id INT NOT NULL,
  question VARCHAR(255) NOT NULL,
  reponse TEXT,
  note DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_satisfaction_reponses_enquete
    FOREIGN KEY (enquete_id) REFERENCES enquetes_satisfaction(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reclamations_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  reference_reclamation VARCHAR(150) NOT NULL UNIQUE,
  date_reclamation DATE NULL,
  objet VARCHAR(255),
  description TEXT,
  gravite VARCHAR(100),
  action TEXT,
  responsable VARCHAR(255),
  echeance DATE NULL,
  statut VARCHAR(100) DEFAULT 'Ouverte',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reclamations_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personnel (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricule VARCHAR(100) NOT NULL UNIQUE,
  nom VARCHAR(150) NOT NULL,
  prenom VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  fonction VARCHAR(255),
  service VARCHAR(255),
  statut VARCHAR(100) DEFAULT 'Actif',
  date_embauche DATE NULL,
  competences TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  personnel_id INT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nom_complet VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT 'Utilisateur',
  statut VARCHAR(100) DEFAULT 'Actif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_utilisateurs_personnel
    FOREIGN KEY (personnel_id) REFERENCES personnel(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS personnel_id INT NULL,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nom_complet VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role VARCHAR(100) DEFAULT 'Utilisateur',
  ADD COLUMN IF NOT EXISTS statut VARCHAR(100) DEFAULT 'Actif';

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  autorise TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_permission (utilisateur_id, module, action),
  CONSTRAINT fk_permissions_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diagnostics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_diagnostic VARCHAR(150) NOT NULL UNIQUE,
  norme VARCHAR(150) DEFAULT 'ISO/IEC 17025:2017',
  evaluateur VARCHAR(255),
  date_diagnostic DATE NULL,
  score_global DECIMAL(5,2) DEFAULT 0,
  statut VARCHAR(100) DEFAULT 'En cours',
  commentaire TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diagnostic_reponses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  diagnostic_id INT NOT NULL,
  chapitre VARCHAR(50),
  exigence VARCHAR(255),
  reponse VARCHAR(100),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_diagnostic_reponses_diagnostic
    FOREIGN KEY (diagnostic_id) REFERENCES diagnostics(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sujet VARCHAR(255),
  type_conversation VARCHAR(100) DEFAULT 'direct',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversations_created_by
    FOREIGN KEY (created_by) REFERENCES utilisateurs(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  utilisateur_id INT NOT NULL,
  role_participant VARCHAR(100) DEFAULT 'participant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_conversation_participant (conversation_id, utilisateur_id),
  CONSTRAINT fk_conversation_participants_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_conversation_participants_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  expediteur_id INT NULL,
  contenu TEXT NOT NULL,
  lu TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_messages_expediteur
    FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parametres_organisme (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom_organisme VARCHAR(255) NOT NULL,
  matricule_fiscal VARCHAR(150),
  forme_juridique VARCHAR(150),
  pays VARCHAR(150),
  ville VARCHAR(150),
  adresse TEXT,
  telephone VARCHAR(100),
  fax VARCHAR(100),
  email VARCHAR(255),
  site_web VARCHAR(255),
  responsable VARCHAR(255),
  accreditation VARCHAR(255),
  norme_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents_organisme (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organisme_id INT NULL,
  reference_document VARCHAR(150) NOT NULL UNIQUE,
  titre VARCHAR(255) NOT NULL,
  type_document VARCHAR(150),
  version_document VARCHAR(50),
  statut VARCHAR(100) DEFAULT 'Brouillon',
  redacteur VARCHAR(255),
  verificateur VARCHAR(255),
  approbateur VARCHAR(255),
  chemin_fichier VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_organisme
    FOREIGN KEY (organisme_id) REFERENCES parametres_organisme(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossiers_documentaires (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom_dossier VARCHAR(255) NOT NULL,
  chemin_dossier TEXT NOT NULL,
  chemin_relatif TEXT,
  parent_id INT NULL,
  role_dossier VARCHAR(100) DEFAULT 'process',
  statut VARCHAR(100) DEFAULT 'Actif',
  actif TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_documentaire VARCHAR(255) NOT NULL UNIQUE,
  titre_document VARCHAR(255) NOT NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  extension VARCHAR(20),
  type_document VARCHAR(150),
  processus VARCHAR(255),
  version VARCHAR(50) DEFAULT '1.0',
  statut VARCHAR(100) DEFAULT 'Brouillon',
  statut_precedent VARCHAR(100) NULL,
  responsable_redacteur VARCHAR(255),
  verificateur VARCHAR(255),
  approbateur VARCHAR(255),
  diffuseur VARCHAR(255),
  chemin_fichier TEXT NOT NULL,
  chemin_relatif TEXT,
  taille_fichier BIGINT DEFAULT 0,
  date_modification DATETIME NULL,
  stockage VARCHAR(100) DEFAULT 'Local',
  observation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (processus),
  INDEX (type_document),
  INDEX (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS statut_precedent VARCHAR(100) NULL;

ALTER TABLE dossiers_documentaires
  ADD COLUMN IF NOT EXISTS statut VARCHAR(100) DEFAULT 'Actif',
  ADD COLUMN IF NOT EXISTS actif TINYINT(1) DEFAULT 1;

CREATE TABLE IF NOT EXISTS journal_documentaire (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NULL,
  action VARCHAR(100) NOT NULL,
  acteur VARCHAR(255) DEFAULT 'Systeme',
  detail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_journal_documentaire_document
    FOREIGN KEY (document_id) REFERENCES documents(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO utilisateurs (email, password_hash, nom_complet, role, statut)
VALUES (
  'admin@quali.local',
  '$2y$10$OV/KcmXwfJJOjS3LMuEwnO2aGUhef90y8lwIGO2b8UeV5I0cA0Tia',
  'Administrateur QUALI',
  'Administrateur',
  'Actif'
)
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  statut = VALUES(statut),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO permissions (utilisateur_id, module, action, autorise)
SELECT id, module_name, action_name, 1
FROM utilisateurs
JOIN (
  SELECT 'clients' module_name, 'Voir' action_name UNION ALL
  SELECT 'clients', 'Ajouter' UNION ALL SELECT 'clients', 'Modifier' UNION ALL SELECT 'clients', 'Supprimer' UNION ALL
  SELECT 'equipements', 'Voir' UNION ALL SELECT 'equipements', 'Ajouter' UNION ALL SELECT 'equipements', 'Modifier' UNION ALL SELECT 'equipements', 'Supprimer' UNION ALL
  SELECT 'audits', 'Voir' UNION ALL SELECT 'audits', 'Ajouter' UNION ALL SELECT 'audits', 'Modifier' UNION ALL SELECT 'audits', 'Supprimer' UNION ALL
  SELECT 'non_conformites', 'Voir' UNION ALL SELECT 'non_conformites', 'Ajouter' UNION ALL SELECT 'non_conformites', 'Modifier' UNION ALL SELECT 'non_conformites', 'Supprimer' UNION ALL
  SELECT 'risques', 'Voir' UNION ALL SELECT 'risques', 'Ajouter' UNION ALL SELECT 'risques', 'Modifier' UNION ALL SELECT 'risques', 'Supprimer' UNION ALL
  SELECT 'swot', 'Voir' UNION ALL SELECT 'swot', 'Ajouter' UNION ALL SELECT 'swot', 'Modifier' UNION ALL SELECT 'swot', 'Supprimer' UNION ALL
  SELECT 'satisfaction', 'Voir' UNION ALL SELECT 'satisfaction', 'Ajouter' UNION ALL SELECT 'satisfaction', 'Modifier' UNION ALL SELECT 'satisfaction', 'Supprimer' UNION ALL
  SELECT 'reclamations', 'Voir' UNION ALL SELECT 'reclamations', 'Ajouter' UNION ALL SELECT 'reclamations', 'Modifier' UNION ALL SELECT 'reclamations', 'Supprimer' UNION ALL
  SELECT 'personnel', 'Voir' UNION ALL SELECT 'personnel', 'Ajouter' UNION ALL SELECT 'personnel', 'Modifier' UNION ALL SELECT 'personnel', 'Supprimer' UNION ALL
  SELECT 'utilisateurs', 'Voir' UNION ALL SELECT 'utilisateurs', 'Ajouter' UNION ALL SELECT 'utilisateurs', 'Modifier' UNION ALL SELECT 'utilisateurs', 'Supprimer' UNION ALL
  SELECT 'diagnostic', 'Voir' UNION ALL SELECT 'diagnostic', 'Ajouter' UNION ALL SELECT 'diagnostic', 'Modifier' UNION ALL SELECT 'diagnostic', 'Supprimer' UNION ALL
  SELECT 'discussion', 'Voir' UNION ALL SELECT 'discussion', 'Ajouter' UNION ALL SELECT 'discussion', 'Modifier' UNION ALL SELECT 'discussion', 'Supprimer' UNION ALL
  SELECT 'parametres', 'Voir' UNION ALL SELECT 'parametres', 'Modifier'
) p
WHERE email = 'admin@quali.local'
ON DUPLICATE KEY UPDATE
  autorise = VALUES(autorise),
  updated_at = CURRENT_TIMESTAMP;
