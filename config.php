<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$servername = getenv('QUALI_DB_HOST') ?: '127.0.0.1';
$username = getenv('QUALI_DB_USER') ?: 'root';
$password = getenv('QUALI_DB_PASSWORD') ?: '';
$dbname = getenv('QUALI_DB_NAME') ?: 'quali';
$port = (int) (getenv('QUALI_DB_PORT') ?: 3307);

function quali_json_error($message, $status = 500) {
    http_response_code($status);
    if (!headers_sent()) header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'success' => false, 'message' => $message]);
    exit;
}

function quali_bootstrap_schema(mysqli $conn, string $dbname): void {
    $safeDb = str_replace('`', '``', $dbname);
    $conn->query("CREATE DATABASE IF NOT EXISTS `$safeDb` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $conn->select_db($dbname);

    $conn->query("
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $conn->query("
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
          profile VARCHAR(255),
          status VARCHAR(255) DEFAULT 'Actif',
          pilot_email VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (pilot_email) REFERENCES pilots(email) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $columns = [];
    $res = $conn->query("SHOW COLUMNS FROM users");
    while ($row = $res->fetch_assoc()) $columns[strtolower($row['Field'])] = true;
    if (!isset($columns['profile'])) {
        $conn->query("ALTER TABLE users ADD COLUMN profile VARCHAR(255) NULL AFTER matricule");
    }

    $conn->query("
        CREATE TABLE IF NOT EXISTS pilot_app_state (
          pilot_email VARCHAR(255) PRIMARY KEY,
          state_json LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (pilot_email) REFERENCES pilots(email) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $stateColumns = [];
    $res = $conn->query("SHOW COLUMNS FROM pilot_app_state");
    while ($row = $res->fetch_assoc()) $stateColumns[strtolower($row['Field'])] = true;
    if (!isset($stateColumns['pilot_email'])) {
        $conn->query("ALTER TABLE pilot_app_state ADD COLUMN pilot_email VARCHAR(255) NULL");
        $conn->query("UPDATE pilot_app_state s LEFT JOIN pilots p ON p.id = s.pilot_id SET s.pilot_email = p.email WHERE s.pilot_email IS NULL");
    }

    $mainHash = '$2y$10$HpBeTsZpuEoxqwhuMl1D1eBMr5uOlMV/vpJmu3DSj6ZRCFjMYs40.';
    $stmt = $conn->prepare("
        INSERT INTO pilots (email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status)
        VALUES (?, ?, 'Pilote QUALI', 'Pilote', 'QUALI', 'Administrateur', 'Pilotage application', 'Pilote de l''application', 'PILOT-001', 'QUALI by ENNAJEH', 'Actif')
        ON DUPLICATE KEY UPDATE
          password = VALUES(password),
          name = VALUES(name),
          first_name = VALUES(first_name),
          last_name = VALUES(last_name),
          role = VALUES(role),
          dept = VALUES(dept),
          func = VALUES(func),
          matricule = VALUES(matricule),
          org_name = VALUES(org_name),
          status = VALUES(status)
    ");
    $email = 'karimennajeh@gmail.com';
    $stmt->bind_param('ss', $email, $mainHash);
    $stmt->execute();
    $stmt->close();
}

try {
    $conn = new mysqli($servername, $username, $password, '', $port);
    $conn->set_charset('utf8mb4');
    quali_bootstrap_schema($conn, $dbname);
} catch (mysqli_sql_exception $e) {
    quali_json_error('Database connection failed');
}
?>
