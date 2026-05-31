<?php
/**
 * Upload DMS file to specified folder
 * Handles file uploads to DMS/uploads subdirectories
 */

header('Content-Type: application/json');

// Check if request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

// Get folder and file
$folder = $_POST['folder'] ?? '';
$file = $_FILES['file'] ?? null;

if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'File upload failed']);
    exit;
}

if (empty($folder)) {
    echo json_encode(['success' => false, 'error' => 'Folder not specified']);
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

// Sanitize filename
$fileName = basename($file['name']);
$fileName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $fileName);

$destinationPath = $uploadDir . '/' . $fileName;

// Prevent overwrite, add number if file exists
$counter = 1;
$pathInfo = pathinfo($destinationPath);
while (file_exists($destinationPath)) {
    $newName = $pathInfo['filename'] . '_' . $counter . '.' . $pathInfo['extension'];
    $destinationPath = $pathInfo['dirname'] . '/' . $newName;
    $counter++;
}

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $destinationPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to save file']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'File uploaded successfully',
    'fileName' => basename($destinationPath),
    'folder' => $folder,
    'path' => $destinationPath,
    'size' => filesize($destinationPath)
]);
