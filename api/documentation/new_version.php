<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

function next_doc_version(string $current): string
{
    $v = preg_replace('/^v/i', '', trim($current));
    if (preg_match('/^(\d+)(?:\.(\d+))?$/', $v, $m)) {
        return ((int) $m[1] + 1) . '.0';
    }
    return '2.0';
}

function versioned_ref(PDO $pdo, string $ref, string $version): string
{
    $candidate = $ref . '-V' . preg_replace('/[^0-9A-Za-z]+/', '.', $version);
    $base = $candidate;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM documents WHERE reference_documentaire = ?");
    for ($i = 0; $i < 1000; $i++) {
        $try = $i === 0 ? $base : $base . '-' . $i;
        $stmt->execute([$try]);
        if ((int) $stmt->fetchColumn() === 0) return $try;
    }
    doc_error('Référence de nouvelle version indisponible.', 500);
}

$pdo = doc_pdo();
$input = doc_input();
$id = (int) ($input['id'] ?? 0);
if ($id <= 0) doc_error('Identifiant document manquant.', 422);
$actor = trim((string) ($input['actorName'] ?? 'Utilisateur')) ?: 'Utilisateur';
$reason = trim((string) ($input['motif_revision'] ?? $input['reason'] ?? 'Nouvelle version documentaire'));
$doc = doc_fetch($pdo, $id);
$oldPath = (string) ($doc['chemin_fichier'] ?? '');
$oldReal = $oldPath !== '' ? realpath($oldPath) : false;
$rootReal = realpath(doc_root());
if (!$rootReal || !$oldReal || !is_file($oldReal) || !doc_path_is_inside_root($oldReal, $rootReal)) {
    doc_error('Fichier source introuvable ou hors du dossier Processus.', 404);
}

$oldVersion = trim((string) ($doc['version'] ?? '1.0')) ?: '1.0';
$newVersion = trim((string) ($input['nouvelle_version'] ?? $input['newVersion'] ?? '')) ?: next_doc_version($oldVersion);
$archiveDir = doc_target_directory((string) $doc['processus'], (string) $doc['type_document'], 'Archivé', true)[0];
$workInfo = doc_target_directory((string) $doc['processus'], (string) $doc['type_document'], 'Brouillon', true);
[$workDir, $processFolder, $typeFolder, $statusFolder, $cycle] = $workInfo;
$archivePath = doc_unique_path($archiveDir, basename($oldReal), $oldReal);
if (strcasecmp($archivePath, $oldReal) !== 0 && !rename($oldReal, $archivePath)) {
    doc_error("Archivage physique de l'ancienne version impossible.", 500);
}
$archiveReal = realpath($archivePath) ?: $archivePath;

$baseName = pathinfo((string) $doc['nom_fichier'], PATHINFO_FILENAME);
$ext = strtolower(pathinfo((string) $doc['nom_fichier'], PATHINFO_EXTENSION));
$newFileName = preg_replace('/_V[0-9][A-Za-z0-9._-]*$/i', '', $baseName) . '_V' . preg_replace('/[^0-9A-Za-z._-]+/', '_', $newVersion) . ($ext ? '.' . $ext : '');
$newPath = doc_unique_path($workDir, $newFileName);
if (!copy($archiveReal, $newPath)) doc_error('Creation du fichier de nouvelle version impossible.', 500);
$newReal = realpath($newPath);
if (!$newReal || !doc_path_is_inside_root($newReal, $rootReal)) doc_error('Nouvelle version hors dossier autorise.', 403);

$pdo->beginTransaction();
try {
    $oldRel = doc_relative_path($archiveReal);
    $newRel = doc_relative_path($newReal);
    $archiveParts = doc_target_parts((string) $doc['processus'], (string) $doc['type_document'], 'Archivé');
    $stmt = $pdo->prepare("
        UPDATE documents SET statut = 'Archivé', chemin_fichier = ?, chemin_relatif = ?, nom_fichier = ?,
          cycle_documentaire = ?, dossier_processus = ?, dossier_type = ?, dossier_statut = ?,
          est_version_active = 0, date_archivage = NOW(), motif_revision = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ");
    $stmt->execute([$archiveReal, $oldRel, basename($archiveReal), $archiveParts[3], $archiveParts[0], $archiveParts[1], $archiveParts[2], $reason, $id]);

    $newRef = versioned_ref($pdo, (string) $doc['reference_documentaire'], $newVersion);
    $insert = $pdo->prepare("
        INSERT INTO documents (
          reference_documentaire, titre_document, nom_fichier, extension, type_document, processus, version, statut,
          responsable_redacteur, verificateur, approbateur, diffuseur, chemin_fichier, chemin_relatif,
          taille_fichier, date_modification, stockage, observation, cycle_documentaire, dossier_processus,
          dossier_type, dossier_statut, version_parent_id, est_version_active, date_creation_doc, motif_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Brouillon', ?, ?, ?, ?, ?, ?, ?, ?, 'Local', ?, ?, ?, ?, ?, ?, 1, NOW(), ?)
    ");
    $insert->execute([
        $newRef,
        (string) $doc['titre_document'],
        basename($newReal),
        $ext,
        (string) $doc['type_document'],
        (string) $doc['processus'],
        $newVersion,
        (string) $doc['responsable_redacteur'],
        (string) $doc['verificateur'],
        (string) $doc['approbateur'],
        (string) $doc['diffuseur'],
        $newReal,
        $newRel,
        filesize($newReal),
        date('Y-m-d H:i:s', filemtime($newReal)),
        (string) $doc['observation'],
        $cycle,
        $processFolder,
        $typeFolder,
        $statusFolder,
        $id,
        $reason,
    ]);
    $newId = (int) $pdo->lastInsertId();
    $ver = $pdo->prepare("INSERT INTO document_versions (document_id, ancienne_version, nouvelle_version, ancien_chemin, nouveau_chemin, motif_revision) VALUES (?, ?, ?, ?, ?, ?)");
    $ver->execute([$id, $oldVersion, $newVersion, $archiveReal, $newReal, $reason]);
    doc_log_activity($pdo, $id, 'Nouvelle version', [
        'detail' => 'Ancienne version archivée, nouvelle version créée',
        'ancien_statut' => (string) $doc['statut'],
        'nouveau_statut' => 'Archivé',
        'ancienne_version' => $oldVersion,
        'nouvelle_version' => $newVersion,
        'observation' => $reason,
    ], $actor);
    doc_log_activity($pdo, $newId, 'Nouvelle version', [
        'detail' => 'Nouvelle version créée dans 02_En_cours',
        'ancien_statut' => 'Archivé',
        'nouveau_statut' => 'Brouillon',
        'ancienne_version' => $oldVersion,
        'nouvelle_version' => $newVersion,
        'observation' => $reason,
    ], $actor);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    doc_error($e->getMessage(), 500);
}

$stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
$stmt->execute([$newId]);
doc_json(['item' => doc_item($stmt->fetch()), 'oldRelativePath' => doc_relative_path($archiveReal), 'newRelativePath' => doc_relative_path($newReal)]);
?>
