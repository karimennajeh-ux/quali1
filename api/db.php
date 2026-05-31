<?php
declare(strict_types=1);

function quali_api_json_error(string $message, int $status = 500): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'ok' => false, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function quali_api_pdo(): PDO
{
    $host = getenv('QUALI_DB_HOST') ?: 'localhost';
    $port = (int) (getenv('QUALI_DB_PORT') ?: 3307);
    $db = getenv('QUALI_DB_NAME') ?: 'quali_db';
    $user = getenv('QUALI_DB_USER') ?: 'root';
    $password = getenv('QUALI_DB_PASSWORD') ?: '';
    $charset = 'utf8mb4';

    try {
        $serverPdo = new PDO("mysql:host={$host};port={$port};charset={$charset}", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $safeDb = str_replace('`', '``', $db);
        $serverPdo->exec("CREATE DATABASE IF NOT EXISTS `{$safeDb}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo = new PDO("mysql:host={$host};port={$port};dbname={$db};charset={$charset}", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        quali_api_json_error('Connexion MySQL impossible sur localhost:3307. Verifiez XAMPP/MySQL.', 503);
    }
}
?>
