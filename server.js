const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
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
const TOP_PYRAMID_DOC_TYPES = ["Manuel qualité", "Politique Qualité"];
const TOP_PYRAMID_ARCHIVE_STATUSES = ["Archive"];
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
const documentationEventClients = new Map();
const pilotEventClients = new Map();
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

function normalizeDocProcessFolders(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || "").split(/\r?\n|,/);
  const clean = list
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return [...new Set(clean)].length ? [...new Set(clean)] : [...DEFAULT_DOC_PROCESS_FOLDERS];
}

function normalizeDocVersionFolder(value) {
  const label = String(value || "1.0").trim() || "1.0";
  return slugifySegment(`v_${label}`, "v_1_0");
}

function safeDocumentFileName(fileName, fallbackBase = "document", fallbackExt = ".bin") {
  const parsed = path.parse(String(fileName || "").trim() || `${fallbackBase}${fallbackExt}`);
  const base = slugifySegment(parsed.name || fallbackBase, fallbackBase);
  const ext = parsed.ext ? parsed.ext.replace(/[^.\w-]+/g, "") : fallbackExt;
  return `${base}${ext || fallbackExt}`;
}

function webPathFromAbsolute(absPath) {
  return `/${path.relative(ROOT, absPath).split(path.sep).join("/")}`;
}

