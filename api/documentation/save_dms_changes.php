<?php
/**
 * Persist DMS/uploads changes into the documentation database.
 *
 * The DMS UI writes files/folders first, then calls this endpoint to rescan
 * DMS/uploads and synchronize documents, folders, missing files and history.
 */

declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'ok' => false,
        'error' => 'Methode invalide',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

require __DIR__ . '/scan_documents.php';
?>
