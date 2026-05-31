<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

function org_norm(string $value): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    return strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', ' ', $ascii)));
}

function org_process_folder(string $processus): string
{
    $key = org_norm($processus);
    if (str_contains($key, 'pilotage')) return '01_Processus_pilotage';
    if (str_contains($key, 'operationnel')) return '02_Processus_operationnel';
    if (str_contains($key, 'support')) return '03_Processus_support';
    return '03_Processus_support';
}

function org_type_folder(string $type): array
{
    $key = org_norm($type);
    if (str_contains($key, 'manuel')) return ['00_Documents_generaux', 'Manuel_qualite'];
    if (str_contains($key, 'politique')) return ['00_Documents_generaux', 'Politique_qualite'];
    if (str_contains($key, 'instruction')) return ['Instructions'];
    if (str_contains($key, 'formulaire')) return ['Formulaires'];
    if (str_contains($key, 'enregistrement')) return ['Enregistrements'];
    return ['Procedures'];
}

function org_status_folder(string $type, string $status): string
{
    $typeKey = org_norm($type);
    $statusKey = org_norm($status);
    if (str_contains($typeKey, 'modele') || str_contains($typeKey, 'model')) return '01_Modeles';
    if (in_array($statusKey, ['brouillon', 'en verification', 'en correction', 'en approbation', 'a corriger', 'en revue'], true)) return '02_En_cours';
    if (in_array($statusKey, ['approuve', 'diffuse', 'en vigueur', 'valide'], true)) return '03_En_vigueur';
    if (in_array($statusKey, ['archive', 'obsolete', 'remplace'], true)) return '04_Archives';
    return '02_En_cours';
}

function org_cycle_from_folder(string $folder): string
{
    return [
        '01_Modeles' => 'Modele',
        '02_En_cours' => 'En cours',
        '03_En_vigueur' => 'En vigueur',
        '04_Archives' => 'Archive',
    ][$folder] ?? 'En cours';
}

function org_target_parts(array $doc): array
{
    return doc_target_parts(
        (string) ($doc['processus'] ?? ''),
        (string) ($doc['type_document'] ?? ''),
        (string) ($doc['statut'] ?? '')
    );
}

function org_unique_destination(string $dir, string $fileName, string $currentReal = ''): string
{
    $base = pathinfo($fileName, PATHINFO_FILENAME);
    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    for ($i = 0; $i < 1000; $i++) {
        $suffix = $i === 0 ? '' : '_' . $i;
        $candidate = $dir . DIRECTORY_SEPARATOR . $base . $suffix . ($ext !== '' ? '.' . $ext : '');
        if (!file_exists($candidate)) return $candidate;
        $candidateReal = realpath($candidate);
        if ($currentReal !== '' && $candidateReal && strcasecmp($candidateReal, $currentReal) === 0) return $candidateReal;
    }
    doc_error('Impossible de trouver un nom de fichier disponible pour le classement.', 500);
}

$pdo = doc_pdo();
$input = doc_input();
$actor = trim((string) ($input['actorName'] ?? $input['acteur'] ?? 'Systeme')) ?: 'Systeme';
$execute = filter_var($input['execute'] ?? false, FILTER_VALIDATE_BOOLEAN);
$root = doc_root();
$rootReal = realpath($root);
if (!$rootReal) doc_error('Dossier documentaire autorise introuvable.', 500);

