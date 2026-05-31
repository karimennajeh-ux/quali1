<?php
/**
 * Get files from DMS/uploads directory
 * Returns JSON with folder structure and file listings
 */

header('Content-Type: application/json');

$dmsPath = realpath(__DIR__ . '/../../DMS/uploads');

if (!$dmsPath || !is_dir($dmsPath)) {
    echo json_encode(['success' => false, 'error' => 'DMS directory not found']);
    exit;
}

function getFileInfo($filePath) {
    $info = [
        'name' => basename($filePath),
        'path' => $filePath,
        'size' => filesize($filePath),
        'modified' => filemtime($filePath),
        'type' => pathinfo($filePath, PATHINFO_EXTENSION),
    ];
    return $info;
}

function scanFolder($folderPath, $parentName = '') {
    $items = [];
    
    if (!is_dir($folderPath)) {
        return $items;
    }
    
    $files = scandir($folderPath);
    
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        
        $fullPath = $folderPath . DIRECTORY_SEPARATOR . $file;
        
        if (is_file($fullPath)) {
            $info = array_merge(
                getFileInfo($fullPath),
                ['folder' => $parentName, 'isFolder' => false]
            );
            // compute relative path from uploads root
            global $dmsPath;
            $rel = substr($fullPath, strlen($dmsPath) + 1);
            // normalize to forward slashes for web paths
            $info['relPath'] = str_replace('\\', '/', $rel);
            $items[] = $info;
        } elseif (is_dir($fullPath)) {
            // Recursively scan subfolders
            $subItems = scanFolder($fullPath, $parentName . '/' . $file);
            $items = array_merge($items, $subItems);
        }
    }
    
    return $items;
}

$folders = [];
$allFiles = [];

// Scan main folders
$mainDirs = scandir($dmsPath);
foreach ($mainDirs as $dir) {
    if ($dir === '.' || $dir === '..') {
        continue;
    }
    
    $fullPath = $dmsPath . DIRECTORY_SEPARATOR . $dir;
    
    if (is_dir($fullPath)) {
        $folderFiles = scanFolder($fullPath, $dir);
        
        $folders[$dir] = [
            'name' => $dir,
            'path' => $fullPath,
            'fileCount' => count($folderFiles),
            'files' => $folderFiles
        ];
        
        $allFiles = array_merge($allFiles, $folderFiles);
    }
}

// Sort files by modification date (newest first)
usort($allFiles, function($a, $b) {
    return $b['modified'] - $a['modified'];
});

echo json_encode([
    'success' => true,
    'folders' => $folders,
    'allFiles' => $allFiles,
    'totalFiles' => count($allFiles)
]);
?>
