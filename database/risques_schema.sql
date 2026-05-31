CREATE DATABASE IF NOT EXISTS quali_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE quali_db;

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
