<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$data = doc_input();
$path = trim((string) ($data['chemin_fichier'] ?? $data['absPath'] ?? ''));
if ($path === '' || !is_file($path)) doc_error('Chemin fichier invalide ou introuvable.', 422);

$fileName = basename($path);
$relative = doc_relative_path($path);
$extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
$ref = trim((string) ($data['reference_documentaire'] ?? $data['ref'] ?? doc_ref_from_file($relative)));
$title = trim((string) ($data['titre_document'] ?? $data['title'] ?? pathinfo($fileName, PATHINFO_FILENAME)));
$processus = trim((string) ($data['processus'] ?? $data['processName'] ?? doc_process_from_relative($relative)));
$type = trim((string) ($data['type_document'] ?? $data['docType'] ?? doc_type_from_name($fileName, $extension)));

$documentNumber = trim((string) ($data['document_number'] ?? $data['reference_documentaire'] ?? $data['ref'] ?? $ref));
$filePath = doc_relative_path($path);
$uploadDate = date('Y-m-d H:i:s');
$uploadedBy = trim((string) ($data['responsable_redacteur'] ?? $data['ownerName'] ?? ''));
$status = trim((string) ($data['statut'] ?? $data['status'] ?? 'Brouillon')) ?: 'Brouillon';
[$movedPath, $movedRelative, $processFolder, $typeFolder, $statusFolder, $cycle] = doc_relocate_document_file($pdo, [
    'id' => 0,
    'chemin_fichier' => $path,
    'processus' => $processus,
    'type_document' => $type,
    'statut' => $status,
], $processus, $type, $status);
if ($movedPath && $movedRelative) {
    $path = $movedPath;
    $fileName = basename($path);
    $relative = $movedRelative;
    $filePath = $movedRelative;
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
}

$stmt = $pdo->prepare("
    INSERT INTO documents (
      reference_documentaire, document_number, titre_document, nom_fichier, extension, type_document, processus, version, statut,
      responsable_redacteur, verificateur, approbateur, diffuseur, chemin_fichier, chemin_relatif, file_path,
      file_storage_type, sharepoint_url, upload_date, uploaded_by, taille_fichier, date_modification, stockage, observation,
      cycle_documentaire, dossier_processus, dossier_type, dossier_statut
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Local', ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      titre_document = VALUES(titre_document),
      document_number = VALUES(document_number),
      type_document = VALUES(type_document),
      processus = VALUES(processus),
      version = VALUES(version),
      statut = VALUES(statut),
      responsable_redacteur = VALUES(responsable_redacteur),
      verificateur = VALUES(verificateur),
      approbateur = VALUES(approbateur),
      diffuseur = VALUES(diffuseur),
      chemin_fichier = VALUES(chemin_fichier),
      chemin_relatif = VALUES(chemin_relatif),
      file_path = VALUES(file_path),
      file_storage_type = VALUES(file_storage_type),
      sharepoint_url = VALUES(sharepoint_url),
      upload_date = VALUES(upload_date),
      uploaded_by = VALUES(uploaded_by),
      observation = VALUES(observation),
      cycle_documentaire = VALUES(cycle_documentaire),
      dossier_processus = VALUES(dossier_processus),
      dossier_type = VALUES(dossier_type),
      dossier_statut = VALUES(dossier_statut),
      updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([
    $ref,
    $documentNumber,
    $title,
    $fileName,
    $extension,
    $type,
    $processus,
    $data['version'] ?? $data['versionLabel'] ?? '1.0',
    $status,
    $data['responsable_redacteur'] ?? $data['ownerName'] ?? '',
    $data['verificateur'] ?? $data['verifierName'] ?? '',
    $data['approbateur'] ?? $data['approverName'] ?? '',
    $data['diffuseur'] ?? $data['diffuserName'] ?? '',
    $path,
    $relative,
    $filePath,
    'local_server',
    '',
    $uploadDate,
    $uploadedBy,
    filesize($path),
    date('Y-m-d H:i:s', filemtime($path)),
    $data['observation'] ?? $data['notes'] ?? '',
    $cycle,
    $processFolder,
    $typeFolder,
    $statusFolder,
]);
$id = (int) $pdo->lastInsertId();
if ($id <= 0) {
    $lookup = $pdo->prepare("SELECT id FROM documents WHERE reference_documentaire = ?");
    $lookup->execute([$ref]);
    $id = (int) $lookup->fetchColumn();
}
doc_log($pdo, $id, 'modification', 'Enregistrement manuel de la fiche documentaire');
$stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
$stmt->execute([$id]);
doc_json(['item' => doc_item($stmt->fetch())]);
?>
