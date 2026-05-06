const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PRIMARY_DB_DIR = process.env.QUALILAB_DATA_DIR || path.join(__dirname, "database");
const PRIMARY_DB_PATH = path.join(PRIMARY_DB_DIR, "qualilab.sqlite");
const FALLBACK_DB_DIR = process.env.QUALILAB_DATA_FALLBACK_DIR || path.join(os.tmpdir(), "QualiByEnnajeh", "data");
const FALLBACK_DB_PATH = path.join(FALLBACK_DB_DIR, "qualilab.sqlite");
const SCHEMA_PATH = path.join(ROOT, "database", "schema.sql");
const APP_HTML_PATH = path.join(ROOT, "QualiLab_by_ENNAJEH_v2.html");
const LIVE_RELOAD_WATCH_INTERVAL = Number(process.env.QUALI_LIVE_RELOAD_INTERVAL || 700);
const DOC_SERVER_ROOT = process.env.QUALI_DOCS_ROOT || path.join(ROOT, "database", "QUALI_DATA_SERVER");
const DOC_SERVER_DIRS = {
  root: DOC_SERVER_ROOT,
  db: path.join(DOC_SERVER_ROOT, "db"),
  documents: path.join(DOC_SERVER_ROOT, "documents"),
  archives: path.join(DOC_SERVER_ROOT, "archives"),
  trash: path.join(DOC_SERVER_ROOT, "trash"),
  logs: path.join(DOC_SERVER_ROOT, "logs")
};
const DEFAULT_DOC_PROCESS_FOLDERS = ["Processus_pilotage", "Processus_operationnel", "Processus_support"];
const DEFAULT_DOC_HIERARCHY = {
  levels: ["process", "type", "reference", "version"],
  processFolders: DEFAULT_DOC_PROCESS_FOLDERS
};

const MAIN_PILOT = {
  email: "karimennajeh@gmail.com",
  password: "09318872karim@",
  name: "Pilote QUALI",
  firstName: "Pilote",
  lastName: "QUALI",
  role: "Administrateur",
  dept: "Pilotage application",
  func: "Pilote de l'application",
  matricule: "PILOT-001",
  orgName: "QUALI by ENNAJEH",
  status: "Actif"
};

const MODULE_ACTIONS = ["Voir", "Ajouter", "Modifier", "Supprimer", "Valider", "Telecharger", "Imprimer"];
const MODULE_ACCESS_CONFIG = [
  { id: "db", label: "Tableau de bord" },
  { id: "docs", label: "Maitrise documentaire" },
  { id: "docorg", label: "Documentation" },
  { id: "revc", label: "Liste client" },
  { id: "prest", label: "Prestataire externe" },
  { id: "eq", label: "Gestion des equipements" },
  { id: "nc", label: "Non-conformites" },
  { id: "aud", label: "Audits" },
  { id: "risk", label: "Analyse de risque" },
  { id: "swot", label: "Analyse SWOT" },
  { id: "sat", label: "Satisfaction client" },
  { id: "recl", label: "Reclamation client" },
  { id: "pers", label: "Personnel" },
  { id: "plan", label: "Planning" },
  { id: "stat", label: "Statistique" },
  { id: "aci", label: "Amelioration continue" },
  { id: "diag", label: "Diagnostic ISO 17025" },
  { id: "disc", label: "Discussion" },
  { id: "repo", label: "Dossier principal" },
  { id: "usr", label: "Utilisateurs" },
  { id: "set", label: "Parametres" }
];
const PERMS = ["Ajouter", "Modifier", "Supprimer", "Valider", "Telecharger", "Importer", "Exporter", "Parametres", "Comptes"];
const liveReloadClients = new Set();
let liveReloadVersion = Date.now();
let liveReloadDebounce = null;
let liveReloadWatcherStarted = false;

