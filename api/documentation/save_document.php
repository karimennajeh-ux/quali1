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

$stmt = $pdo->prepare("
    INSERT INTO documents (
      reference_documentaire, titre_document, nom_fichier, extension, type_document, processus, version, statut,
      responsable_redacteur, verificateur, approbateur, diffuseur, chemin_fichier, chemin_relatif,
      taille_fichier, date_modification, stockage, observation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Local', ?)
    ON DUPLICATE KEY UPDATE
      titre_document = VALUES(titre_document),
      type_document = VALUES(type_document),
      processus = VALUES(processus),
      version = VALUES(version),
      statut = VALUES(statut),
      responsable_redacteur = VALUES(responsable_redacteur),
      verificateur = VALUES(verificateur),
      approbateur = VALUES(approbateur),
      diffuseur = VALUES(diffuseur),
      observation = VALUES(observation),
      updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([
    $ref,
    $title,
    $fileName,
    $extension,
    $type,
    $processus,
    $data['version'] ?? $data['versionLabel'] ?? '1.0',
    $data['statut'] ?? $data['status'] ?? 'Brouillon',
    $data['responsable_redacteur'] ?? $data['ownerName'] ?? '',
    $data['verificateur'] ?? $data['verifierName'] ?? '',
    $data['approbateur'] ?? $data['approverName'] ?? '',
    $data['diffuseur'] ?? $data['diffuserName'] ?? '',
    $path,
    $relative,
    filesize($path),
    date('Y-m-d H:i:s', filemtime($path)),
    $data['observation'] ?? $data['notes'] ?? '',
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
