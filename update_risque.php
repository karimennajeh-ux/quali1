<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$data = quali_risk_input();
$id = (int) ($data['id'] ?? 0);
if ($id <= 0) quali_risk_json_error('Identifiant du risque manquant.', 422);

$pdo = quali_risk_pdo();
$payload = quali_risk_payload($data);
quali_risk_validate($payload);
$payload['id'] = $id;

$sql = "
    UPDATE risques SET
      chapitre = :chapitre,
      risque = :risque,
      probabilite_initiale = :probabilite_initiale,
      gravite_initiale = :gravite_initiale,
      criticite_initiale = :criticite_initiale,
      actions = :actions,
      delai = :delai,
      responsable = :responsable,
      suivi = :suivi,
      probabilite_residuelle = :probabilite_residuelle,
      gravite_residuelle = :gravite_residuelle,
      criticite_residuelle = :criticite_residuelle,
      critere_evaluation = :critere_evaluation,
      efficacite = :efficacite,
      statut = :statut
    WHERE id = :id
";

$stmt = $pdo->prepare($sql);
$stmt->execute($payload);

$stmt = $pdo->prepare("SELECT * FROM risques WHERE id = ?");
$stmt->execute([$id]);
$risk = $stmt->fetch();
if (!$risk) quali_risk_json_error('Risque introuvable.', 404);

quali_risk_response([
    'message' => 'Risque mis à jour avec succès.',
    'risque' => $risk,
]);
?>
