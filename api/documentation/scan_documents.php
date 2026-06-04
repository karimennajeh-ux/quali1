<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$data = doc_input();
$actor = trim((string) ($data['actorName'] ?? $data['acteur'] ?? 'Systeme')) ?: 'Systeme';
$root = doc_root();
if (!is_dir($root)) doc_error("Dossier documentaire introuvable : {$root}", 404);
doc_ensure_all_main_lifecycle_folders();
if (!$pdo->inTransaction()) {
    $pdo->beginTransaction();
}

$allowed = array_flip(QUALI_DOCUMENT_EXTENSIONS);
$scanned = 0;
$added = 0;
$updated = 0;
$restored = 0;
$missing = 0;
$missingFolders = 0;
$restoredFolders = 0;
$folders = [];
$seenPaths = [];
$seenFolders = [];

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);

$folderStmt = $pdo->prepare("
    INSERT INTO dossiers_documentaires (nom_dossier, chemin_dossier, chemin_relatif, role_dossier, statut, actif)
    SELECT ?, ?, ?, ?, 'Actif', 1
    WHERE NOT EXISTS (
      SELECT 1 FROM dossiers_documentaires WHERE chemin_dossier = ?
    )
");
$folderUpdateStmt = $pdo->prepare("
    UPDATE dossiers_documentaires
    SET nom_dossier = :name,
        chemin_relatif = :rel,
        role_dossier = :role,
        statut = 'Actif',
        actif = 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE chemin_dossier = :abs
");
$docSelectStmt = $pdo->prepare("SELECT * FROM documents WHERE chemin_fichier = :abs OR chemin_relatif = :rel LIMIT 1");
$docInsertStmt = $pdo->prepare("
    INSERT INTO documents (
      reference_documentaire, titre_document, nom_fichier, extension, type_document, processus, version, statut,
      responsable_redacteur, verificateur, approbateur, diffuseur, chemin_fichier, chemin_relatif,
      taille_fichier, date_modification, stockage, observation, cycle_documentaire, dossier_processus,
      dossier_type, dossier_statut
    ) VALUES (
      :ref, :title, :file, :ext, :type, :processus, '1.0', :statut,
      '', '', '', '', :abs, :rel, :size, :modified, 'Local', :obs, :cycle,
      :dossier_processus, :dossier_type, :dossier_statut
    )
    ON DUPLICATE KEY UPDATE
      titre_document = VALUES(titre_document),
      nom_fichier = VALUES(nom_fichier),
      extension = VALUES(extension),
      type_document = VALUES(type_document),
      processus = VALUES(processus),
      chemin_fichier = VALUES(chemin_fichier),
      chemin_relatif = VALUES(chemin_relatif),
      taille_fichier = VALUES(taille_fichier),
      date_modification = VALUES(date_modification),
      stockage = VALUES(stockage),
      cycle_documentaire = VALUES(cycle_documentaire),
      dossier_processus = VALUES(dossier_processus),
      dossier_type = VALUES(dossier_type),
      dossier_statut = VALUES(dossier_statut),
      updated_at = CURRENT_TIMESTAMP
");
$docUpdateStmt = $pdo->prepare("
    UPDATE documents
    SET reference_documentaire = :ref,
        titre_document = :title,
        nom_fichier = :file,
        extension = :ext,
        type_document = :type,
        processus = :processus,
        chemin_fichier = :abs,
        chemin_relatif = :rel,
        taille_fichier = :size,
        date_modification = :modified,
        stockage = 'Local',
        observation = :obs,
        cycle_documentaire = :cycle,
        dossier_processus = :dossier_processus,
        dossier_type = :dossier_type,
        dossier_statut = :dossier_statut,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");
$restoreFoundStmt = $pdo->prepare("
    UPDATE documents
    SET statut = :status,
        statut_precedent = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");
$markMissingStmt = $pdo->prepare("
    UPDATE documents
    SET statut = 'Fichier introuvable',
        statut_precedent = :previous_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");

foreach ($iterator as $item) {
    $path = $item->getPathname();
    $relative = doc_relative_path($path);
    if ($item->isDir()) {
        $folders[$path] = true;
        $seenFolders[strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path))] = true;
        continue;
    }
    $fileName = $item->getFilename();
    if (str_starts_with($fileName, '~$')) continue;
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    if (!isset($allowed[$extension])) continue;

    $scanned++;
    $seenPaths[strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path))] = true;
    $relativeParts = preg_split('/[\\\\\\/]+/', $relative) ?: [];
    $processFolder = $relativeParts[0] ?? doc_process_folder_name(doc_process_from_relative($relative));
    $statusFolder = in_array(($relativeParts[1] ?? ''), doc_lifecycle_folders(), true) ? $relativeParts[1] : doc_lifecycle_folder_from_status('Brouillon');
    $cycle = doc_cycle_from_lifecycle_folder($statusFolder);
    $status = [
        'Vérifier' => 'En vérification',
        'Approuver' => 'En approbation',
        'Diffuser' => 'Diffusé',
        'Utiliser' => 'En vigueur',
        'Réviser' => 'En révision',
        'Archiver' => doc_archived_status(),
        'Supprimer' => 'Exclu',
    ][$statusFolder] ?? 'Brouillon';
    $payload = [
        ':ref' => doc_ref_from_file($relative),
        ':title' => pathinfo($fileName, PATHINFO_FILENAME),
        ':file' => $fileName,
        ':ext' => $extension,
        ':type' => doc_type_from_name($fileName, $extension),
        ':processus' => doc_process_from_relative($relative),
        ':statut' => $status,
        ':abs' => $path,
        ':rel' => $relative,
        ':size' => $item->getSize(),
        ':modified' => date('Y-m-d H:i:s', $item->getMTime()),
        ':obs' => 'Document detecte automatiquement par scan local',
        ':cycle' => $cycle,
        ':dossier_processus' => $processFolder,
        ':dossier_type' => doc_type_from_name($fileName, $extension),
        ':dossier_statut' => $statusFolder,
    ];

    $docSelectStmt->execute([':abs' => $path, ':rel' => $relative]);
    $existing = $docSelectStmt->fetch();
    if ($existing) {
        $docUpdateStmt->execute($payload + [':id' => (int) $existing['id']]);
        $updated++;
        if ((string) ($existing['statut'] ?? '') === 'Fichier introuvable') {
            $restoreStatus = doc_restore_status($existing['statut_precedent'] ?? null);
            $restoreFoundStmt->execute([':status' => $restoreStatus, ':id' => (int) $existing['id']]);
            doc_log($pdo, (int) $existing['id'], 'Restaurer', 'Fichier retrouve pendant le scan : ' . $path, $actor);
            $restored++;
        }
    } else {
        $docInsertStmt->execute($payload);
        $added++;
    }
}

foreach (array_keys($folders) as $folder) {
    $relative = doc_relative_path($folder);
    $role = $relative === '' ? 'root' : (substr_count($relative, DIRECTORY_SEPARATOR) === 0 ? 'process' : 'folder');
    $folderStmt->execute([basename($folder), $folder, $relative, $role, $folder]);
    $folderUpdateStmt->execute([':name' => basename($folder), ':rel' => $relative, ':role' => $role, ':abs' => $folder]);
}

$allFolders = $pdo->query("SELECT id, nom_dossier, chemin_dossier, statut, actif FROM dossiers_documentaires")->fetchAll();
$markFolderMissingStmt = $pdo->prepare("UPDATE dossiers_documentaires SET statut = 'Dossier introuvable', actif = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
$restoreFolderStmt = $pdo->prepare("UPDATE dossiers_documentaires SET statut = 'Actif', actif = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
foreach ($allFolders as $folderRow) {
    $folderPath = (string) ($folderRow['chemin_dossier'] ?? '');
    $folderKey = strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $folderPath));
    $exists = $folderPath !== '' && (isset($seenFolders[$folderKey]) || is_dir($folderPath));
    $isMissing = (string) ($folderRow['statut'] ?? '') === 'Dossier introuvable' || (int) ($folderRow['actif'] ?? 1) === 0;
    if ($exists) {
        if ($isMissing) {
            $restoreFolderStmt->execute([(int) $folderRow['id']]);
            doc_log($pdo, null, 'Restaurer', 'Dossier retrouve pendant le scan : ' . $folderPath, $actor);
            $restoredFolders++;
        }
        continue;
    }
    if ($isMissing) continue;
    $markFolderMissingStmt->execute([(int) $folderRow['id']]);
    doc_log($pdo, null, 'Dossier introuvable détecté', 'Dossier absent du dossier Windows : ' . $folderPath, $actor);
    $missingFolders++;
}

$allDocs = $pdo->query("SELECT id, reference_documentaire, titre_document, chemin_fichier, statut, statut_precedent FROM documents")->fetchAll();
foreach ($allDocs as $doc) {
    $path = (string) ($doc['chemin_fichier'] ?? '');
    $pathKey = strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path));
    if ($path !== '' && isset($seenPaths[$pathKey]) && is_file($path)) continue;
    if ($path !== '' && is_file($path)) continue;
    if ((string) ($doc['statut'] ?? '') === 'Fichier introuvable') continue;

    $previous = doc_previous_status_candidate((string) ($doc['statut'] ?? '')) ?? ($doc['statut_precedent'] ?? null);
    $markMissingStmt->execute([
        ':previous_status' => $previous,
        ':id' => (int) $doc['id'],
    ]);
    doc_log($pdo, (int) $doc['id'], 'Fichier introuvable détecté', 'Fichier absent du dossier Windows : ' . $path, $actor);
    $missing++;
}

doc_log($pdo, null, 'scan', "Scan local termine : {$scanned} fichier(s), {$added} ajoute(s), {$updated} mis a jour, {$missing} fichier(s) introuvable(s), {$missingFolders} dossier(s) introuvable(s).", $actor);
if ($pdo->inTransaction()) {
    $pdo->commit();
}
doc_json([
    'summary' => [
        'scannedCount' => $scanned,
        'addedCount' => $added,
        'updatedCount' => $updated,
        'restoredCount' => $restored,
        'restoredFolderCount' => $restoredFolders,
        'missingCount' => $missing,
        'missingFolderCount' => $missingFolders,
        'skippedCount' => 0,
    ],
]);
?>
