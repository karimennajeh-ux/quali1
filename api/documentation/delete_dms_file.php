<?php
/**
 * Delete a DMS file from DMS/uploads using a relative path.
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$relativePath = $data['path'] ?? '';

if (!is_string($relativePath) || trim($relativePath) === '') {
    echo json_encode(['success' => false, 'error' => 'File path not specified']);
    exit;
}

$relativePath = str_replace('\\', '/', trim($relativePath));
$relativePath = ltrim($relativePath, '/');

if (strpos($relativePath, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $relativePath)) {
    echo json_encode(['success' => false, 'error' => 'Invalid file path']);
    exit;
}

$dmsPath = realpath(__DIR__ . '/../../DMS/uploads');

if (!$dmsPath || !is_dir($dmsPath)) {
    echo json_encode(['success' => false, 'error' => 'DMS directory not found']);
    exit;
}

$filePath = $dmsPath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
$fileRealPath = realpath($filePath);

if (!$fileRealPath || strpos($fileRealPath, $dmsPath) !== 0 || !is_file($fileRealPath)) {
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit;
}

if (!unlink($fileRealPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to delete file']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'File deleted successfully',
    'path' => $relativePath
]);
?>