function buildPilotDocumentationPaths(pilot, processFolders = DEFAULT_DOC_PROCESS_FOLDERS) {
  const pilotFolder = slugifySegment(pilot.orgName || pilot.name || pilot.email || `pilot_${pilot.id}`, `pilot_${pilot.id || "root"}`);
  const pilotRoot = path.join(DOC_SERVER_DIRS.documents, pilotFolder);
  return {
    pilotFolder,
    pilotRoot,
    archivesRoot: path.join(DOC_SERVER_DIRS.archives, pilotFolder),
    trashRoot: path.join(DOC_SERVER_DIRS.trash, pilotFolder),
    logsRoot: path.join(DOC_SERVER_DIRS.logs, pilotFolder),
    topDocs: TOP_PYRAMID_DOC_TYPES.map((label, index) => ({
      folderKey: slugifySegment(label, `top_doc_${index + 1}`),
      folderLabel: label,
      folderRole: "top_doc",
      absPath: path.join(pilotRoot, label),
      relPath: relFromDocServer(path.join(pilotRoot, label)),
      depth: 1,
      sortOrder: 100 + index,
      isSystem: 1,
      branches: [
        {
          folderKey: slugifySegment(`${label}_document_en_vigueur`, `top_doc_current_${index + 1}`),
          folderLabel: "document en vigueur",
          folderRole: "top_doc_current",
          absPath: path.join(pilotRoot, label, "document en vigueur"),
          relPath: relFromDocServer(path.join(pilotRoot, label, "document en vigueur")),
          depth: 2,
          sortOrder: 1,
          isSystem: 1
        },
        {
          folderKey: slugifySegment(`${label}_document_en_archive`, `top_doc_archive_${index + 1}`),
          folderLabel: "document en archive",
          folderRole: "top_doc_archive",
          absPath: path.join(pilotRoot, label, "document en archive"),
          relPath: relFromDocServer(path.join(pilotRoot, label, "document en archive")),
          depth: 2,
          sortOrder: 2,
          isSystem: 1
        }
      ]
    })),
    processFolders: normalizeDocProcessFolders(processFolders).map((label, index) => ({
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

function documentationClientBucket(pilotEmail) {
  const key = normEmail(pilotEmail);
  if (!documentationEventClients.has(key)) documentationEventClients.set(key, new Set());
  return documentationEventClients.get(key);
}

function pilotEventBucket(pilotEmail) {
  const key = normEmail(pilotEmail);
  if (!pilotEventClients.has(key)) pilotEventClients.set(key, new Set());
  return pilotEventClients.get(key);
}

function recordPilotChangeEvent(pilot, moduleKey, action, payload = {}) {
  if (!pilot || !pilot.id) return null;
  const event = {
    pilotId: Number(pilot.id),
    pilotEmail: normEmail(pilot.email),
    moduleKey: String(moduleKey || "app").trim() || "app",
    entityType: String(payload.entityType || "").trim(),
    entityId: String(payload.entityId || "").trim(),
    action: String(action || "update").trim() || "update",
    actorName: String(payload.actorName || "").trim(),
    createdAt: now(),
    payload: {
      ...payload,
      entityType: undefined,
      entityId: undefined,
      actorName: undefined
    }
  };
  db.prepare(`
    INSERT INTO change_events (
      pilot_id, pilot_email, module_key, entity_type, entity_id, action, payload_json, actor_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.pilotId,
    event.pilotEmail,
    event.moduleKey,
    event.entityType,
    event.entityId,
    event.action,
    JSON.stringify(event.payload || {}),
    event.actorName,
    event.createdAt
  );
  return event;
}

function emitPilotEvent(pilot, moduleKey, action = "update", payload = {}) {
  if (!pilot || !pilot.email) return;
  const event = recordPilotChangeEvent(pilot, moduleKey, action, payload) || {
    pilotEmail: normEmail(pilot.email),
    moduleKey,
    action,
    actorName: String(payload.actorName || "").trim(),
    createdAt: now(),
    payload
  };
  const bucket = pilotEventClients.get(normEmail(pilot.email));
  if (!bucket || !bucket.size) return;
  const data = JSON.stringify({
    ok: true,
    pilotEmail: event.pilotEmail,
    moduleKey: event.moduleKey,
    action: event.action,
    actorName: event.actorName,
    createdAt: event.createdAt,
    payload: event.payload || {}
  });
  [...bucket].forEach((res) => {
    try {
      res.write(`event: pilot-update\n`);
      res.write(`data: ${data}\n\n`);
    } catch (_error) {
      bucket.delete(res);
    }
  });
  if (!bucket.size) pilotEventClients.delete(normEmail(pilot.email));
}

function summarizeStateArray(items, keyField = "id") {
  const arr = Array.isArray(items) ? items : [];
  return JSON.stringify(arr.map((item) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      id: row[keyField] ?? row.id ?? row.ref ?? "",
      status: row.status ?? row.st ?? "",
      updatedAt: row.updatedAt ?? row.updated_at ?? row.savedAt ?? row.modified ?? ""
    };
  }));
}

function detectStateModuleChanges(prevState, nextState) {
  const prev = prevState && typeof prevState === "object" ? prevState : {};
  const next = nextState && typeof nextState === "object" ? nextState : {};
  const checks = [
    { moduleKey: "docorg", entityType: "orgDocs", summary: summarizeStateArray(prev.orgDocs), nextSummary: summarizeStateArray(next.orgDocs), count: Array.isArray(next.orgDocs) ? next.orgDocs.length : 0 },
    { moduleKey: "plan", entityType: "planning", summary: summarizeStateArray(prev.plan), nextSummary: summarizeStateArray(next.plan), count: Array.isArray(next.plan) ? next.plan.length : 0 },
    { moduleKey: "stat", entityType: "statistique", summary: summarizeStateArray(prev.stat), nextSummary: summarizeStateArray(next.stat), count: Array.isArray(next.stat) ? next.stat.length : 0 }
  ];
  return checks.filter((item) => item.summary !== item.nextSummary).map((item) => ({
    moduleKey: item.moduleKey,
    entityType: item.entityType,
    count: item.count
  }));
}

function emitDocumentationEvent(pilotEmail, action = "documentation-update", payload = {}) {
  const key = normEmail(pilotEmail);
  if (!key) return;
  const bucket = documentationEventClients.get(key);
  if (bucket && bucket.size) {
    const data = JSON.stringify({
      ok: true,
      action,
      pilotEmail: key,
      time: now(),
      ...payload
    });
    [...bucket].forEach((res) => {
      try {
        res.write(`event: documentation-update\n`);
        res.write(`data: ${data}\n\n`);
      } catch (_error) {
        bucket.delete(res);
      }
    });
    if (!bucket.size) documentationEventClients.delete(key);
  }
  const pilot = getPilotByEmail(key);
  if (pilot) {
    emitPilotEvent(pilot, "docorg", action, {
      actorName: payload.actorName || "",
      entityType: "documentation",
      entityId: String(payload.documentId || payload.ref || ""),
      eventLabel: payload.eventLabel || "",
      processName: payload.processName || "",
      docType: payload.docType || "",
      versionLabel: payload.versionLabel || ""
    });
  }
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

function ensureDocumentationBootstrapForPilot(pilot, actorName = "Systeme", options = {}) {
  if (!pilot || !pilot.id) {
    const error = new Error("Compte pilote introuvable pour l'initialisation documentaire");
    error.status = 404;
    throw error;
  }

  ensureDocumentationServerRoots();
  const existingSettings = getDocumentationSettingsByPilotId(pilot.id);
  const processFolders = normalizeDocProcessFolders(
    options.processFolders
    || (existingSettings && existingSettings.hierarchy && existingSettings.hierarchy.processFolders)
    || DEFAULT_DOC_PROCESS_FOLDERS
  );
  const hierarchy = {
    levels: ["process", "type", "reference", "version"],
    processFolders
  };
  const structure = buildPilotDocumentationPaths(pilot, processFolders);
  [structure.pilotRoot, structure.archivesRoot, structure.trashRoot, structure.logsRoot].forEach(ensureDir);
  structure.processFolders.forEach((folder) => ensureDir(folder.absPath));
  structure.topDocs.forEach((folder) => {
    ensureDir(folder.absPath);
    (folder.branches || []).forEach((branch) => ensureDir(branch.absPath));
  });

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
    JSON.stringify(hierarchy),
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
  structure.topDocs.forEach((folder) => {
    const topFolder = upsertDocumentationFolder(pilot.id, folder, actorName, pilotRootFolder ? pilotRootFolder.id : null);
    (folder.branches || []).forEach((branch) => {
      upsertDocumentationFolder(pilot.id, branch, actorName, topFolder ? topFolder.id : null);
    });
  });

  return getDocumentationSettingsByPilotId(pilot.id);
}

function getFolderByPilotAndPath(pilotId, absPath) {
  return db.prepare(`
    SELECT *
    FROM doc_folders
    WHERE pilot_id = ? AND abs_path = ?
  `).get(pilotId, absPath);
}

function listDocumentationFoldersByPilotId(pilotId) {
  return db.prepare(`
    SELECT id, parent_id, folder_key, folder_label, folder_role, abs_path, rel_path, depth, sort_order, is_system, managed_by, created_at, updated_at
    FROM doc_folders
    WHERE pilot_id = ?
    ORDER BY depth ASC, sort_order ASC, folder_label COLLATE NOCASE ASC
  `).all(pilotId).map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    key: row.folder_key,
    label: row.folder_label,
    role: row.folder_role,
    absPath: row.abs_path,
    relPath: row.rel_path,
    webPath: webPathFromAbsolute(row.abs_path),
    depth: row.depth,
    sortOrder: row.sort_order,
    isSystem: Boolean(row.is_system),
    managedBy: row.managed_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function mapDocumentationRow(row) {
  return {
    id: row.id,
    pilotId: row.pilot_id,
    folderId: row.folder_id,
    ref: row.doc_ref,
    title: row.title,
    processName: row.process_name,
    docType: row.doc_type,
    versionLabel: row.version_label,
    status: row.status,
    ownerName: row.owner_name,
    verifierName: row.verifier_name,
    approverName: row.approver_name,
    diffuserName: row.diffuser_name,
    fileName: row.file_name,
    fileExt: row.file_ext,
    mimeType: row.mime_type,
    relPath: row.rel_path,
    absPath: row.abs_path,
    webUrl: row.source_url || webPathFromAbsolute(row.abs_path),
    fileSize: row.file_size,
    checksum: row.checksum || "",
    storageMode: row.storage_mode,
    notes: row.notes || "",
    archivedAt: row.archived_at || "",
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listDocumentationDocumentsByPilotId(pilotId) {
  return db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ?
    ORDER BY updated_at DESC, id DESC
  `).all(pilotId).map(mapDocumentationRow);
}

function listDocumentationEventsByPilotId(pilotId, limit = 60) {
  return db.prepare(`
    SELECT
      e.id,
      e.document_id,
      e.event_type,
      e.event_label,
      e.actor_name,
      e.event_detail,
      e.created_at,
      d.doc_ref,
      d.title,
      d.process_name,
      d.doc_type,
      d.version_label,
      d.status,
      d.file_name,
      d.abs_path,
      d.source_url
    FROM document_events e
    LEFT JOIN documents d ON d.id = e.document_id
    WHERE d.pilot_id = ?
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ?
  `).all(pilotId, Math.max(1, Math.min(200, Number(limit) || 60))).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    eventType: row.event_type,
    eventLabel: row.event_label,
    actorName: row.actor_name || "",
    eventDetail: row.event_detail || "",
    createdAt: row.created_at,
    ref: row.doc_ref || "",
    title: row.title || "",
    processName: row.process_name || "",
    docType: row.doc_type || "",
    versionLabel: row.version_label || "",
    status: row.status || "",
    fileName: row.file_name || "",
    absPath: row.abs_path || "",
    webUrl: row.source_url || (row.abs_path ? webPathFromAbsolute(row.abs_path) : "")
  }));
}

function appendDocumentEvent(documentId, eventType, eventLabel, actorName, eventDetail, createdAt = now()) {
  db.prepare(`
    INSERT INTO document_events (
      document_id, event_type, event_label, actor_name, event_detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(documentId, eventType, eventLabel, actorName, eventDetail, createdAt);
  return createdAt;
}

function decodeDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const error = new Error("Fichier invalide : donnees base64 introuvables");
    error.status = 400;
    throw error;
  }
  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64")
  };
}

function mimeTypeFromFileName(fileName) {
  const ext = String(path.extname(String(fileName || "")).toLowerCase()).replace(/^\./, "");
  return {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation"
  }[ext] || "application/octet-stream";
}

function versionLabelFromFolder(folderName) {
  const raw = String(folderName || "").trim();
  if (!raw) return "1.0";
  if (/^v[_-]/i.test(raw)) return raw.slice(2).replace(/_/g, ".").replace(/-/g, ".");
  return raw.replace(/_/g, ".").replace(/-/g, ".");
}

function scannedDocRefFromName(fileName, docType) {
  const prefixes = {
    Procedure: "PRO",
    Instruction: "INS",
    Formulaire: "FOR",
    Enregistrement: "ENR",
    "Manuel qualité": "MQ",
    "Politique Qualité": "POL"
  };
  const base = path.basename(String(fileName || ""), path.extname(String(fileName || "")))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${prefixes[docType] || "DOC"}-${base || "001"}`;
}

function scannedTitleFromName(fileName) {
  return path.basename(String(fileName || ""), path.extname(String(fileName || "")))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Document";
}

function collectFilesRecursive(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        if (entry.name.startsWith(".")) continue;
        files.push(abs);
      }
    }
  }
  return files;
}

