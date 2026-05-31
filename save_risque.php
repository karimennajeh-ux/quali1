<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$pdo = quali_risk_pdo();
$payload = quali_risk_payload(quali_risk_input());
quali_risk_validate($payload);

$sql = "
    INSERT INTO risques (
      chapitre, risque, probabilite_initiale, gravite_initiale, criticite_initiale,
      actions, delai, responsable, suivi, probabilite_residuelle, gravite_residuelle,
      criticite_residuelle, critere_evaluation, efficacite, statut
    ) VALUES (
      :chapitre, :risque, :probabilite_initiale, :gravite_initiale, :criticite_initiale,
      :actions, :delai, :responsable, :suivi, :probabilite_residuelle, :gravite_residuelle,
      :criticite_residuelle, :critere_evaluation, :efficacite, :statut
    )
";

$stmt = $pdo->prepare($sql);
$stmt->execute($payload);
$id = (int) $pdo->lastInsertId();

$stmt = $pdo->prepare("SELECT * FROM risques WHERE id = ?");
$stmt->execute([$id]);

quali_risk_response([
    'message' => 'Risque enregistré avec succès.',
    'risque' => $stmt->fetch(),
]);
?>