$docs = $pdo->query("SELECT * FROM documents ORDER BY id")->fetchAll();
$updates = $pdo->prepare("
    UPDATE documents
    SET chemin_fichier = :abs,
        chemin_relatif = :rel,
        nom_fichier = :file,
        dossier_processus = :process_folder,
        dossier_type = :type_folder,
        dossier_statut = :status_folder,
        cycle_documentaire = :cycle,
        date_approbation = CASE WHEN :cycle_for_approval = 'En vigueur' AND date_approbation IS NULL THEN NOW() ELSE date_approbation END,
        date_diffusion = CASE WHEN :cycle_for_diffusion = 'En vigueur' AND date_diffusion IS NULL THEN NOW() ELSE date_diffusion END,
        date_archivage = CASE WHEN :cycle_for_archive = 'Archive' AND date_archivage IS NULL THEN NOW() ELSE date_archivage END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :id
");

$items = [];
$moved = 0;
$skipped = 0;
$missing = 0;
foreach ($docs as $doc) {
    $id = (int) $doc['id'];
    $oldPath = (string) ($doc['chemin_fichier'] ?? '');
    $oldReal = $oldPath !== '' ? realpath($oldPath) : false;
    [$processFolder, $typeFolder, $statusFolder, $cycle] = org_target_parts($doc);
    $targetParts = array_filter([$processFolder, $typeFolder, $statusFolder], fn($x) => $x !== '');
    $targetDir = $rootReal . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $targetParts);
    $fileName = (string) ($doc['nom_fichier'] ?? basename($oldPath));
    $status = (string) ($doc['statut'] ?? '');

    if ($oldReal === false || !is_file($oldReal)) {
        $missing++;
        $items[] = [
            'id' => $id,
            'ref' => $doc['reference_documentaire'] ?? '',
            'title' => $doc['titre_document'] ?? '',
            'oldRelativePath' => doc_relative_path($oldPath),
            'newRelativePath' => doc_relative_path($targetDir . DIRECTORY_SEPARATOR . $fileName),
            'status' => $status,
            'action' => 'Fichier introuvable - aucun deplacement',
        ];
        continue;
    }
    if (!doc_path_is_inside_root($oldReal, $rootReal)) {
        $skipped++;
        $items[] = [
            'id' => $id,
            'ref' => $doc['reference_documentaire'] ?? '',
            'title' => $doc['titre_document'] ?? '',
            'oldRelativePath' => doc_relative_path($oldReal),
            'newRelativePath' => '',
            'status' => $status,
            'action' => 'Ignore - fichier hors dossier autorise',
        ];
        continue;
    }
    if ($execute && !is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
        doc_error('Creation du dossier cible impossible : ' . $targetDir, 500);
    }
    $targetDirForReal = is_dir($targetDir) ? (realpath($targetDir) ?: $targetDir) : $targetDir;
    $targetPath = org_unique_destination($targetDirForReal, $fileName, $oldReal);
    $targetCheck = dirname($targetPath);
    $targetRealForCheck = is_dir($targetCheck) ? realpath($targetCheck) : false;
    if ($targetRealForCheck && !doc_path_is_inside_root($targetRealForCheck . DIRECTORY_SEPARATOR . 'check.tmp', $rootReal)) {
        doc_error('Destination refusee hors dossier documentaire autorise.', 403);
    }
    $same = strcasecmp($oldReal, $targetPath) === 0 || (realpath($targetPath) && strcasecmp($oldReal, (string) realpath($targetPath)) === 0);
    $action = $same ? 'Deja classe' : ($execute ? 'Deplace' : 'Deplacement propose');

    if ($execute && !$same) {
        if (!rename($oldReal, $targetPath)) doc_error('Deplacement impossible : ' . $oldReal, 500);
        $moved++;
    } elseif ($same) {
        $skipped++;
    }

    $finalPath = $execute && !$same ? (realpath($targetPath) ?: $targetPath) : ($same ? $oldReal : $targetPath);
    if ($execute) {
        $relative = doc_relative_path($finalPath);
        $updates->execute([
            ':abs' => $finalPath,
            ':rel' => $relative,
            ':file' => basename($finalPath),
            ':process_folder' => $processFolder,
            ':type_folder' => $typeFolder,
            ':status_folder' => $statusFolder,
            ':cycle' => $cycle,
            ':cycle_for_approval' => $cycle,
            ':cycle_for_diffusion' => $cycle,
            ':cycle_for_archive' => $cycle,
            ':id' => $id,
        ]);
        doc_log($pdo, $id, 'Organisation documentaire', "{$action} : {$oldReal} -> {$finalPath}", $actor);
    }

    $items[] = [
        'id' => $id,
        'ref' => $doc['reference_documentaire'] ?? '',
        'title' => $doc['titre_document'] ?? '',
        'oldRelativePath' => doc_relative_path($oldReal),
        'newRelativePath' => doc_relative_path($finalPath),
        'status' => $status,
        'processFolder' => $processFolder,
        'typeFolder' => $typeFolder,
        'statusFolder' => $statusFolder,
        'cycle' => $cycle,
        'action' => $action,
    ];
}

if ($execute) {
    doc_log($pdo, null, 'Organisation automatique des documents', "{$moved} fichier(s) deplace(s), {$skipped} deja classe(s), {$missing} introuvable(s).", $actor);
}

doc_json([
    'mode' => $execute ? 'execute' : 'preview',
    'summary' => [
        'totalCount' => count($docs),
        'movedCount' => $moved,
        'skippedCount' => $skipped,
        'missingCount' => $missing,
        'plannedCount' => count(array_filter($items, fn($x) => ($x['action'] ?? '') === 'Deplacement propose')),
    ],
    'items' => $items,
]);
?>