function ensureDocumentationFolderRowsForExistingFile(pilot, settings, absFilePath, actorName = "Systeme") {
  const pilotRootFolder = getFolderByPilotAndPath(pilot.id, settings.pilotRoot);
  const relDir = path.relative(settings.pilotRoot, path.dirname(absFilePath));
  const segments = relDir.split(path.sep).filter(Boolean);
  let currentPath = settings.pilotRoot;
  let parentId = pilotRootFolder ? pilotRootFolder.id : null;
  const isTopPyramid = TOP_PYRAMID_DOC_TYPES.includes(segments[0]);
  let deepest = pilotRootFolder;
  segments.forEach((segment, index) => {
    currentPath = path.join(currentPath, segment);
    const role = index === 0
      ? (isTopPyramid ? "top_doc" : "process")
      : index === 1
        ? (isTopPyramid ? (segment === "document en archive" ? "top_doc_archive" : "top_doc_current") : "type")
        : index === 2
          ? "reference"
          : "version";
    deepest = upsertDocumentationFolder(pilot.id, {
      folderKey: slugifySegment(segment, `${role}_${index + 1}`),
      folderLabel: segment,
      folderRole: role,
      absPath: currentPath,
      relPath: relFromDocServer(currentPath),
      depth: index + 1,
      sortOrder: index + 1,
      isSystem: 0
    }, actorName, parentId);
    parentId = deepest ? deepest.id : parentId;
  });
  return deepest ? deepest.id : parentId;
}

