const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_DIR = process.env.QUALILAB_DATA_DIR || os.tmpdir();
const DB_PATH = path.join(DB_DIR, "qualilab.sqlite");
const SCHEMA_PATH = path.join(ROOT, "database", "schema.sql");

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

function now() {
  return new Date().toISOString();
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function ensureDatabase() {
  ensureDir(DB_DIR);
  const db = new DatabaseSync(DB_PATH);
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

const db = ensureDatabase();

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

const selectPilotByEmail = db.prepare("SELECT * FROM pilots WHERE email = ?");
const selectPilotUsers = db.prepare(`
  SELECT u.*, p.email AS pilot_email, p.name AS pilot_name
  FROM users u
  JOIN pilots p ON p.id = u.pilot_id
  WHERE p.email = ?
  ORDER BY u.created_at DESC, u.id DESC
`);
const selectUserByPilotAndEmail = db.prepare(`
  SELECT u.*, p.email AS pilot_email, p.name AS pilot_name
  FROM users u
  JOIN pilots p ON p.id = u.pilot_id
  WHERE p.email = ? AND u.email = ?
`);
const insertUser = db.prepare(`
  INSERT INTO users (
    pilot_id, email, password, name, first_name, last_name, role, dept, func, matricule, profile, status,
    perms_json, module_access_json, account_type, created_by, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function getPilotByEmail(email) {
  const row = selectPilotByEmail.get(normEmail(email));
  return row ? pilotToAccount(row) : null;
}

function listUsersByPilotEmail(email) {
  return selectPilotUsers.all(normEmail(email)).map(userToAccount);
}

function getUserByPilotAndEmail(pilotEmail, email) {
  const row = selectUserByPilotAndEmail.get(normEmail(pilotEmail), normEmail(email));
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
  const result = insertUser.run(
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

app.use(express.json({ limit: "2mb" }));
app.use(express.static(ROOT));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    driver: "express + sqlite",
    database: path.relative(ROOT, DB_PATH),
    time: now()
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

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, message: "Route API introuvable" });
});

app.listen(PORT, HOST, () => {
  console.log(`QualiLab backend ready on http://localhost:${PORT}`);
  lanUrls(PORT).forEach((url) => console.log(`QualiLab mobile access: ${url}`));
});
