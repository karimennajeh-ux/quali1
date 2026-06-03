<?php
/**
 * Move a DMS file to the selected lifecycle step folder.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function dms_move_json(array $payload): void {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dms_clean_relative_path(string $path): string {
    $path = str_replace('\\', '/', trim($path));
    $path = preg_replace('#^DMS/uploads/#i', '', $path);
    return ltrim($path, '/');
}

function dms_normalize_text(string $value): string {
    $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    return trim((string) $value);
}

function dms_infer_document_class(array $parts, string $fileName, array $classes): string {
    foreach ($parts as $part) {
        if (in_array($part, $classes, true)) {
            return $part;
        }
    }

    $text = dms_normalize_text(implode(' ', $parts) . ' ' . $fileName);
    if (preg_match('/\b(enregistrement|enregistrements)\b/', $text)) return 'Enregistrement';
    if (preg_match('/\b(formulaire|formulaires|fo|fop|fpil|fsup)\b/', $text)) return 'Formulaire';
    if (preg_match('/\b(instruction|instructions|ins)\b/', $text)) return 'Instruction';
    return 'Procédure';
}

$steps = ['1-créer', '2-Vérifier', '3-Approuver', '4-Réviser', '5-Archiver', '6-Supprimer'];
$legacy = [
    'Créer' => '1-créer',
    'Creer' => '1-créer',
    'Vérifier' => '2-Vérifier',
    'Verifier' => '2-Vérifier',
    'Approuver' => '3-Approuver',
    'Diffuser' => '3-Approuver',
    'Utiliser' => '3-Approuver',
    'Réviser' => '4-Réviser',
    'Reviser' => '4-Réviser',
    'Archiver' => '5-Archiver',
    'Supprimer' => '6-Supprimer',
];
$processRoots = ['Procesus Operationnel', 'Procesus Pilotage', 'Procesus support'];
$documentClasses = ['Procédure', 'Instruction', 'Formulaire', 'Enregistrement'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    dms_move_json(['success' => false, 'error' => 'Méthode invalide']);
}

$input = json_decode(file_get_contents('php://input'), true);
$relativePath = is_array($input) ? (string) ($input['path'] ?? '') : '';
$targetStep = is_array($input) ? (string) ($input['targetStep'] ?? '') : '';

if (!in_array($targetStep, $steps, true)) {
    dms_move_json(['success' => false, 'error' => 'Étape de cycle invalide']);
}

$relativePath = dms_clean_relative_path($relativePath);

if ($relativePath === '' || strpos($relativePath, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $relativePath)) {
    dms_move_json(['success' => false, 'error' => 'Chemin de fichier invalide']);
}

$root = realpath(__DIR__ . '/../../DMS/uploads');
if (!$root || !is_dir($root)) {
    dms_move_json(['success' => false, 'error' => 'Dossier DMS introuvable']);
}

$source = realpath($root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath));
if (!$source || strpos($source, $root) !== 0 || !is_file($source)) {
    dms_move_json(['success' => false, 'error' => 'Fichier introuvable']);
}

$parts = array_values(array_filter(explode('/', $relativePath), static fn($part) => $part !== ''));
if (count($parts) < 2) {
    dms_move_json(['success' => false, 'error' => 'Le fichier doit être dans un dossier DMS']);
}

$fileName = array_pop($parts);
$parts = array_map(static fn($part) => $legacy[$part] ?? $part, $parts);
$stepIndex = null;
foreach ($parts as $index => $part) {
    if (in_array($part, $steps, true)) {
        $stepIndex = $index;
        break;
    }
}

$rootFolder = $parts[0] ?? '';
if ($rootFolder === '') {
    dms_move_json(['success' => false, 'error' => 'Dossier parent invalide']);
}

if (in_array($rootFolder, $processRoots, true)) {
    $documentClass = dms_infer_document_class($parts, $fileName, $documentClasses);
    $targetFolder = implode('/', [$rootFolder, $documentClass, $targetStep]);
} else {
    $baseParts = $stepIndex === null ? $parts : array_slice($parts, 0, $stepIndex);
    if (!$baseParts) {
        dms_move_json(['success' => false, 'error' => 'Dossier parent invalide']);
    }
    $targetFolder = implode('/', array_merge($baseParts, [$targetStep]));
}

$targetDir = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $targetFolder);

if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
    dms_move_json(['success' => false, 'error' => 'Impossible de créer le dossier cible']);
}

$targetDirReal = realpath($targetDir);
if (!$targetDirReal || strpos($targetDirReal, $root) !== 0 || !is_dir($targetDirReal)) {
    dms_move_json(['success' => false, 'error' => 'Dossier cible invalide']);
}

$destination = $targetDirReal . DIRECTORY_SEPARATOR . basename($fileName);
$info = pathinfo($destination);
$counter = 1;
while (file_exists($destination)) {
    $extension = isset($info['extension']) && $info['extension'] !== '' ? '.' . $info['extension'] : '';
    $destination = $info['dirname'] . DIRECTORY_SEPARATOR . $info['filename'] . '_' . $counter . $extension;
    $counter++;
}

if (!rename($source, $destination)) {
    dms_move_json(['success' => false, 'error' => 'Impossible de déplacer le fichier']);
}

$newRelative = str_replace('\\', '/', substr($destination, strlen($root) + 1));

dms_move_json([
    'success' => true,
    'path' => $newRelative,
    'folder' => $targetFolder,
    'fileName' => basename($destination),
    'targetStep' => $targetStep,
]);
?>
