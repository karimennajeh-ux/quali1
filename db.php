<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function quali_risk_json_error(string $message, int $status = 500): void
{
    http_response_code($status);
    echo json_encode(['success' => false, 'ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function quali_risk_pdo(): PDO
{
    $host = getenv('QUALI_RISK_DB_HOST') ?: 'localhost';
    $port = (int) (getenv('QUALI_RISK_DB_PORT') ?: 3307);
    $db = getenv('QUALI_RISK_DB_NAME') ?: 'quali_db';
    $user = getenv('QUALI_RISK_DB_USER') ?: 'root';
    $password = getenv('QUALI_RISK_DB_PASSWORD') ?: '';
    $charset = 'utf8mb4';

    try {
        $serverDsn = "mysql:host={$host};port={$port};charset={$charset}";
        $pdo = new PDO($serverDsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $safeDb = str_replace('`', '``', $db);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$safeDb}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$safeDb}`");
        quali_risk_bootstrap($pdo);
        return $pdo;
    } catch (PDOException $e) {
        quali_risk_json_error('Connexion MySQL impossible sur localhost:3307. Verifiez que MySQL XAMPP est actif.', 503);
    }
}

function quali_risk_bootstrap(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS risques (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chapitre VARCHAR(255) NOT NULL,
          risque TEXT NOT NULL,
          probabilite_initiale TINYINT UNSIGNED DEFAULT 0,
          gravite_initiale TINYINT UNSIGNED DEFAULT 0,
          criticite_initiale INT UNSIGNED DEFAULT 0,
          actions TEXT,
          délai VARCHAR(255),
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function quali_risk_input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) $data = $_POST;
    return is_array($data) ? $data : [];
}

function quali_risk_int(array $data, string $key): int
{
    return max(0, (int) ($data[$key] ?? 0));
}

function quali_risk_payload(array $data): array
{
    $p = quali_risk_int($data, 'probabilite_initiale');
    $g = quali_risk_int($data, 'gravite_initiale');
    $rp = quali_risk_int($data, 'probabilite_residuelle');
    $rg = quali_risk_int($data, 'gravite_residuelle');

    return [
        'chapitre' => trim((string) ($data['chapitre'] ?? '')),
        'risque' => trim((string) ($data['risque'] ?? '')),
        'probabilite_initiale' => $p,
        'gravite_initiale' => $g,
        'criticite_initiale' => $p * $g,
        'actions' => trim((string) ($data['actions'] ?? '')),
        'délai' => trim((string) ($data['délai'] ?? '')),
        'responsable' => trim((string) ($data['responsable'] ?? '')),
        'suivi' => trim((string) ($data['suivi'] ?? '')),
        'probabilite_residuelle' => $rp,
        'gravite_residuelle' => $rg,
        'criticite_residuelle' => $rp * $rg,
        'critere_evaluation' => trim((string) ($data['critere_evaluation'] ?? '')),
        'efficacite' => trim((string) ($data['efficacite'] ?? '')),
        'statut' => trim((string) ($data['statut'] ?? '')),
    ];
}

function quali_risk_validate(array $payload): void
{
    if ($payload['chapitre'] === '' || $payload['risque'] === '') {
        quali_risk_json_error('Le chapitre et le risque sont obligatoires.', 422);
    }
}

function quali_risk_response(array $extra = []): void
{
    echo json_encode(['success' => true, 'ok' => true] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}
?>
