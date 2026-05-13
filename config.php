<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$servername = getenv('QUALI_DB_HOST') ?: '127.0.0.1';
$username = getenv('QUALI_DB_USER') ?: 'root';
$password = getenv('QUALI_DB_PASSWORD') ?: '';
$dbname = getenv('QUALI_DB_NAME') ?: 'quali';
$port = (int) (getenv('QUALI_DB_PORT') ?: 3307);

try {
    $conn = new mysqli($servername, $username, $password, $dbname, $port);
    $conn->set_charset('utf8mb4');
} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}
?>
