<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$input = doc_input();
$actor = trim((string) ($input['actorName'] ?? 'Utilisateur')) ?: 'Utilisateur';
$name = trim((string) ($input['nom_dossier'] ?? $input['name'] ?? $input['docRef'] ?? ''));
$process = trim((string) ($input['processus'] ?? $input['processName'] ?? 'Processus support'));
$type = trim((string) ($input['type_document'] ?? $input['docType'] ?? 'Procedure'));
$cycle = trim((string) ($input['cycle_documentaire'] ?? $input['cycle'] ?? 'En cours'));
if ($name === '') doc_error('Nom du dossier obligatoire.', 422);

$status = match ($cycle) {
    'Modèles', 'Modeles', 'Modèle', 'Modele' => 'Modèle',
    'En vigueur' => 'En vigueur',
    'Archives', 'Archive' => 'Archivé',
    default => 'Brouillon',
};
[$baseDir, $processFolder, $typeFolder, $statusFolder, $cycleLabel] = doc_target_directory($process, $type, $status, true);
$safeName = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/', '_', $name);
$safeName = trim((string) preg_replace('/\s+/', '_', $safeName), '._-');
if ($safeName === '') doc_error('Nom de dossier invalide.', 422);
$dir = $baseDir . DIRECTORY_SEPARATOR . $safeName;
if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) doc_error('Creation du dossier impossible.', 500);
$dirReal = realpath($dir);
$rootReal = realpath(doc_root());
if (!$dirReal || !$rootReal || !doc_path_is_inside_root($dirReal . DIRECTORY_SEPARATOR . 'check.tmp', $rootReal)) {
    doc_error('Dossier refuse hors du dossier Processus.', 403);
}
$relative = doc_relative_path($dirReal);
$stmt = $pdo->prepare("
    INSERT INTO dossiers_documentaires (nom_dossier, chemin_dossier, chemin_relatif, role_dossier, statut, actif)
    VALUES (?, ?, ?, ?, 'Actif', 1)
    ON DUPLICATE KEY UPDATE chemin_dossier = VALUES(chemin_dossier), chemin_relatif = VALUES(chemin_relatif), statut = 'Actif', actif = 1, updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([$safeName, $dirReal, $relative, $processFolder . '/' . $typeFolder . '/' . $statusFolder]);
doc_log_activity($pdo, null, 'Création dossier', [
    'detail' => 'Dossier documentaire créé : ' . $relative,
    'observation' => $cycleLabel,
], $actor);
doc_json(['item' => ['label' => $safeName, 'relPath' => $relative, 'cycle' => $cycleLabel]]);
?>
