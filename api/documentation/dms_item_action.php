<?php
/**
 * Generic DMS item actions: rename, move, delete and metadata update.
 */

declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

function dms_item_json(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dms_item_clean_path(string $path): string {
    $path = str_replace('\\', '/', trim($path));
    $path = preg_replace('#^DMS/uploads/#i', '', $path);
    return trim($path, '/');
}

function dms_item_safe_name(string $name): string {
    $name = trim($name);
    $name = preg_replace('/[<>:"|?*\\\\\/]+/', '_', $name);
    return trim((string) $name, " .\t\n\r\0\x0B");
}

function dms_item_root(): string {
    $root = realpath(__DIR__ . '/../../DMS/uploads');
    if (!$root || !is_dir($root)) dms_item_json(['success' => false, 'error' => 'Dossier DMS introuvable'], 404);
    return $root;
}

function dms_item_resolve(string $relative, bool $mustExist = true): array {
    $root = dms_item_root();
    $relative = dms_item_clean_path($relative);
    if ($relative === '' || strpos($relative, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $relative)) {
        dms_item_json(['success' => false, 'error' => 'Chemin invalide'], 400);
    }
    $candidate = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
    $real = realpath($candidate);
    if ($mustExist && (!$real || strpos($real, $root) !== 0 || (!is_file($real) && !is_dir($real)))) {
        dms_item_json(['success' => false, 'error' => 'Element introuvable'], 404);
    }
    return [$root, $relative, $real ?: $candidate];
}

if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    dms_item_json(['success' => false, 'error' => 'Methode invalide'], 405);
}

$input = doc_input();
$action = strtolower(trim((string) ($input['action'] ?? '')));
$path = (string) ($input['path'] ?? '');

if ($action === '') dms_item_json(['success' => false, 'error' => 'Action manquante'], 400);

[$root, $relative, $source] = dms_item_resolve($path, $action !== 'metadata');
$newRelative = $relative;

if ($action === 'rename') {
    $newName = dms_item_safe_name((string) ($input['newName'] ?? ''));
    if ($newName === '') dms_item_json(['success' => false, 'error' => 'Nouveau nom invalide'], 400);
    $destination = dirname($source) . DIRECTORY_SEPARATOR . $newName;
    if (file_exists($destination)) dms_item_json(['success' => false, 'error' => 'Un element avec ce nom existe deja'], 409);
    if (!rename($source, $destination)) dms_item_json(['success' => false, 'error' => 'Renommage impossible'], 500);
    $newRelative = str_replace('\\', '/', substr($destination, strlen($root) + 1));
} elseif ($action === 'move') {
    $targetFolder = dms_item_clean_path((string) ($input['targetFolder'] ?? ''));
    if ($targetFolder === '' || strpos($targetFolder, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $targetFolder)) {
        dms_item_json(['success' => false, 'error' => 'Dossier cible invalide'], 400);
    }
    $targetDir = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $targetFolder);
    if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true)) {
        dms_item_json(['success' => false, 'error' => 'Creation du dossier cible impossible'], 500);
    }
    $targetReal = realpath($targetDir);
    if (!$targetReal || strpos($targetReal, $root) !== 0) dms_item_json(['success' => false, 'error' => 'Dossier cible refuse'], 403);
    $destination = $targetReal . DIRECTORY_SEPARATOR . basename($source);
    if (file_exists($destination)) dms_item_json(['success' => false, 'error' => 'Un element existe deja dans le dossier cible'], 409);
    if (!rename($source, $destination)) dms_item_json(['success' => false, 'error' => 'Deplacement impossible'], 500);
    $newRelative = str_replace('\\', '/', substr($destination, strlen($root) + 1));
} elseif ($action === 'delete') {
    if (is_dir($source)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        if (!rmdir($source)) dms_item_json(['success' => false, 'error' => 'Suppression du dossier impossible'], 500);
    } elseif (!unlink($source)) {
        dms_item_json(['success' => false, 'error' => 'Suppression du fichier impossible'], 500);
    }
} elseif ($action === 'metadata') {
    $pdo = doc_pdo();
    $metadata = is_array($input['metadata'] ?? null) ? $input['metadata'] : [];
    $sets = [];
    $params = [':rel' => $relative];
    $allowed = [
        'titre_document' => 'titre_document',
        'reference_documentaire' => 'reference_documentaire',
        'type_document' => 'type_document',
        'processus' => 'processus',
        'version' => 'version',
        'statut' => 'statut',
        'responsable_redacteur' => 'responsable_redacteur',
        'observation' => 'observation',
    ];
    foreach ($allowed as $key => $column) {
        if (!array_key_exists($key, $metadata)) continue;
        $sets[] = "{$column} = :{$key}";
        $params[":{$key}"] = trim((string) $metadata[$key]);
    }
    if (!$sets) dms_item_json(['success' => false, 'error' => 'Aucune metadonnee a enregistrer'], 400);
    $sets[] = 'updated_at = CURRENT_TIMESTAMP';
    $stmt = $pdo->prepare('UPDATE documents SET ' . implode(', ', $sets) . ' WHERE chemin_relatif = :rel OR file_path = :rel');
    $stmt->execute($params);
} else {
    dms_item_json(['success' => false, 'error' => 'Action inconnue'], 400);
}

dms_item_json([
    'success' => true,
    'ok' => true,
    'action' => $action,
    'path' => $newRelative,
    'message' => 'Action DMS effectuee avec succes',
]);
?>
