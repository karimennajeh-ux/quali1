-- MySQL version of the schema for phpMyAdmin
-- Create database 'quali' first, then run this SQL

CREATE TABLE pilots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(100) DEFAULT 'Administrateur',
  dept VARCHAR(255) DEFAULT 'Pilotage application',
  func VARCHAR(255) DEFAULT '',
  matricule VARCHAR(100) DEFAULT '',
  org_name VARCHAR(255) DEFAULT 'QUALI by ENNAJEH',
  status VARCHAR(50) DEFAULT 'Actif',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

-- You can add other tables as needed, adapted from schema.sql