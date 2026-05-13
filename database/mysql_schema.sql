-- MySQL schema for QUALI database

CREATE DATABASE IF NOT EXISTS `quali` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `quali`;

CREATE TABLE IF NOT EXISTS pilots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(255) DEFAULT 'Administrateur',
  dept VARCHAR(255),
  func VARCHAR(255),
  matricule VARCHAR(255),
  org_name VARCHAR(255),
  status VARCHAR(255) DEFAULT 'Actif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(255),
  dept VARCHAR(255),
  func VARCHAR(255),
  matricule VARCHAR(255),
  status VARCHAR(255) DEFAULT 'Actif',
  pilot_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pilot_email) REFERENCES pilots(email) ON DELETE CASCADE
);

-- Insert main pilot
INSERT INTO pilots (email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status) VALUES
('karimennajeh@gmail.com', '$2y$10$HpBeTsZpuEoxqwhuMl1D1eBMr5uOlMV/vpJmu3DSj6ZRCFjMYs40.', 'Pilote QUALI', 'Pilote', 'QUALI', 'Administrateur', 'Pilotage application', 'Pilote de l\'application', 'PILOT-001', 'QUALI by ENNAJEH', 'Actif')
ON DUPLICATE KEY UPDATE email=email;
