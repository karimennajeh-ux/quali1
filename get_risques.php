<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$pdo = quali_risk_pdo();
$stmt = $pdo->query("SELECT * FROM risques ORDER BY updated_at DESC, id DESC");

quali_risk_response([
    'risques' => $stmt->fetchAll(),
]);
?>
