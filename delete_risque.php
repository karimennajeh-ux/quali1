<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$data = quali_risk_input();
$id = (int) ($data['id'] ?? 0);
if ($id <= 0) quali_risk_json_error('Identifiant du risque manquant.', 422);

$pdo = quali_risk_pdo();
$stmt = $pdo->prepare("DELETE FROM risques WHERE id = ?");
$stmt->execute([$id]);

quali_risk_response([
    'message' => 'Risque supprimé avec succès.',
]);
?>
