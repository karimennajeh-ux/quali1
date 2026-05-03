PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pilots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'Administrateur',
  dept TEXT DEFAULT 'Pilotage application',
  func TEXT DEFAULT '',
  matricule TEXT DEFAULT '',
  org_name TEXT DEFAULT 'QUALI by ENNAJEH',
  status TEXT DEFAULT 'Actif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'Utilisateur',
  dept TEXT DEFAULT '-',
  func TEXT DEFAULT '-',
  matricule TEXT DEFAULT '-',
  profile TEXT DEFAULT 'Personnalise',
  status TEXT DEFAULT 'Actif',
  perms_json TEXT NOT NULL DEFAULT '[]',
  module_access_json TEXT NOT NULL DEFAULT '{}',
  account_type TEXT DEFAULT 'Utilisateur',
  created_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (pilot_id, email),
  FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pilot_app_state (
  pilot_id INTEGER PRIMARY KEY,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_pilot_id ON users(pilot_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
