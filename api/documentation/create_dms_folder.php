<?php
/**
 * Create a DMS folder inside DMS/uploads.
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$parentFolder = $data['parentFolder'] ?? '';
$folderName = $data['folderName'] ?? '';

if (!is_string($parentFolder) || !is_string($folderName) || trim($parentFolder) === '' || trim($folderName) === '') {
    echo json_encode(['success' => false, 'error' => 'Missing parameters']);
    exit;
}

$parentFolder = trim(str_replace('\\', '/', $parentFolder), '/');
$folderName = trim($folderName);

if (
    strpos($parentFolder, "\0") !== false ||
    strpos($folderName, "\0") !== false ||
    preg_match('#(^|/)\.\.(/|$)#', $parentFolder) ||
    preg_match('#[\\\\/]#', $folderName)
) {
    echo json_encode(['success' => false, 'error' => 'Invalid folder']);
    exit;
}

$safeFolderName = preg_replace('/[<>:"|?*]/', '_', $folderName);
$safeFolderName = trim($safeFolderName, " .\t\n\r\0\x0B");

if ($safeFolderName === '') {
    echo json_encode(['success' => false, 'error' => 'Invalid folder name']);
    exit;
}

$dmsPath = realpath(__DIR__ . '/../../DMS/uploads');

if (!$dmsPath || !is_dir($dmsPath)) {
    echo json_encode(['success' => false, 'error' => 'DMS directory not found']);
    exit;
}

$parentPath = $dmsPath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $parentFolder);

if (!is_dir($parentPath) && !mkdir($parentPath, 0755, true)) {
    echo json_encode(['success' => false, 'error' => 'Failed to create parent folder']);
    exit;
}

$parentRealPath = realpath($parentPath);

if (!$parentRealPath || strpos($parentRealPath, $dmsPath) !== 0 || !is_dir($parentRealPath)) {
    echo json_encode(['success' => false, 'error' => 'Parent folder not found']);
    exit;
}

$newFolderPath = $parentRealPath . DIRECTORY_SEPARATOR . $safeFolderName;

if (file_exists($newFolderPath)) {
    echo json_encode(['success' => false, 'error' => 'Folder already exists']);
    exit;
}

if (!mkdir($newFolderPath, 0755, true)) {
    echo json_encode(['success' => false, 'error' => 'Failed to create folder']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Folder created successfully',
    'folderName' => $safeFolderName,
    'parentFolder' => $parentFolder,
    'folder' => $parentFolder . '/' . $safeFolderName
]);
?>
