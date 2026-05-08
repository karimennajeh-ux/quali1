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

CREATE TABLE IF NOT EXISTS doc_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id INTEGER NOT NULL UNIQUE,
  server_root TEXT NOT NULL,
  documents_root TEXT NOT NULL,
  archives_root TEXT NOT NULL,
  trash_root TEXT NOT NULL,
  logs_root TEXT NOT NULL,
  pilot_root TEXT NOT NULL,
  hierarchy_json TEXT NOT NULL DEFAULT '{"levels":["process","type","reference","version"],"processFolders":["Processus_pilotage","Processus_operationnel","Processus_support"]}',
  auto_create_folders INTEGER NOT NULL DEFAULT 1,
  managed_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doc_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id INTEGER NOT NULL,
  parent_id INTEGER,
  folder_key TEXT NOT NULL,
  folder_label TEXT NOT NULL,
  folder_role TEXT NOT NULL DEFAULT 'custom',
  abs_path TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  managed_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (pilot_id, abs_path),
  FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES doc_folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id INTEGER NOT NULL,
  folder_id INTEGER,
  doc_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  process_name TEXT DEFAULT '',
  doc_type TEXT DEFAULT '',
  version_label TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'Brouillon',
  owner_name TEXT DEFAULT '',
  verifier_name TEXT DEFAULT '',
  approver_name TEXT DEFAULT '',
  diffuser_name TEXT DEFAULT '',
  file_name TEXT NOT NULL,
  file_ext TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  rel_path TEXT NOT NULL,
  abs_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT DEFAULT '',
  storage_mode TEXT NOT NULL DEFAULT 'local_server',
  source_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  archived_at TEXT,
  created_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES doc_folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS document_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  status TEXT DEFAULT 'Brouillon',
  file_name TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  abs_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_label TEXT NOT NULL,
  actor_name TEXT DEFAULT '',
  event_detail TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS change_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pilot_id INTEGER NOT NULL,
  pilot_email TEXT NOT NULL,
  module_key TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  actor_name TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_pilot_id ON users(pilot_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_doc_settings_pilot_id ON doc_settings(pilot_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_pilot_id ON doc_folders(pilot_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_parent_id ON doc_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_pilot_id ON documents(pilot_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_ref ON documents(doc_ref);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_events_document_id ON document_events(document_id);
CREATE INDEX IF NOT EXISTS idx_change_events_pilot_id ON change_events(pilot_id);
CREATE INDEX IF NOT EXISTS idx_change_events_pilot_email ON change_events(pilot_email);
CREATE INDEX IF NOT EXISTS idx_change_events_module_key ON change_events(module_key);