function now() {
  return new Date().toISOString();
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugifySegment(value, fallback = "element") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function relFromDocServer(absPath) {
  return path.relative(DOC_SERVER_ROOT, absPath).split(path.sep).join("/");
}

function ensureDocumentationServerRoots() {
  Object.values(DOC_SERVER_DIRS).forEach(ensureDir);
}

function buildPilotDocumentationPaths(pilot) {
  const pilotFolder = slugifySegment(pilot.orgName || pilot.name || pilot.email || `pilot_${pilot.id}`, `pilot_${pilot.id || "root"}`);
  const pilotRoot = path.join(DOC_SERVER_DIRS.documents, pilotFolder);
  return {
    pilotFolder,
    pilotRoot,
    archivesRoot: path.join(DOC_SERVER_DIRS.archives, pilotFolder),
    trashRoot: path.join(DOC_SERVER_DIRS.trash, pilotFolder),
    logsRoot: path.join(DOC_SERVER_DIRS.logs, pilotFolder),
    processFolders: DEFAULT_DOC_PROCESS_FOLDERS.map((label, index) => ({
      folderKey: slugifySegment(label, `process_${index + 1}`),
      folderLabel: label,
      folderRole: "process",
      absPath: path.join(pilotRoot, label),
      relPath: relFromDocServer(path.join(pilotRoot, label)),
      depth: 1,
      sortOrder: index + 1,
      isSystem: 1
    }))
  };
}

function lanUrls(port) {
  const out = [];
  const nets = os.networkInterfaces();
  Object.values(nets).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal) return;
      if (entry.family === "IPv4") out.push(`http://${entry.address}:${port}`);
    });
  });
  return [...new Set(out)];
}

function emitLiveReload(reason = "file-updated") {
  liveReloadVersion = Date.now();
  const payload = JSON.stringify({
    ok: true,
    reason,
    version: liveReloadVersion,
    file: path.basename(APP_HTML_PATH),
    time: now()
  });
  [...liveReloadClients].forEach((res) => {
    try {
      res.write(`event: reload\n`);
      res.write(`data: ${payload}\n\n`);
    } catch (_error) {
      liveReloadClients.delete(res);
    }
  });
}

function scheduleLiveReload(reason = "file-updated") {
  clearTimeout(liveReloadDebounce);
  liveReloadDebounce = setTimeout(() => emitLiveReload(reason), 120);
}

function startLiveReloadWatcher() {
  if (liveReloadWatcherStarted) return;
  liveReloadWatcherStarted = true;
  fs.watchFile(APP_HTML_PATH, { interval: LIVE_RELOAD_WATCH_INTERVAL }, (curr, prev) => {
    if (!curr || !prev) return;
    if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
      scheduleLiveReload("html-saved");
    }
  });
  ["exit", "SIGINT", "SIGTERM"].forEach((evt) => {
    process.once(evt, () => {
      try { fs.unwatchFile(APP_HTML_PATH); } catch (_error) { }
    });
  });
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function fullModuleAccess() {
  return MODULE_ACCESS_CONFIG.reduce((acc, mod) => {
    acc[mod.id] = [...MODULE_ACTIONS];
    return acc;
  }, {});
}

function normalizeModuleAccess(raw) {
  const out = {};
  MODULE_ACCESS_CONFIG.forEach((mod) => {
    const list = Array.isArray(raw && raw[mod.id]) ? raw[mod.id].filter((x) => MODULE_ACTIONS.includes(x)) : [];
    if (list.length) out[mod.id] = [...new Set(list)];
  });
  return out;
}

function normalizePerms(raw) {
  return Array.isArray(raw) ? [...new Set(raw.filter((x) => PERMS.includes(x)))] : [];
}

function normalizeUserPayload(payload = {}) {
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const name = String(payload.name || `${firstName} ${lastName}`.trim() || "Utilisateur").trim();
  return {
    firstName,
    lastName,
    name,
    email: normEmail(payload.email),
    password: String(payload.password || ""),
    role: String(payload.role || "Utilisateur").trim() || "Utilisateur",
    dept: String(payload.dept || "-").trim() || "-",
    func: String(payload.func || "-").trim() || "-",
    matricule: String(payload.matricule || "-").trim() || "-",
    profile: String(payload.profile || "Personnalise").trim() || "Personnalise",
    status: String(payload.status || "Actif").trim() || "Actif",
    perms: normalizePerms(payload.perms),
    moduleAccess: normalizeModuleAccess(payload.moduleAccess || {}),
    accountType: String(payload.accountType || "Utilisateur").trim() || "Utilisateur",
    createdBy: String(payload.createdBy || "").trim()
  };
}

