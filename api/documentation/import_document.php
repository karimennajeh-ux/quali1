<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

function import_data_url_bytes(string $dataUrl): string
{
    if (preg_match('/^data:[^;]+;base64,(.*)$/', $dataUrl, $m)) {
        $bytes = base64_decode($m[1], true);
        if ($bytes === false) doc_error('Fichier importe illisible.', 422);
        return $bytes;
    }
    $bytes = base64_decode($dataUrl, true);
    if ($bytes === false) doc_error('Fichier importe illisible.', 422);
    return $bytes;
}

function import_slug(string $value, string $fallback = 'document'): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    $clean = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/', '', $ascii);
    $clean = preg_replace('/\s+/', '_', (string) $clean);
    $clean = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) $clean);
    $clean = trim((string) $clean, '._-');
    return $clean !== '' ? $clean : $fallback;
}

$pdo = doc_pdo();
$input = doc_input();
$actor = trim((string) ($input['actorName'] ?? 'Utilisateur')) ?: 'Utilisateur';
$title = trim((string) ($input['titre_document'] ?? $input['title'] ?? ''));
$ref = trim((string) ($input['reference_documentaire'] ?? $input['docRef'] ?? $input['ref'] ?? ''));
$process = trim((string) ($input['processus'] ?? $input['processName'] ?? 'Processus support'));
$type = trim((string) ($input['type_document'] ?? $input['docType'] ?? 'Procedure'));
$version = trim((string) ($input['version'] ?? $input['versionLabel'] ?? '1.0')) ?: '1.0';
$status = trim((string) ($input['statut'] ?? $input['status'] ?? 'Brouillon')) ?: 'Brouillon';
$fileName = basename(trim((string) ($input['fileName'] ?? ($input['document']['name'] ?? 'document'))));
$mimeType = trim((string) ($input['mimeType'] ?? $input['mime_type'] ?? ''));
$dataUrl = (string) ($input['dataUrl'] ?? '');
$sharepointUrl = trim((string) ($input['sharepoint_url'] ?? $input['sharepointUrl'] ?? ''));
$storageType = 'local_server';
$uploadDate = date('Y-m-d H:i:s');
$uploadedBy = trim((string) ($input['uploaded_by'] ?? $input['uploadedBy'] ?? $actor));
if ($title === '' || $ref === '' || $fileName === '' || ($dataUrl === '' && empty($_FILES['document']['tmp_name']))) {
    doc_error('Titre, reference et fichier obligatoires.', 422);
}

$extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if ($extension === '') doc_error('Extension de fichier manquante.', 422);

$targetDir = doc_upload_document_folder($ref, $type);
$targetName = doc_upload_file_name($ref, $version, $extension);
$targetPath = doc_unique_path($targetDir, $targetName);

if (!empty($_FILES['document']['tmp_name']) && is_uploaded_file($_FILES['document']['tmp_name'])) {
    if (!move_uploaded_file($_FILES['document']['tmp_name'], $targetPath)) {
        doc_error('Deplacement du fichier uploadé impossible.', 500);
    }
    $mimeType = $mimeType !== '' ? $mimeType : ($_FILES['document']['type'] ?? '');
} else {
    $bytes = import_data_url_bytes($dataUrl);
    if (file_put_contents($targetPath, $bytes) === false) {
        doc_error('Copie du fichier dans le dossier de stockage impossible.', 500);
    }
}

$fileReal = realpath($targetPath);
if (!$fileReal) {
    doc_error('Impossible de resoudre le chemin de destination.', 500);
}
$relative = doc_upload_file_path($fileReal);

$stmt = $pdo->prepare("
    INSERT INTO documents (
      reference_documentaire, document_number, titre_document, nom_fichier, extension, type_document,
      processus, version, statut, responsable_redacteur, verificateur, approbateur, diffuseur,
      chemin_fichier, chemin_relatif, file_path, file_storage_type, sharepoint_url, upload_date,
      uploaded_by, taille_fichier, date_modification, stockage, observation, cycle_documentaire,
      dossier_processus, dossier_type, dossier_statut, date_creation_doc, est_version_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
    ON DUPLICATE KEY UPDATE
      titre_document = VALUES(titre_document),
      document_number = VALUES(document_number),
      nom_fichier = VALUES(nom_fichier),
      extension = VALUES(extension),
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
      taille_fichier = VALUES(taille_fichier),
      date_modification = VALUES(date_modification),
      stockage = VALUES(stockage),
      observation = VALUES(observation),
      cycle_documentaire = VALUES(cycle_documentaire),
      dossier_processus = VALUES(dossier_processus),
      dossier_type = VALUES(dossier_type),
      dossier_statut = VALUES(dossier_statut),
      est_version_active = 1,
      updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([
    $ref,
    $ref,
    $title,
    basename($fileReal),
    $extension,
    $type,
    $process,
    $version,
    $status,
    trim((string) ($input['responsable_redacteur'] ?? $input['ownerName'] ?? '')),
    trim((string) ($input['verificateur'] ?? $input['verifierName'] ?? '')),
    trim((string) ($input['approbateur'] ?? $input['approverName'] ?? '')),
    trim((string) ($input['diffuseur'] ?? $input['diffuserName'] ?? '')),
    $fileReal,
    $relative,
    $relative,
    $storageType,
    $sharepointUrl,
    $uploadDate,
    $uploadedBy,
    filesize($fileReal),
    date('Y-m-d H:i:s', filemtime($fileReal)),
    'Local',
    trim((string) ($input['observation'] ?? $input['notes'] ?? '')),
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
doc_log_activity($pdo, $id, 'Importation', [
    'detail' => 'Document importe et copie dans le dossier Processus',
    'nouveau_statut' => $status,
    'nouvelle_version' => $version,
    'observation' => $input['observation'] ?? $input['notes'] ?? null,
], $actor);
$stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
$stmt->execute([$id]);
doc_json(['item' => doc_item($stmt->fetch()), 'relativePath' => $relative]);
?>