function buildDocumentationScanPayload(absPath, settings) {
  const rel = path.relative(settings.pilotRoot, absPath);
  if (!rel || rel.startsWith("..")) return null;
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length < 2) return null;
  const fileName = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  if (!fileName) return null;

  let processName = DEFAULT_DOC_PROCESS_FOLDERS[0];
  let docType = "Procedure";
  let status = "Brouillon";
  let docRef = "";
  let versionLabel = "1.0";

  if (TOP_PYRAMID_DOC_TYPES.includes(dirParts[0])) {
    docType = dirParts[0];
    processName = "Processus pilotage";
    status = dirParts[1] === "document en archive" ? "Archive" : "Approuve";
    docRef = dirParts[2] || scannedDocRefFromName(fileName, docType);
    versionLabel = versionLabelFromFolder(dirParts[3] || "v_1_0");
  } else {
    processName = dirParts[0] || DEFAULT_DOC_PROCESS_FOLDERS[0];
    docType = dirParts[1] || "Procedure";
    docRef = dirParts[2] || scannedDocRefFromName(fileName, docType);
    versionLabel = versionLabelFromFolder(dirParts[3] || "v_1_0");
    status = "Brouillon";
  }

  return {
    title: scannedTitleFromName(fileName),
    fileName,
    processName,
    docType,
    docRef,
    versionLabel,
    status,
    absPath
  };
}