function normalizePilotPayload(payload = {}) {
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const name = String(payload.name || `${firstName} ${lastName}`.trim() || "Pilote").trim();
  return {
    firstName,
    lastName,
    name,
    email: normEmail(payload.email),
    password: String(payload.password || ""),
    role: String(payload.role || "Administrateur").trim() || "Administrateur",
    dept: String(payload.dept || "Pilotage application").trim() || "Pilotage application",
    func: String(payload.func || "Pilote de l'application").trim() || "Pilote de l'application",
    matricule: String(payload.matricule || "").trim(),
    orgName: String(payload.orgName || "QUALI by ENNAJEH").trim() || "QUALI by ENNAJEH",
    status: String(payload.status || "Actif").trim() || "Actif"
  };
}

function ensureDatabase(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

  const selectPilot = db.prepare("SELECT id FROM pilots WHERE email = ?");
  const existing = selectPilot.get(MAIN_PILOT.email);
  const timestamp = now();

  if (!existing) {
    const insertPilot = db.prepare(`
      INSERT INTO pilots (
        email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insertPilot.run(
      MAIN_PILOT.email,
      MAIN_PILOT.password,
      MAIN_PILOT.name,
      MAIN_PILOT.firstName,
      MAIN_PILOT.lastName,
      MAIN_PILOT.role,
      MAIN_PILOT.dept,
      MAIN_PILOT.func,
      MAIN_PILOT.matricule,
      MAIN_PILOT.orgName,
      MAIN_PILOT.status,
      timestamp,
      timestamp
    );
    db.prepare(`
      INSERT INTO pilot_app_state (pilot_id, state_json, created_at, updated_at)
      VALUES (?, '{}', ?, ?)
    `).run(Number(result.lastInsertRowid), timestamp, timestamp);
  } else {
    db.prepare(`
      UPDATE pilots
      SET password = ?, name = ?, first_name = ?, last_name = ?, role = ?, dept = ?, func = ?, matricule = ?, org_name = ?, status = ?, updated_at = ?
      WHERE email = ?
    `).run(
      MAIN_PILOT.password,
      MAIN_PILOT.name,
      MAIN_PILOT.firstName,
      MAIN_PILOT.lastName,
      MAIN_PILOT.role,
      MAIN_PILOT.dept,
      MAIN_PILOT.func,
      MAIN_PILOT.matricule,
      MAIN_PILOT.orgName,
      MAIN_PILOT.status,
      timestamp,
      MAIN_PILOT.email
    );
    db.prepare(`
      INSERT INTO pilot_app_state (pilot_id, state_json, created_at, updated_at)
      VALUES (?, '{}', ?, ?)
      ON CONFLICT(pilot_id) DO NOTHING
    `).run(existing.id, timestamp, timestamp);
  }

  return db;
}

let db = null;
let dbReady = false;
let dbInitError = null;
let activeDbPath = PRIMARY_DB_PATH;

function initDatabase() {
  ensureDocumentationServerRoots();
  const tried = [];
  for (const dbPath of [PRIMARY_DB_PATH, FALLBACK_DB_PATH]) {
    if (tried.includes(dbPath)) continue;
    tried.push(dbPath);
    try {
      db = ensureDatabase(dbPath);
      dbReady = true;
      dbInitError = null;
      activeDbPath = dbPath;
      return;
    } catch (error) {
      db = null;
      dbReady = false;
      dbInitError = error;
      activeDbPath = dbPath;
      console.error(`Quali by ENNAJEH database init failed for ${dbPath}:`, error.message);
    }
  }
}

function pilotToAccount(row) {
  return {
    id: row.id,
    pilot: true,
    email: row.email,
    password: row.password,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    dept: row.dept,
    func: row.func,
    matricule: row.matricule,
    orgName: row.org_name,
    status: row.status,
    perms: [...PERMS],
    moduleAccess: fullModuleAccess(),
    accountType: "Pilote",
    profile: "Administrateur",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function userToAccount(row) {
  return {
    id: row.id,
    pilotId: row.pilot_id,
    pilotEmail: row.pilot_email,
    pilotName: row.pilot_name,
    pilot: false,
    email: row.email,
    password: row.password,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    dept: row.dept,
    func: row.func,
    matricule: row.matricule,
    profile: row.profile,
    status: row.status,
    perms: normalizePerms(parseJson(row.perms_json, [])),
    moduleAccess: normalizeModuleAccess(parseJson(row.module_access_json, {})),
    accountType: row.account_type || "Utilisateur",
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SQL_SELECT_PILOT_BY_EMAIL = "SELECT * FROM pilots WHERE email = ?";
const SQL_INSERT_PILOT_ACCOUNT = `
  INSERT INTO pilots (
    email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const SQL_UPDATE_PILOT_ACCOUNT_BY_EMAIL = `
  UPDATE pilots
  SET password = ?, name = ?, first_name = ?, last_name = ?, role = ?, dept = ?, func = ?, matricule = ?, org_name = ?, status = ?, updated_at = ?
  WHERE email = ?
`;
const SQL_DELETE_PILOT_ACCOUNT_BY_EMAIL = `
  DELETE FROM pilots
  WHERE email = ?
`;
const SQL_ENSURE_PILOT_STATE_ROW = `
  INSERT INTO pilot_app_state (pilot_id, state_json, created_at, updated_at)
  VALUES (?, '{}', ?, ?)
  ON CONFLICT(pilot_id) DO NOTHING
`;
const SQL_SELECT_PILOT_USERS = `
  SELECT u.*, p.email AS pilot_email, p.name AS pilot_name
  FROM users u
  JOIN pilots p ON p.id = u.pilot_id
  WHERE p.email = ?
  ORDER BY u.created_at DESC, u.id DESC
`;
const SQL_SELECT_USER_BY_PILOT_AND_EMAIL = `
  SELECT u.*, p.email AS pilot_email, p.name AS pilot_name
  FROM users u
  JOIN pilots p ON p.id = u.pilot_id
  WHERE p.email = ? AND u.email = ?
`;
const SQL_INSERT_USER = `
  INSERT INTO users (
    pilot_id, email, password, name, first_name, last_name, role, dept, func, matricule, profile, status,
    perms_json, module_access_json, account_type, created_by, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function selectPilotByEmailStmt() { return db.prepare(SQL_SELECT_PILOT_BY_EMAIL); }
function insertPilotAccountStmt() { return db.prepare(SQL_INSERT_PILOT_ACCOUNT); }
function updatePilotAccountByEmailStmt() { return db.prepare(SQL_UPDATE_PILOT_ACCOUNT_BY_EMAIL); }
function deletePilotAccountByEmailStmt() { return db.prepare(SQL_DELETE_PILOT_ACCOUNT_BY_EMAIL); }
function ensurePilotStateRowStmt() { return db.prepare(SQL_ENSURE_PILOT_STATE_ROW); }
function selectPilotUsersStmt() { return db.prepare(SQL_SELECT_PILOT_USERS); }
function selectUserByPilotAndEmailStmt() { return db.prepare(SQL_SELECT_USER_BY_PILOT_AND_EMAIL); }
function insertUserStmt() { return db.prepare(SQL_INSERT_USER); }

function getPilotByEmail(email) {
  const row = selectPilotByEmailStmt().get(normEmail(email));
  return row ? pilotToAccount(row) : null;
}

function getDocumentationSettingsByPilotId(pilotId) {
  const row = db.prepare(`
    SELECT *
    FROM doc_settings
    WHERE pilot_id = ?
  `).get(pilotId);
  if (!row) return null;
  return {
    id: row.id,
    pilotId: row.pilot_id,
    serverRoot: row.server_root,
    documentsRoot: row.documents_root,
    archivesRoot: row.archives_root,
    trashRoot: row.trash_root,
    logsRoot: row.logs_root,
    pilotRoot: row.pilot_root,
    hierarchy: parseJson(row.hierarchy_json, DEFAULT_DOC_HIERARCHY),
    autoCreateFolders: Boolean(row.auto_create_folders),
    managedBy: row.managed_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function upsertDocumentationFolder(pilotId, folder, actorName = "Systeme", parentId = null) {
  const timestamp = now();
  db.prepare(`
    INSERT INTO doc_folders (
      pilot_id, parent_id, folder_key, folder_label, folder_role, abs_path, rel_path,
      depth, sort_order, is_system, managed_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pilot_id, abs_path) DO UPDATE SET
      parent_id = excluded.parent_id,
      folder_key = excluded.folder_key,
      folder_label = excluded.folder_label,
      folder_role = excluded.folder_role,
      rel_path = excluded.rel_path,
      depth = excluded.depth,
      sort_order = excluded.sort_order,
      is_system = excluded.is_system,
      managed_by = excluded.managed_by,
      updated_at = excluded.updated_at
  `).run(
    pilotId,
    parentId,
    folder.folderKey,
    folder.folderLabel,
    folder.folderRole || "custom",
    folder.absPath,
    folder.relPath || relFromDocServer(folder.absPath),
    Number(folder.depth || 0),
    Number(folder.sortOrder || 0),
    Number(folder.isSystem ? 1 : 0),
    actorName,
    timestamp,
    timestamp
  );

  return db.prepare(`
    SELECT id, abs_path
    FROM doc_folders
    WHERE pilot_id = ? AND abs_path = ?
  `).get(pilotId, folder.absPath);
}

function ensureDocumentationBootstrapForPilot(pilot, actorName = "Systeme") {
  if (!pilot || !pilot.id) {
    const error = new Error("Compte pilote introuvable pour l'initialisation documentaire");
    error.status = 404;
    throw error;
  }

  ensureDocumentationServerRoots();
  const structure = buildPilotDocumentationPaths(pilot);
  [structure.pilotRoot, structure.archivesRoot, structure.trashRoot, structure.logsRoot].forEach(ensureDir);
  structure.processFolders.forEach((folder) => ensureDir(folder.absPath));

  const timestamp = now();
  db.prepare(`
    INSERT INTO doc_settings (
      pilot_id, server_root, documents_root, archives_root, trash_root, logs_root, pilot_root,
      hierarchy_json, auto_create_folders, managed_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pilot_id) DO UPDATE SET
      server_root = excluded.server_root,
      documents_root = excluded.documents_root,
      archives_root = excluded.archives_root,
      trash_root = excluded.trash_root,
      logs_root = excluded.logs_root,
      pilot_root = excluded.pilot_root,
      hierarchy_json = excluded.hierarchy_json,
      auto_create_folders = excluded.auto_create_folders,
      managed_by = excluded.managed_by,
      updated_at = excluded.updated_at
  `).run(
    pilot.id,
    DOC_SERVER_ROOT,
    DOC_SERVER_DIRS.documents,
    structure.archivesRoot,
    structure.trashRoot,
    structure.logsRoot,
    structure.pilotRoot,
    JSON.stringify(DEFAULT_DOC_HIERARCHY),
    1,
    actorName,
    timestamp,
    timestamp
  );

  const pilotRootFolder = upsertDocumentationFolder(pilot.id, {
    folderKey: structure.pilotFolder,
    folderLabel: pilot.orgName || pilot.name || structure.pilotFolder,
    folderRole: "pilot_root",
    absPath: structure.pilotRoot,
    relPath: relFromDocServer(structure.pilotRoot),
    depth: 0,
    sortOrder: 0,
    isSystem: 1
  }, actorName);

  upsertDocumentationFolder(pilot.id, {
    folderKey: `${structure.pilotFolder}_archives`,
    folderLabel: "Archives",
    folderRole: "archives_root",
    absPath: structure.archivesRoot,
    relPath: relFromDocServer(structure.archivesRoot),
    depth: 0,
    sortOrder: 10,
    isSystem: 1
  }, actorName);

  upsertDocumentationFolder(pilot.id, {
    folderKey: `${structure.pilotFolder}_trash`,
    folderLabel: "Corbeille",
    folderRole: "trash_root",
    absPath: structure.trashRoot,
    relPath: relFromDocServer(structure.trashRoot),
    depth: 0,
    sortOrder: 11,
    isSystem: 1
  }, actorName);

  upsertDocumentationFolder(pilot.id, {
    folderKey: `${structure.pilotFolder}_logs`,
    folderLabel: "Logs",
    folderRole: "logs_root",
    absPath: structure.logsRoot,
    relPath: relFromDocServer(structure.logsRoot),
    depth: 0,
    sortOrder: 12,
    isSystem: 1
  }, actorName);

  structure.processFolders.forEach((folder) => {
    upsertDocumentationFolder(pilot.id, folder, actorName, pilotRootFolder ? pilotRootFolder.id : null);
  });

  return getDocumentationSettingsByPilotId(pilot.id);
}

function updateExistingPilotAccount(email, payload = {}) {
  const target = normEmail(email);
  if (!target) {
    const error = new Error("Adresse e-mail pilote obligatoire");
    error.status = 400;
    throw error;
  }
  if (target === normEmail(MAIN_PILOT.email)) {
    const error = new Error("Le compte pilote principal ne peut pas etre modifie depuis cet ecran");
    error.status = 403;
    throw error;
  }
  const existing = getPilotByEmail(target);
  if (!existing) {
    const error = new Error("Compte pilote introuvable");
    error.status = 404;
    throw error;
  }
  const next = {
    ...existing,
    ...payload,
    email: target,
    password: String(payload.password || existing.password || "")
  };
  return upsertPilotAccount(next);
}

function removePilotAccount(email) {
  const target = normEmail(email);
  if (!target) {
    const error = new Error("Adresse e-mail pilote obligatoire");
    error.status = 400;
    throw error;
  }
  if (target === normEmail(MAIN_PILOT.email)) {
    const error = new Error("Le compte pilote principal ne peut pas etre supprime");
    error.status = 403;
    throw error;
  }
  const existing = getPilotByEmail(target);
  if (!existing) {
    const error = new Error("Compte pilote introuvable");
    error.status = 404;
    throw error;
  }
  deletePilotAccountByEmailStmt().run(target);
  return { email: target };
}

function upsertPilotAccount(payload) {
  const pilot = normalizePilotPayload(payload);
  if (!pilot.email) {
    const error = new Error("Adresse e-mail pilote obligatoire");
    error.status = 400;
    throw error;
  }
  if (!pilot.password) {
    const error = new Error("Mot de passe pilote obligatoire");
    error.status = 400;
    throw error;
  }

  const existing = selectPilotByEmailStmt().get(pilot.email);
  const timestamp = now();
  if (!existing) {
    const result = insertPilotAccountStmt().run(
      pilot.email,
      pilot.password,
      pilot.name,
      pilot.firstName,
      pilot.lastName,
      pilot.role,
      pilot.dept,
      pilot.func,
      pilot.matricule,
      pilot.orgName,
      pilot.status,
      timestamp,
      timestamp
    );
    ensurePilotStateRowStmt().run(Number(result.lastInsertRowid), timestamp, timestamp);
  } else {
    updatePilotAccountByEmailStmt().run(
      pilot.password,
      pilot.name,
      pilot.firstName,
      pilot.lastName,
      pilot.role,
      pilot.dept,
      pilot.func,
      pilot.matricule,
      pilot.orgName,
      pilot.status,
      timestamp,
      pilot.email
    );
    ensurePilotStateRowStmt().run(existing.id, timestamp, timestamp);
  }

  const savedPilot = getPilotByEmail(pilot.email);
  if (savedPilot) ensureDocumentationBootstrapForPilot(savedPilot, "Systeme");
  return savedPilot;
}

function listUsersByPilotEmail(email) {
  return selectPilotUsersStmt().all(normEmail(email)).map(userToAccount);
}

function getUserByPilotAndEmail(pilotEmail, email) {
  const row = selectUserByPilotAndEmailStmt().get(normEmail(pilotEmail), normEmail(email));
  return row ? userToAccount(row) : null;
}

function createUserForPilot(pilotEmail, payload) {
  const pilot = getPilotByEmail(pilotEmail);
  if (!pilot) {
    const error = new Error("Compte pilote introuvable");
    error.status = 404;
    throw error;
  }

  const user = normalizeUserPayload(payload);
  if (!user.firstName || !user.lastName || !user.email) {
    const error = new Error("Prenom, nom et e-mail obligatoires");
    error.status = 400;
    throw error;
  }
  if (!/^\d{4,}$/.test(user.password)) {
    const error = new Error("Mot de passe invalide : saisir au minimum 4 chiffres");
    error.status = 400;
    throw error;
  }
  if (getUserByPilotAndEmail(pilot.email, user.email)) {
    const error = new Error("Cette adresse e-mail existe deja dans la base");
    error.status = 409;
    throw error;
  }

  const timestamp = now();
  const result = insertUserStmt().run(
    pilot.id,
    user.email,
    user.password,
    user.name,
    user.firstName,
    user.lastName,
    user.role,
    user.dept,
    user.func,
    user.matricule,
    user.profile,
    user.status,
    JSON.stringify(user.perms),
    JSON.stringify(user.moduleAccess),
    user.accountType,
    user.createdBy,
    timestamp,
    timestamp
  );

  return getUserByPilotAndEmail(pilot.email, user.email) || {
    ...user,
    id: Number(result.lastInsertRowid),
    pilotId: pilot.id,
    pilotEmail: pilot.email,
    pilotName: pilot.name,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

initDatabase();
if (dbReady && db) {
  const mainPilot = getPilotByEmail(MAIN_PILOT.email);
  if (mainPilot) ensureDocumentationBootstrapForPilot(mainPilot, "Systeme");
}

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  if (["/", "/index.html", "/QualiLab_by_ENNAJEH_v2", "/QualiLab_by_ENNAJEH_v2.html", "/service-worker.js", "/manifest.webmanifest"].includes(req.path)) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  next();
});
app.get("/", (_req, res) => res.sendFile(APP_HTML_PATH, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }));
app.get("/QualiLab_by_ENNAJEH_v2", (_req, res) => res.sendFile(APP_HTML_PATH, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }));
app.get("/QualiLab_by_ENNAJEH_v2.html", (_req, res) => res.sendFile(APP_HTML_PATH, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }));
app.use(express.static(ROOT, { etag: false, lastModified: false }));

app.get("/api/dev/live-reload", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(`retry: 1000\n`);
  res.write(`data: ${JSON.stringify({ ok: true, status: "connected", version: liveReloadVersion, time: now() })}\n\n`);
  liveReloadClients.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch (_error) {
      clearInterval(heartbeat);
      liveReloadClients.delete(res);
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    liveReloadClients.delete(res);
    try { res.end(); } catch (_error) { }
  });
});

app.get("/api/health", (_req, res) => {
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    driver: "express + sqlite",
    database: activeDbPath,
    documentationServerRoot: DOC_SERVER_ROOT,
    time: now(),
    error: dbInitError ? dbInitError.message : null
  });
});

app.use("/api", (_req, res, next) => {
  if (dbReady && db) return next();
  return res.status(503).json({
    ok: false,
    message: "Base de donnees indisponible",
    detail: dbInitError ? dbInitError.message : ""
  });
});

app.get("/api/documentation/server", (_req, res) => {
  ensureDocumentationServerRoots();
  res.json({
    ok: true,
    root: DOC_SERVER_ROOT,
    folders: DOC_SERVER_DIRS,
    defaultHierarchy: DEFAULT_DOC_HIERARCHY
  });
});

app.post("/api/auth/login", (req, res) => {
  const email = normEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: "E-mail et mot de passe obligatoires" });
  }

  const pilot = getPilotByEmail(email);
  if (pilot && pilot.password === password && pilot.status === "Actif") {
    return res.json({
      ok: true,
      type: "pilot",
      pilot: {
        email: pilot.email,
        name: pilot.name
      },
      user: pilot
    });
  }

  const users = db.prepare(`
    SELECT u.*, p.email AS pilot_email, p.name AS pilot_name
    FROM users u
    JOIN pilots p ON p.id = u.pilot_id
    WHERE u.email = ? AND u.status = 'Actif'
  `).all(email);

  const userRow = users.find((row) => String(row.password || "") === password);
  if (!userRow) {
    return res.status(401).json({ ok: false, message: "Acces refuse : e-mail ou mot de passe incorrect." });
  }

  const user = userToAccount(userRow);
  return res.json({
    ok: true,
    type: "user",
    pilot: {
      email: user.pilotEmail,
      name: user.pilotName
    },
    user
  });
});

app.post("/api/pilots/register", (req, res) => {
  try {
    const pilot = upsertPilotAccount(req.body || {});
    res.status(201).json({
      ok: true,
      pilot: {
        email: pilot.email,
        name: pilot.name,
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        role: pilot.role,
        dept: pilot.dept,
        func: pilot.func,
        matricule: pilot.matricule,
        orgName: pilot.orgName,
        status: pilot.status
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Creation pilote impossible" });
  }
});

app.put("/api/pilots/:pilotEmail", (req, res) => {
  try {
    const pilot = updateExistingPilotAccount(req.params.pilotEmail, req.body || {});
    res.json({
      ok: true,
      pilot: {
        email: pilot.email,
        name: pilot.name,
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        role: pilot.role,
        dept: pilot.dept,
        func: pilot.func,
        matricule: pilot.matricule,
        orgName: pilot.orgName,
        status: pilot.status
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Modification pilote impossible" });
  }
});

app.delete("/api/pilots/:pilotEmail", (req, res) => {
  try {
    const result = removePilotAccount(req.params.pilotEmail);
    res.json({ ok: true, deleted: result.email });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Suppression pilote impossible" });
  }
});

app.get("/api/pilots/:pilotEmail/users", (req, res) => {
  const pilotEmail = normEmail(req.params.pilotEmail);
  const pilot = getPilotByEmail(pilotEmail);
  if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
  res.json({ ok: true, items: listUsersByPilotEmail(pilotEmail) });
});

app.post("/api/pilots/:pilotEmail/users", (req, res) => {
  try {
    const created = createUserForPilot(req.params.pilotEmail, req.body || {});
    res.status(201).json({ ok: true, item: created });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Creation impossible" });
  }
});

app.get("/api/pilots/:pilotEmail/state", (req, res) => {
  const pilot = getPilotByEmail(req.params.pilotEmail);
  if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
  const row = db.prepare(`
    SELECT state_json, updated_at
    FROM pilot_app_state
    WHERE pilot_id = ?
  `).get(pilot.id);
  res.json({
    ok: true,
    state: parseJson(row && row.state_json, {}),
    updatedAt: row ? row.updated_at : null
  });
});

app.put("/api/pilots/:pilotEmail/state", (req, res) => {
  const pilot = getPilotByEmail(req.params.pilotEmail);
  if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
  const timestamp = now();
  db.prepare(`
    INSERT INTO pilot_app_state (pilot_id, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(pilot_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(pilot.id, JSON.stringify(req.body && req.body.state ? req.body.state : {}), timestamp, timestamp);
  res.json({ ok: true, updatedAt: timestamp });
});

app.get("/api/pilots/:pilotEmail/documentation/settings", (req, res) => {
  const pilot = getPilotByEmail(req.params.pilotEmail);
  if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
  const settings = getDocumentationSettingsByPilotId(pilot.id) || ensureDocumentationBootstrapForPilot(pilot, pilot.name || "Pilote");
  res.json({ ok: true, pilot: { email: pilot.email, name: pilot.name }, settings });
});

app.post("/api/pilots/:pilotEmail/documentation/bootstrap", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const settings = ensureDocumentationBootstrapForPilot(pilot, actorName);
    res.json({ ok: true, pilot: { email: pilot.email, name: pilot.name }, settings });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Initialisation documentaire impossible" });
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, message: "Route API introuvable" });
});

app.listen(PORT, HOST, () => {
  startLiveReloadWatcher();
  console.log(`Quali by ENNAJEH backend ready on http://localhost:${PORT}`);
  lanUrls(PORT).forEach((url) => console.log(`Quali by ENNAJEH mobile access: ${url}`));
  console.log(`Quali by ENNAJEH documentation server root: ${DOC_SERVER_ROOT}`);
  console.log(`Quali by ENNAJEH live reload active on http://localhost:${PORT}/api/dev/live-reload`);
});
