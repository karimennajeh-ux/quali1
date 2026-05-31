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
$fileName = basename(trim((string) ($input['fileName'] ?? 'document')));
$dataUrl = (string) ($input['dataUrl'] ?? '');
if ($title === '' || $ref === '' || $fileName === '' || $dataUrl === '') {
    doc_error('Titre, reference et fichier obligatoires.', 422);
}

$extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if ($extension === '') doc_error('Extension de fichier manquante.', 422);

[$targetDir, $processFolder, $typeFolder, $statusFolder, $cycle] = doc_target_directory($process, $type, $status, true);
$targetName = import_slug($ref, 'REF') . '_' . import_slug($title, 'Titre') . '_V' . import_slug(preg_replace('/^v/i', '', $version), '1.0') . '.' . $extension;
$targetPath = doc_unique_path($targetDir, $targetName);
$bytes = import_data_url_bytes($dataUrl);
if (file_put_contents($targetPath, $bytes) === false) doc_error('Copie du fichier dans le dossier Processus impossible.', 500);

$fileReal = realpath($targetPath);
$rootReal = realpath(doc_root());
if (!$fileReal || !$rootReal || !doc_path_is_inside_root($fileReal, $rootReal)) {
    doc_error('Fichier refuse hors du dossier documentaire autorise.', 403);
}
$relative = doc_relative_path($fileReal);

$stmt = $pdo->prepare("
    INSERT INTO documents (
      reference_documentaire, titre_document, nom_fichier, extension, type_document, processus, version, statut,
      responsable_redacteur, verificateur, approbateur, diffuseur, chemin_fichier, chemin_relatif,
      taille_fichier, date_modification, stockage, observation, cycle_documentaire, dossier_processus,
      dossier_type, dossier_statut, date_creation_doc, est_version_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Local', ?, ?, ?, ?, ?, NOW(), 1)
    ON DUPLICATE KEY UPDATE
      titre_document = VALUES(titre_document),
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
    filesize($fileReal),
    date('Y-m-d H:i:s', filemtime($fileReal)),
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