function registerExistingDocumentationFile(pilot, payload = {}, actorName = "Systeme") {
  const absPath = String(payload.absPath || "").trim();
  if (!absPath || !fs.existsSync(absPath)) return null;
  const stat = fs.statSync(absPath);
  const settings = getDocumentationSettingsByPilotId(pilot.id) || ensureDocumentationBootstrapForPilot(pilot, actorName);
  const existing = db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ? AND abs_path = ?
  `).get(pilot.id, absPath);
  if (existing) return mapDocumentationRow(existing);

  const folderId = ensureDocumentationFolderRowsForExistingFile(pilot, settings, absPath, actorName);
  const relPath = relFromDocServer(absPath);
  const webUrl = webPathFromAbsolute(absPath);
  const timestamp = now();
  const fileName = path.basename(absPath);
  const fileExt = path.extname(fileName).replace(/^\./, "");
  const mimeType = mimeTypeFromFileName(fileName);

  const result = db.prepare(`
    INSERT INTO documents (
      pilot_id, folder_id, doc_ref, title, process_name, doc_type, version_label, status,
      owner_name, verifier_name, approver_name, diffuser_name, file_name, file_ext, mime_type,
      rel_path, abs_path, file_size, checksum, storage_mode, source_url, notes, archived_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pilot.id,
    folderId,
    payload.docRef,
    payload.title,
    payload.processName,
    payload.docType,
    payload.versionLabel,
    payload.status,
    "",
    "",
    "",
    "",
    fileName,
    fileExt,
    mimeType,
    relPath,
    absPath,
    stat.size,
    "",
    "local_server_scan",
    webUrl,
    "Document detecte automatiquement depuis le dossier de stockage",
    payload.status === "Archive" ? timestamp : null,
    actorName,
    timestamp,
    timestamp
  );
  const documentId = Number(result.lastInsertRowid);
  db.prepare(`
    INSERT INTO document_versions (
      document_id, version_label, status, file_name, rel_path, abs_path, file_size, checksum, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    payload.versionLabel,
    payload.status,
    fileName,
    relPath,
    absPath,
    stat.size,
    "",
    actorName,
    timestamp
  );
  appendDocumentEvent(documentId, "scan", "Document detecte depuis D:", actorName, `${payload.docRef} | ${fileName}`, timestamp);
  return mapDocumentationRow(db.prepare(`SELECT * FROM documents WHERE id = ?`).get(documentId));
}

function scanDocumentationRepository(pilot, actorName = "Systeme") {
  const settings = getDocumentationSettingsByPilotId(pilot.id) || ensureDocumentationBootstrapForPilot(pilot, actorName);
  const files = collectFilesRecursive(settings.pilotRoot);
  const existingPaths = new Set(
    db.prepare(`SELECT abs_path FROM documents WHERE pilot_id = ?`).all(pilot.id).map((row) => String(row.abs_path || "").toLowerCase())
  );
  const added = [];
  const skipped = [];
  files.forEach((absPath) => {
    const normalized = String(absPath || "").toLowerCase();
    if (existingPaths.has(normalized)) {
      skipped.push({ absPath, reason: "already_registered" });
      return;
    }
    const payload = buildDocumentationScanPayload(absPath, settings);
    if (!payload) {
      skipped.push({ absPath, reason: "unsupported_path" });
      return;
    }
    const item = registerExistingDocumentationFile(pilot, payload, actorName);
    if (item) {
      added.push(item);
      existingPaths.add(normalized);
    }
  });
  if (added.length) {
    emitDocumentationEvent(pilot.email, "documentation-scan", {
      eventType: "scan",
      eventLabel: "Synchronisation documentaire depuis D:",
      actorName,
      addedCount: added.length
    });
  }
  return {
    scannedCount: files.length,
    addedCount: added.length,
    skippedCount: skipped.length,
    added,
    skipped
  };
}

function ensureDocumentationFolderStructure(pilot, payload = {}, actorName = "Systeme") {
  const settings = ensureDocumentationBootstrapForPilot(pilot, actorName);
  const hierarchy = settings.hierarchy || DEFAULT_DOC_HIERARCHY;
  const processName = String(payload.processName || hierarchy.processFolders[0] || DEFAULT_DOC_PROCESS_FOLDERS[0]).trim();
  const docType = String(payload.docType || "Procedure").trim() || "Procedure";
  const docRef = String(payload.docRef || "DOC-001").trim() || "DOC-001";
  const versionLabel = String(payload.versionLabel || "1.0").trim() || "1.0";
  const versionFolder = normalizeDocVersionFolder(versionLabel);
  const isTopPyramidDoc = TOP_PYRAMID_DOC_TYPES.includes(docType);
  const useArchiveBranch = TOP_PYRAMID_ARCHIVE_STATUSES.includes(String(payload.status || "").trim());
  const topBranchLabel = useArchiveBranch ? "document en archive" : "document en vigueur";
  const processPath = isTopPyramidDoc
    ? path.join(settings.pilotRoot, docType)
    : path.join(settings.pilotRoot, processName);
  const typePath = isTopPyramidDoc
    ? path.join(processPath, topBranchLabel)
    : path.join(processPath, docType);
  const refPath = path.join(typePath, docRef);
  const versionPath = path.join(refPath, versionFolder);

  [processPath, typePath, refPath, versionPath].forEach(ensureDir);

  const pilotRootFolder = getFolderByPilotAndPath(pilot.id, settings.pilotRoot);
  const processFolder = upsertDocumentationFolder(pilot.id, {
    folderKey: slugifySegment(isTopPyramidDoc ? docType : processName, "process"),
    folderLabel: isTopPyramidDoc ? docType : processName,
    folderRole: isTopPyramidDoc ? "top_doc" : "process",
    absPath: processPath,
    relPath: relFromDocServer(processPath),
    depth: 1,
    sortOrder: 1,
    isSystem: 1
  }, actorName, pilotRootFolder ? pilotRootFolder.id : null);
  const typeFolder = upsertDocumentationFolder(pilot.id, {
    folderKey: slugifySegment(isTopPyramidDoc ? topBranchLabel : docType, "type"),
    folderLabel: isTopPyramidDoc ? topBranchLabel : docType,
    folderRole: isTopPyramidDoc ? (useArchiveBranch ? "top_doc_archive" : "top_doc_current") : "type",
    absPath: typePath,
    relPath: relFromDocServer(typePath),
    depth: 2,
    sortOrder: 1,
    isSystem: 0
  }, actorName, processFolder ? processFolder.id : null);
  const refFolder = upsertDocumentationFolder(pilot.id, {
    folderKey: slugifySegment(docRef, "ref"),
    folderLabel: docRef,
    folderRole: "reference",
    absPath: refPath,
    relPath: relFromDocServer(refPath),
    depth: 3,
    sortOrder: 1,
    isSystem: 0
  }, actorName, typeFolder ? typeFolder.id : null);
  const versionFolderRow = upsertDocumentationFolder(pilot.id, {
    folderKey: versionFolder,
    folderLabel: versionLabel,
    folderRole: "version",
    absPath: versionPath,
    relPath: relFromDocServer(versionPath),
    depth: 4,
    sortOrder: 1,
    isSystem: 0
  }, actorName, refFolder ? refFolder.id : null);

  return {
    settings,
    processName,
    docType,
    topBranchLabel,
    isTopPyramidDoc,
    docRef,
    versionLabel,
    versionFolder,
    processPath,
    typePath,
    refPath,
    versionPath,
    versionFolderId: versionFolderRow ? versionFolderRow.id : null
  };
}

function createDocumentationFolderOnly(pilot, payload = {}, actorName = "Systeme") {
  const target = ensureDocumentationFolderStructure(pilot, payload, actorName);
  return {
    processName: target.processName,
    docType: target.docType,
    docRef: target.docRef,
    versionLabel: target.versionLabel,
    versionPath: target.versionPath,
    webPath: webPathFromAbsolute(target.versionPath)
  };
}

function createDocumentationImport(pilot, payload = {}, actorName = "Systeme") {
  const title = String(payload.title || "").trim();
  const fileName = String(payload.fileName || "").trim();
  const dataUrl = String(payload.dataUrl || "").trim();
  if (!title || !fileName || !dataUrl) {
    const error = new Error("Titre, nom de fichier et contenu du fichier obligatoires");
    error.status = 400;
    throw error;
  }

  const target = ensureDocumentationFolderStructure(pilot, payload, actorName);
  const decoded = decodeDataUrl(dataUrl);
  const safeName = safeDocumentFileName(fileName, payload.docRef || "document", path.extname(fileName) || ".bin");
  const absPath = path.join(target.versionPath, safeName);
  fs.writeFileSync(absPath, decoded.buffer);

  const timestamp = now();
  const existing = db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ? AND doc_ref = ? AND version_label = ? AND file_name = ?
  `).get(pilot.id, target.docRef, target.versionLabel, safeName);
  const relPath = relFromDocServer(absPath);
  const webUrl = webPathFromAbsolute(absPath);
  const ownerName = String(payload.ownerName || pilot.name || "").trim();
  const verifierName = String(payload.verifierName || "").trim();
  const approverName = String(payload.approverName || "").trim();
  const diffuserName = String(payload.diffuserName || "").trim();
  const notes = String(payload.notes || "").trim();
  const status = String(payload.status || "Brouillon").trim() || "Brouillon";
  const fileExt = path.extname(safeName).replace(/^\./, "");
  let documentId = existing ? existing.id : null;

  if (!existing) {
    const result = db.prepare(`
      INSERT INTO documents (
        pilot_id, folder_id, doc_ref, title, process_name, doc_type, version_label, status,
        owner_name, verifier_name, approver_name, diffuser_name, file_name, file_ext, mime_type,
        rel_path, abs_path, file_size, checksum, storage_mode, source_url, notes, archived_at, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pilot.id,
      target.versionFolderId,
      target.docRef,
      title,
      target.processName,
      target.docType,
      target.versionLabel,
      status,
      ownerName,
      verifierName,
      approverName,
      diffuserName,
      safeName,
      fileExt,
      String(payload.mimeType || decoded.mimeType || "application/octet-stream"),
      relPath,
      absPath,
      decoded.buffer.length,
      "",
      "local_server",
      webUrl,
      notes,
      null,
      actorName,
      timestamp,
      timestamp
    );
    documentId = Number(result.lastInsertRowid);
  } else {
    db.prepare(`
      UPDATE documents
      SET folder_id = ?, title = ?, process_name = ?, doc_type = ?, version_label = ?, status = ?,
          owner_name = ?, verifier_name = ?, approver_name = ?, diffuser_name = ?, file_ext = ?, mime_type = ?,
          rel_path = ?, abs_path = ?, file_size = ?, storage_mode = 'local_server', source_url = ?,
          notes = ?, updated_at = ?, archived_at = NULL
      WHERE id = ?
    `).run(
      target.versionFolderId,
      title,
      target.processName,
      target.docType,
      target.versionLabel,
      status,
      ownerName,
      verifierName,
      approverName,
      diffuserName,
      fileExt,
      String(payload.mimeType || decoded.mimeType || "application/octet-stream"),
      relPath,
      absPath,
      decoded.buffer.length,
      webUrl,
      notes,
      timestamp,
      existing.id
    );
  }

  db.prepare(`
    INSERT INTO document_versions (
      document_id, version_label, status, file_name, rel_path, abs_path, file_size, checksum, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    target.versionLabel,
    status,
    safeName,
    relPath,
    absPath,
    decoded.buffer.length,
    "",
    actorName,
    timestamp
  );

  const eventType = existing ? "update" : "create";
  const eventLabel = existing ? "Mise a jour du document central" : "Importation du document central";
  appendDocumentEvent(documentId, eventType, eventLabel, actorName, `${target.docRef} | ${safeName} | ${target.versionLabel}`, timestamp);

  const row = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(documentId);
  const mapped = mapDocumentationRow(row);
  emitDocumentationEvent(pilot.email, "documentation-import", {
    documentId,
    eventType,
    eventLabel,
    ref: mapped.ref,
    title: mapped.title,
    status: mapped.status,
    processName: mapped.processName,
    docType: mapped.docType,
    versionLabel: mapped.versionLabel,
    webUrl: mapped.webUrl
  });
  return mapped;
}

function archiveDocumentationDocument(pilot, documentId, actorName = "Systeme") {
  const row = db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ? AND id = ?
  `).get(pilot.id, Number(documentId));
  if (!row) {
    const error = new Error("Document central introuvable");
    error.status = 404;
    throw error;
  }
  const settings = getDocumentationSettingsByPilotId(pilot.id) || ensureDocumentationBootstrapForPilot(pilot, actorName);
  const archiveDir = path.join(
    settings.archivesRoot,
    String(row.process_name || "Processus_support"),
    String(row.doc_type || "Document"),
    String(row.doc_ref || "DOC"),
    normalizeDocVersionFolder(row.version_label || "1.0")
  );
  ensureDir(archiveDir);
  const archivedPath = path.join(archiveDir, path.basename(row.abs_path));
  try {
    if (fs.existsSync(row.abs_path) && row.abs_path !== archivedPath) fs.renameSync(row.abs_path, archivedPath);
  } catch {
    if (fs.existsSync(row.abs_path) && row.abs_path !== archivedPath) fs.copyFileSync(row.abs_path, archivedPath);
  }
  const relPath = relFromDocServer(archivedPath);
  const webUrl = webPathFromAbsolute(archivedPath);
  const timestamp = now();
  db.prepare(`
    UPDATE documents
    SET status = 'Archive', rel_path = ?, abs_path = ?, source_url = ?, archived_at = ?, updated_at = ?
    WHERE id = ?
  `).run(relPath, archivedPath, webUrl, timestamp, timestamp, row.id);
  appendDocumentEvent(row.id, "archive", "Archivage du document central", actorName, `${row.doc_ref} | ${path.basename(archivedPath)}`, timestamp);
  const archived = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(row.id);
  const mapped = mapDocumentationRow(archived);
  emitDocumentationEvent(pilot.email, "documentation-archive", {
    documentId: row.id,
    eventType: "archive",
    eventLabel: "Archivage du document central",
    ref: mapped.ref,
    title: mapped.title,
    status: mapped.status,
    processName: mapped.processName,
    docType: mapped.docType,
    versionLabel: mapped.versionLabel,
    webUrl: mapped.webUrl
  });
  return mapped;
}

function updateDocumentationDocumentStatus(pilot, documentId, nextStatus, actorName = "Systeme") {
  const allowed = ["Brouillon", "En revue", "A corriger", "Approuve", "Diffuse", "Archive"];
  const status = String(nextStatus || "").trim();
  if (!allowed.includes(status)) {
    const error = new Error("Statut documentaire central invalide");
    error.status = 400;
    throw error;
  }
  if (status === "Archive") return archiveDocumentationDocument(pilot, documentId, actorName);
  const row = db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ? AND id = ?
  `).get(pilot.id, Number(documentId));
  if (!row) {
    const error = new Error("Document central introuvable");
    error.status = 404;
    throw error;
  }
  const timestamp = now();
  db.prepare(`
    UPDATE documents
    SET status = ?, archived_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(status, timestamp, row.id);
  appendDocumentEvent(row.id, "status", "Statut documentaire mis a jour", actorName, `${row.doc_ref} -> ${status}`, timestamp);
  const updated = mapDocumentationRow(db.prepare(`SELECT * FROM documents WHERE id = ?`).get(row.id));
  emitDocumentationEvent(pilot.email, "documentation-status", {
    documentId: row.id,
    eventType: "status",
    eventLabel: "Statut documentaire mis a jour",
    ref: updated.ref,
    title: updated.title,
    status: updated.status,
    processName: updated.processName,
    docType: updated.docType,
    versionLabel: updated.versionLabel,
    webUrl: updated.webUrl
  });
  return updated;
}

function registerDocumentationOpen(pilot, documentId, actorName = "Systeme", mode = "read") {
  const row = db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ? AND id = ?
  `).get(pilot.id, Number(documentId));
  if (!row) {
    const error = new Error("Document central introuvable");
    error.status = 404;
    throw error;
  }
  const eventType = mode === "open" ? "open" : mode === "download" ? "download" : "read";
  const eventLabel = mode === "open" ? "Ouverture du document central" : mode === "download" ? "Telechargement du document central" : "Lecture du document central";
  appendDocumentEvent(row.id, eventType, eventLabel, actorName, `${row.doc_ref} | ${row.file_name}`, now());
  const mapped = mapDocumentationRow(row);
  emitDocumentationEvent(pilot.email, "documentation-read", {
    documentId: row.id,
    eventType,
    eventLabel,
    ref: mapped.ref,
    title: mapped.title,
    status: mapped.status,
    processName: mapped.processName,
    docType: mapped.docType,
    versionLabel: mapped.versionLabel,
    webUrl: mapped.webUrl
  });
  return mapped;
}

function revealDocumentationDocument(pilot, documentId, actorName = "Systeme") {
  const row = db.prepare(`
    SELECT *
    FROM documents
    WHERE pilot_id = ? AND id = ?
  `).get(pilot.id, Number(documentId));
  if (!row) {
    const error = new Error("Document central introuvable");
    error.status = 404;
    throw error;
  }
  const absPath = String(row.abs_path || "").trim();
  if (!absPath || !fs.existsSync(absPath)) {
    const error = new Error("Le fichier du document n'existe plus sur le serveur local");
    error.status = 404;
    throw error;
  }
  const mapped = mapDocumentationRow(row);
  appendDocumentEvent(row.id, "reveal", "Ouverture de l'emplacement", actorName, `${row.doc_ref} | ${row.file_name}`, now());
  if (process.platform === "win32") {
    const child = spawn("explorer.exe", [`/select,${absPath}`], { detached: true, stdio: "ignore" });
    child.unref();
  }
  emitDocumentationEvent(pilot.email, "documentation-reveal", {
    documentId: row.id,
    eventType: "reveal",
    eventLabel: "Ouverture de l'emplacement",
    ref: mapped.ref,
    title: mapped.title,
    status: mapped.status,
    absPath: mapped.absPath,
    webUrl: mapped.webUrl
  });
  return { item: mapped, folderPath: path.dirname(absPath) };
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

app.use(express.json({ limit: "35mb" }));
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
  const previousRow = db.prepare(`
    SELECT state_json
    FROM pilot_app_state
    WHERE pilot_id = ?
  `).get(pilot.id);
  const previousState = parseJson(previousRow && previousRow.state_json, {});
  const nextState = req.body && req.body.state ? req.body.state : {};
  const timestamp = now();
  db.prepare(`
    INSERT INTO pilot_app_state (pilot_id, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(pilot_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(pilot.id, JSON.stringify(nextState), timestamp, timestamp);
  const actorName = String((req.body && req.body.actorName) || "").trim() || pilot.name || "Pilote";
  detectStateModuleChanges(previousState, nextState).forEach((change) => {
    emitPilotEvent(pilot, change.moduleKey, "state-sync", {
      actorName,
      entityType: change.entityType,
      entityId: "",
      source: "pilot_app_state",
      count: change.count,
      syncedAt: timestamp
    });
  });
  res.json({ ok: true, updatedAt: timestamp });
});

app.get("/api/pilots/:pilotEmail/events/stream", (req, res) => {
  const pilot = getPilotByEmail(req.params.pilotEmail);
  if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(`retry: 1200\n`);
  res.write(`event: pilot-update\n`);
  res.write(`data: ${JSON.stringify({
    ok: true,
    status: "connected",
    pilotEmail: normEmail(pilot.email),
    time: now()
  })}\n\n`);
  const bucket = pilotEventBucket(pilot.email);
  bucket.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch (_error) {
      clearInterval(heartbeat);
      bucket.delete(res);
      if (!bucket.size) pilotEventClients.delete(normEmail(pilot.email));
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    bucket.delete(res);
    if (!bucket.size) pilotEventClients.delete(normEmail(pilot.email));
    try { res.end(); } catch (_error) { }
  });
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
    emitDocumentationEvent(pilot.email, "documentation-bootstrap", {
      eventLabel: "Depot documentaire initialise",
      actorName,
      pilotRoot: settings.pilotRoot
    });
    res.json({ ok: true, pilot: { email: pilot.email, name: pilot.name }, settings });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Initialisation documentaire impossible" });
  }
});

app.put("/api/pilots/:pilotEmail/documentation/settings", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const processFolders = normalizeDocProcessFolders(req.body && req.body.processFolders);
    const settings = ensureDocumentationBootstrapForPilot(pilot, actorName, { processFolders });
    emitDocumentationEvent(pilot.email, "documentation-hierarchy", {
      eventLabel: "Hierarchie documentaire mise a jour",
      actorName,
      processFolders: settings.hierarchy && settings.hierarchy.processFolders ? settings.hierarchy.processFolders : processFolders
    });
    res.json({ ok: true, pilot: { email: pilot.email, name: pilot.name }, settings });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Mise a jour de la hierarchie impossible" });
  }
});

app.get("/api/pilots/:pilotEmail/documentation/folders", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    ensureDocumentationBootstrapForPilot(pilot, pilot.name || "Pilote");
    const items = listDocumentationFoldersByPilotId(pilot.id);
    res.json({ ok: true, items });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Lecture des dossiers impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/scan", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const summary = scanDocumentationRepository(pilot, actorName);
    res.json({ ok: true, summary, items: listDocumentationDocumentsByPilotId(pilot.id) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Scan documentaire impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/folders", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const item = createDocumentationFolderOnly(pilot, req.body || {}, actorName);
    emitDocumentationEvent(pilot.email, "documentation-folder", {
      eventLabel: "Dossier documentaire cree",
      actorName,
      ref: item.docRef,
      processName: item.processName,
      docType: item.docType,
      versionLabel: item.versionLabel,
      versionPath: item.versionPath
    });
    res.status(201).json({ ok: true, item });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Creation du dossier impossible" });
  }
});

app.get("/api/pilots/:pilotEmail/documentation/documents", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    ensureDocumentationBootstrapForPilot(pilot, pilot.name || "Pilote");
    const items = listDocumentationDocumentsByPilotId(pilot.id);
    res.json({ ok: true, items });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Lecture des documents impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/documents/import", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const item = createDocumentationImport(pilot, req.body || {}, actorName);
    res.status(201).json({ ok: true, item });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Importation documentaire impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/documents/:documentId/archive", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const item = archiveDocumentationDocument(pilot, req.params.documentId, actorName);
    res.json({ ok: true, item });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Archivage documentaire impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/documents/:documentId/status", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const status = String((req.body && req.body.status) || "").trim();
    const item = updateDocumentationDocumentStatus(pilot, req.params.documentId, status, actorName);
    res.json({ ok: true, item });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Mise a jour du statut documentaire impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/documents/:documentId/open", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const mode = String((req.body && req.body.mode) || "read").trim() || "read";
    const item = registerDocumentationOpen(pilot, req.params.documentId, actorName, mode);
    res.json({ ok: true, item });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Ouverture documentaire impossible" });
  }
});

app.post("/api/pilots/:pilotEmail/documentation/documents/:documentId/reveal", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const actorName = String((req.body && req.body.actorName) || pilot.name || "Pilote").trim() || "Pilote";
    const result = revealDocumentationDocument(pilot, req.params.documentId, actorName);
    res.json({ ok: true, item: result.item, folderPath: result.folderPath });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Ouverture de l'emplacement impossible" });
  }
});

app.get("/api/pilots/:pilotEmail/documentation/events", (req, res) => {
  try {
    const pilot = getPilotByEmail(req.params.pilotEmail);
    if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
    const items = listDocumentationEventsByPilotId(pilot.id, req.query.limit);
    res.json({ ok: true, items });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Lecture du journal documentaire impossible" });
  }
});

app.get("/api/pilots/:pilotEmail/documentation/events/stream", (req, res) => {
  const pilot = getPilotByEmail(req.params.pilotEmail);
  if (!pilot) return res.status(404).json({ ok: false, message: "Compte pilote introuvable" });
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(`retry: 1200\n`);
  res.write(`data: ${JSON.stringify({ ok: true, status: "connected", pilotEmail: normEmail(pilot.email), time: now() })}\n\n`);
  const bucket = documentationClientBucket(pilot.email);
  bucket.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch (_error) {
      clearInterval(heartbeat);
      bucket.delete(res);
      if (!bucket.size) documentationEventClients.delete(normEmail(pilot.email));
    }
  }, 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    bucket.delete(res);
    if (!bucket.size) documentationEventClients.delete(normEmail(pilot.email));
    try { res.end(); } catch (_error) { }
  });
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
