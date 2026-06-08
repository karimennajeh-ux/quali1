<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$data = doc_input();
$id = (int) ($data['id'] ?? 0);
if ($id <= 0) doc_error('Identifiant document manquant.', 422);

$old = doc_fetch($pdo, $id);
$actor = trim((string) ($data['actorName'] ?? $data['acteur'] ?? $data['utilisateur'] ?? 'Utilisateur'));

$fields = [
    'reference_documentaire' => $data['reference_documentaire'] ?? $data['ref'] ?? null,
    'titre_document' => $data['titre_document'] ?? $data['title'] ?? null,
    'type_document' => $data['type_document'] ?? $data['docType'] ?? null,
    'processus' => $data['processus'] ?? $data['processName'] ?? null,
    'version' => $data['version'] ?? $data['versionLabel'] ?? null,
    'statut' => $data['statut'] ?? $data['status'] ?? null,
    'responsable_redacteur' => $data['responsable_redacteur'] ?? $data['ownerName'] ?? null,
    'verificateur' => $data['verificateur'] ?? $data['verifierName'] ?? null,
    'poste_verificateur' => $data['poste_verificateur'] ?? $data['verifierRole'] ?? null,
    'approbateur' => $data['approbateur'] ?? $data['approverName'] ?? null,
    'poste_approbateur' => $data['poste_approbateur'] ?? $data['approverRole'] ?? null,
    'diffuseur' => $data['diffuseur'] ?? $data['diffuserName'] ?? null,
    'observation' => $data['observation'] ?? $data['notes'] ?? null,
    'motif_revision' => $data['motif_revision'] ?? null,
];

$sets = [];
$params = [':id' => $id];
foreach ($fields as $col => $value) {
    if ($value === null) continue;
    $sets[] = "{$col} = :{$col}";
    $params[":{$col}"] = trim((string) $value);
}
if (!$sets) doc_error('Aucune donnée à modifier.', 422);

$nextProcess = trim((string) ($fields['processus'] ?? $old['processus'] ?? ''));
$nextType = trim((string) ($fields['type_document'] ?? $old['type_document'] ?? ''));
$nextStatusForCycle = trim((string) ($fields['statut'] ?? $old['statut'] ?? 'Brouillon'));
[$movedPath, $movedRelative, $processFolder, $typeFolder, $statusFolder, $cycle] = doc_relocate_document_file($pdo, $old, $nextProcess, $nextType, $nextStatusForCycle);
$sets[] = 'cycle_documentaire = :cycle_documentaire';
$sets[] = 'dossier_processus = :dossier_processus';
$sets[] = 'dossier_type = :dossier_type';
$sets[] = 'dossier_statut = :dossier_statut';
if ($movedPath && $movedRelative) {
    $sets[] = 'chemin_fichier = :chemin_fichier';
    $sets[] = 'chemin_relatif = :chemin_relatif';
    $sets[] = 'file_path = :file_path';
    $sets[] = 'nom_fichier = :nom_fichier';
    $params[':chemin_fichier'] = $movedPath;
    $params[':chemin_relatif'] = $movedRelative;
    $params[':file_path'] = $movedRelative;
    $params[':nom_fichier'] = basename($movedPath);
}
$sets[] = "date_verification = CASE WHEN :date_status_verification IN ('En vérification','En verification') AND date_verification IS NULL THEN NOW() ELSE date_verification END";
$sets[] = "date_approbation = CASE WHEN :date_status_approval IN ('Approuvé','Approuve','En vigueur') AND date_approbation IS NULL THEN NOW() ELSE date_approbation END";
$sets[] = "date_diffusion = CASE WHEN :date_status_diffusion IN ('Diffusé','Diffuse','En vigueur') AND date_diffusion IS NULL THEN NOW() ELSE date_diffusion END";
$sets[] = "date_archivage = CASE WHEN :date_status_archive IN ('Archivé','Archive','Obsolète','Obsolete','Remplacé','Remplace') AND date_archivage IS NULL THEN NOW() ELSE date_archivage END";
$sets[] = 'updated_at = CURRENT_TIMESTAMP';
$params[':cycle_documentaire'] = $cycle;
$params[':dossier_processus'] = $processFolder;
$params[':dossier_type'] = $typeFolder;
$params[':dossier_statut'] = $statusFolder;
$params[':date_status_verification'] = $nextStatusForCycle;
$params[':date_status_approval'] = $nextStatusForCycle;
$params[':date_status_diffusion'] = $nextStatusForCycle;
$params[':date_status_archive'] = $nextStatusForCycle;

$stmt = $pdo->prepare("UPDATE documents SET " . implode(', ', $sets) . " WHERE id = :id");
$stmt->execute($params);

$newStatus = array_key_exists('statut', $fields) && $fields['statut'] !== null ? trim((string) $fields['statut']) : null;
$oldStatus = trim((string) ($old['statut'] ?? ''));
$oldVersion = trim((string) ($old['version'] ?? ''));
$newVersion = array_key_exists('version', $fields) && $fields['version'] !== null ? trim((string) $fields['version']) : $oldVersion;
if ($newStatus !== null && $newStatus !== $oldStatus) {
    doc_log_activity($pdo, $id, 'Changement de statut', [
        'detail' => 'Ancien statut : ' . ($oldStatus !== '' ? $oldStatus : '-') . ' | Nouveau statut : ' . ($newStatus !== '' ? $newStatus : '-'),
        'ancien_statut' => $oldStatus,
        'nouveau_statut' => $newStatus,
        'ancienne_version' => $oldVersion,
        'nouvelle_version' => $newVersion,
        'observation' => $data['observation'] ?? $data['notes'] ?? null,
    ], $actor);
} else {
    doc_log_activity($pdo, $id, 'Modification', [
        'detail' => 'Modification de la fiche documentaire',
        'ancien_statut' => $oldStatus,
        'nouveau_statut' => $newStatus ?? $oldStatus,
        'ancienne_version' => $oldVersion,
        'nouvelle_version' => $newVersion,
        'observation' => $data['observation'] ?? $data['notes'] ?? null,
    ], $actor);
}

$stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
$stmt->execute([$id]);
doc_json(['item' => doc_item($stmt->fetch())]);
?>
