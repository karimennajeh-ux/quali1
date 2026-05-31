<?php
/**
 * Create new DMS document
 * Creates a new document file in the specified folder
 */

header('Content-Type: application/json');

// Get JSON data
$data = json_decode(file_get_contents('php://input'), true);

$fileName = $data['fileName'] ?? '';
$content = $data['content'] ?? '';
$folder = $data['folder'] ?? '';

if (empty($fileName) || empty($folder)) {
    echo json_encode(['success' => false, 'error' => 'Missing parameters']);
    exit;
}

$dmsPath = realpath(__DIR__ . '/../../DMS/uploads');

if (!$dmsPath || !is_dir($dmsPath)) {
    echo json_encode(['success' => false, 'error' => 'DMS directory not found']);
    exit;
}

$folder = trim(str_replace('\\', '/', $folder), '/');

if ($folder === '' || strpos($folder, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $folder)) {
    echo json_encode(['success' => false, 'error' => 'Invalid folder']);
    exit;
}

$uploadDir = $dmsPath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $folder);

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    echo json_encode(['success' => false, 'error' => 'Failed to create folder']);
    exit;
}

$uploadDir = realpath($uploadDir);

if (!$uploadDir || strpos($uploadDir, $dmsPath) !== 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid folder path']);
    exit;
}

// Sanitize filename and add extension
$fileName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $fileName);
if (!preg_match('/\.\w+$/', $fileName)) {
    $fileName .= '.txt';
}

$destinationPath = $uploadDir . '/' . $fileName;

// Prevent overwrite, add number if file exists
$counter = 1;
$pathInfo = pathinfo($destinationPath);
while (file_exists($destinationPath)) {
    $newName = $pathInfo['filename'] . '_' . $counter . '.' . $pathInfo['extension'];
    $destinationPath = $pathInfo['dirname'] . '/' . $newName;
    $counter++;
}

// Write file
if (!file_put_contents($destinationPath, $content)) {
    echo json_encode(['success' => false, 'error' => 'Failed to create file']);
    exit;
}

// Set proper permissions
chmod($destinationPath, 0644);

echo json_encode([
    'success' => true,
    'message' => 'Document created successfully',
    'fileName' => basename($destinationPath),
    'folder' => $folder,
    'path' => $destinationPath,
    'size' => filesize($destinationPath)
]);
