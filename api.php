<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

function respond($payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function body_json(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (is_array($data)) return $data;
    return $_POST ?: [];
}

function norm_email($value): string {
    return strtolower(trim((string) $value));
}

function path_parts(): array {
    $path = $_SERVER['PATH_INFO'] ?? '';
    if ($path === '') {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
        $script = $_SERVER['SCRIPT_NAME'] ?? '/api.php';
        if (strpos($uri, $script) === 0) $path = substr($uri, strlen($script));
    }
    $path = trim($path, '/');
    return $path === '' ? [] : array_values(array_filter(explode('/', $path), 'strlen'));
}

function pilot_public(array $row): array {
    return [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'firstName' => $row['first_name'] ?? '',
        'lastName' => $row['last_name'] ?? '',
        'role' => $row['role'] ?? 'Administrateur',
        'dept' => $row['dept'] ?? '',
        'func' => $row['func'] ?? '',
        'matricule' => $row['matricule'] ?? '',
        'orgName' => $row['org_name'] ?? '',
        'status' => $row['status'] ?? 'Actif',
        'pilot' => true,
        'perms' => ['Ajouter', 'Modifier', 'Supprimer', 'Valider', 'Telecharger', 'Importer', 'Exporter', 'Parametres', 'Comptes'],
        'profile' => 'Administrateur'
    ];
}

function user_public(array $row): array {
    return [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'firstName' => $row['first_name'] ?? '',
        'lastName' => $row['last_name'] ?? '',
        'role' => $row['role'] ?? '',
        'dept' => $row['dept'] ?? '',
        'func' => $row['func'] ?? '',
        'matricule' => $row['matricule'] ?? '',
        'profile' => $row['profile'] ?? 'Technicien',
        'status' => $row['status'] ?? 'Actif',
        'pilot' => false,
        'pilotEmail' => $row['pilot_email'] ?? ''
    ];
}

function get_pilot(mysqli $conn, string $email): ?array {
    $stmt = $conn->prepare('SELECT * FROM pilots WHERE email = ?');
    $email = norm_email($email);
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function get_users_for_pilot(mysqli $conn, string $pilotEmail): array {
    $stmt = $conn->prepare('SELECT * FROM users WHERE pilot_email = ? ORDER BY name ASC');
    $pilotEmail = norm_email($pilotEmail);
    $stmt->bind_param('s', $pilotEmail);
    $stmt->execute();
    $items = [];
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) $items[] = user_public($row);
    $stmt->close();
    return $items;
}

function upsert_pilot(mysqli $conn, array $data): array {
    $email = norm_email($data['email'] ?? '');
    if ($email === '') respond(['ok' => false, 'message' => 'Adresse e-mail pilote obligatoire'], 400);
    $password = (string) ($data['password'] ?? '');
    $existing = get_pilot($conn, $email);
    $hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : ($existing['password'] ?? '');
    if ($hash === '') respond(['ok' => false, 'message' => 'Mot de passe pilote obligatoire'], 400);
    $name = trim((string) ($data['name'] ?? '')) ?: trim(((string) ($data['firstName'] ?? '')) . ' ' . ((string) ($data['lastName'] ?? ''))) ?: 'Pilote QUALI';
    $first = trim((string) ($data['firstName'] ?? 'Pilote')) ?: 'Pilote';
    $last = trim((string) ($data['lastName'] ?? 'QUALI')) ?: 'QUALI';
    $role = trim((string) ($data['role'] ?? 'Administrateur')) ?: 'Administrateur';
    $dept = trim((string) ($data['dept'] ?? 'Pilotage application')) ?: 'Pilotage application';
    $func = trim((string) ($data['func'] ?? "Pilote de l'application")) ?: "Pilote de l'application";
    $matricule = trim((string) ($data['matricule'] ?? 'PILOT-001'));
    $org = trim((string) ($data['orgName'] ?? 'QUALI by ENNAJEH')) ?: 'QUALI by ENNAJEH';
    $status = trim((string) ($data['status'] ?? 'Actif')) ?: 'Actif';
    $stmt = $conn->prepare("
        INSERT INTO pilots (email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE password = VALUES(password), name = VALUES(name), first_name = VALUES(first_name),
        last_name = VALUES(last_name), role = VALUES(role), dept = VALUES(dept), func = VALUES(func),
        matricule = VALUES(matricule), org_name = VALUES(org_name), status = VALUES(status)
    ");
    $stmt->bind_param('sssssssssss', $email, $hash, $name, $first, $last, $role, $dept, $func, $matricule, $org, $status);
    $stmt->execute();
    $stmt->close();
    return get_pilot($conn, $email);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$parts = path_parts();

try {
    if ($parts === ['health']) {
        respond([
            'ok' => true,
            'mode' => 'xampp-php-mysql',
            'database' => 'mysql',
            'dbName' => $dbname ?? 'quali',
            'dbHost' => $servername ?? '127.0.0.1',
            'dbPort' => $quali_db_port ?? null
        ]);
    }

    if ($method === 'POST' && $parts === ['auth', 'login']) {
        $data = body_json();
        $email = norm_email($data['email'] ?? '');
        $password = (string) ($data['password'] ?? '');
        $pilot = get_pilot($conn, $email);
        if ($pilot && password_verify($password, $pilot['password']) && ($pilot['status'] ?? 'Actif') === 'Actif') {
            respond(['ok' => true, 'type' => 'pilot', 'pilot' => ['email' => $pilot['email'], 'name' => $pilot['name']], 'user' => pilot_public($pilot)]);
        }
        $stmt = $conn->prepare('SELECT * FROM users WHERE email = ? AND status = "Actif"');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($user && password_verify($password, $user['password'])) {
            $pilot = get_pilot($conn, $user['pilot_email']);
            respond(['ok' => true, 'type' => 'user', 'pilot' => ['email' => $pilot['email'] ?? $user['pilot_email'], 'name' => $pilot['name'] ?? 'Pilote'], 'user' => user_public($user)]);
        }
        respond(['ok' => false, 'message' => 'Acces refuse : e-mail ou mot de passe incorrect.'], 401);
    }

    if ($method === 'POST' && $parts === ['pilots', 'register']) {
        respond(['ok' => true, 'pilot' => pilot_public(upsert_pilot($conn, body_json()))]);
    }

    if (($parts[0] ?? '') === 'pilots' && isset($parts[1])) {
        $pilotEmail = norm_email(urldecode($parts[1]));
        $pilot = get_pilot($conn, $pilotEmail);
        if (!$pilot && $method !== 'PUT') respond(['ok' => false, 'message' => 'Compte pilote introuvable'], 404);

        if ($method === 'GET' && count($parts) === 2) respond(['ok' => true, 'pilot' => pilot_public($pilot)]);
        if ($method === 'PUT' && count($parts) === 2) respond(['ok' => true, 'pilot' => pilot_public(upsert_pilot($conn, ['email' => $pilotEmail] + body_json()))]);
        if ($method === 'DELETE' && count($parts) === 2) respond(['ok' => false, 'message' => 'Suppression pilote desactivee en mode XAMPP'], 403);

        if (($parts[2] ?? '') === 'users') {
            if ($method === 'GET') respond(['ok' => true, 'items' => get_users_for_pilot($conn, $pilotEmail)]);
            if ($method === 'POST') {
                $data = body_json();
                $email = norm_email($data['email'] ?? '');
                $plain = (string) ($data['password'] ?? '');
                if ($email === '' || $plain === '') respond(['ok' => false, 'message' => 'E-mail et mot de passe obligatoires'], 400);
                $hash = password_hash($plain, PASSWORD_DEFAULT);
                $first = trim((string) ($data['firstName'] ?? ''));
                $last = trim((string) ($data['lastName'] ?? ''));
                $name = trim((string) ($data['name'] ?? '')) ?: trim("$first $last") ?: $email;
                $role = trim((string) ($data['role'] ?? 'Utilisateur'));
                $dept = trim((string) ($data['dept'] ?? ''));
                $func = trim((string) ($data['func'] ?? ''));
                $mat = trim((string) ($data['matricule'] ?? ''));
                $profile = trim((string) ($data['profile'] ?? 'Technicien'));
                $status = trim((string) ($data['status'] ?? 'Actif')) ?: 'Actif';
                $stmt = $conn->prepare("
                    INSERT INTO users (pilot_email, email, password, name, first_name, last_name, role, dept, func, matricule, profile, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE password = VALUES(password), name = VALUES(name), first_name = VALUES(first_name),
                    last_name = VALUES(last_name), role = VALUES(role), dept = VALUES(dept), func = VALUES(func),
                    matricule = VALUES(matricule), profile = VALUES(profile), status = VALUES(status), pilot_email = VALUES(pilot_email)
                ");
                $stmt->bind_param('ssssssssssss', $pilotEmail, $email, $hash, $name, $first, $last, $role, $dept, $func, $mat, $profile, $status);
                $stmt->execute();
                $stmt->close();
                $stmt = $conn->prepare('SELECT * FROM users WHERE email = ?');
                $stmt->bind_param('s', $email);
                $stmt->execute();
                $row = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                respond(['ok' => true, 'item' => user_public($row)]);
            }
        }

        if (($parts[2] ?? '') === 'state') {
            $stateColumns = [];
            $res = $conn->query('SHOW COLUMNS FROM pilot_app_state');
            while ($col = $res->fetch_assoc()) $stateColumns[strtolower($col['Field'])] = true;
            $hasPilotId = isset($stateColumns['pilot_id']);
            $hasPilotEmail = isset($stateColumns['pilot_email']);
            if ($method === 'GET') {
                if ($hasPilotEmail) {
                    $stmt = $conn->prepare('SELECT state_json FROM pilot_app_state WHERE pilot_email = ?');
                    $stmt->bind_param('s', $pilotEmail);
                } else {
                    $pilotId = (int) $pilot['id'];
                    $stmt = $conn->prepare('SELECT state_json FROM pilot_app_state WHERE pilot_id = ?');
                    $stmt->bind_param('i', $pilotId);
                }
                $stmt->execute();
                $row = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                $state = $row ? json_decode($row['state_json'], true) : null;
                respond(['ok' => true, 'state' => is_array($state) ? $state : null]);
            }
            if ($method === 'PUT' || $method === 'POST') {
                $data = body_json();
                $state = $data['state'] ?? null;
                if (!is_array($state)) respond(['ok' => false, 'message' => 'Etat application invalide'], 400);
                $json = json_encode($state);
                if ($hasPilotId) {
                    $pilotId = (int) $pilot['id'];
                    if ($hasPilotEmail) {
                        $stmt = $conn->prepare("
                            INSERT INTO pilot_app_state (pilot_id, pilot_email, state_json) VALUES (?, ?, ?)
                            ON DUPLICATE KEY UPDATE pilot_email = VALUES(pilot_email), state_json = VALUES(state_json)
                        ");
                        $stmt->bind_param('iss', $pilotId, $pilotEmail, $json);
                    } else {
                        $stmt = $conn->prepare("
                            INSERT INTO pilot_app_state (pilot_id, state_json) VALUES (?, ?)
                            ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)
                        ");
                        $stmt->bind_param('is', $pilotId, $json);
                    }
                } else {
                    $stmt = $conn->prepare("
                        INSERT INTO pilot_app_state (pilot_email, state_json) VALUES (?, ?)
                        ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)
                    ");
                    $stmt->bind_param('ss', $pilotEmail, $json);
                }
                $stmt->execute();
                $stmt->close();
                respond(['ok' => true, 'updatedAt' => date('c')]);
            }
        }

        if (($parts[2] ?? '') === 'documentation') {
            $empty = ['ok' => true, 'mode' => 'xampp', 'items' => [], 'settings' => null, 'summary' => ['created' => 0], 'message' => 'Documentation centralisee serveur indisponible en mode XAMPP pur'];
            respond($empty);
        }
    }

    if ($parts === ['documentation', 'server']) {
        respond(['ok' => true, 'mode' => 'xampp', 'server' => ['root' => 'XAMPP/PHP'], 'message' => 'Mode XAMPP pur']);
    }

    respond(['ok' => false, 'message' => 'Endpoint API XAMPP introuvable'], 404);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Erreur API XAMPP'], 500);
}
?>
