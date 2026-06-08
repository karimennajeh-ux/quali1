<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$data = doc_input();
$id = (int) ($data['id'] ?? 0);
if ($id <= 0) doc_error('Identifiant document manquant.', 422);
if (empty($data['confirmApplicationDelete'])) {
    doc_error("Confirmation requise pour supprimer la fiche de l'application.", 422);
}

$doc = doc_fetch($pdo, $id);
$actor = trim((string) ($data['actorName'] ?? $data['acteur'] ?? 'Système')) ?: 'Système';
doc_delete_application($pdo, $doc, $actor);
doc_json(['message' => "Fiche documentaire supprimée. Le fichier Windows n'a pas été supprimé."]);
?>
