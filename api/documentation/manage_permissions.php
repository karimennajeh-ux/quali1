<?php
declare(strict_types=1);

require_once __DIR__ . '/permissions.php';
header('Content-Type: application/json');

$action = trim((string) ($_GET['action'] ?? $_POST['action'] ?? ''));

try {
    // Initialize permissions table on first use
    doc_init_permissions_table();
    
    if ($action === 'get') {
        $document_id = (int) ($_GET['document_id'] ?? 0);
        if ($document_id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid document_id']);
            exit;
        }
        
        $perms = doc_get_permissions($document_id);
        echo json_encode(['success' => true, 'permissions' => $perms]);
    }
    elseif ($action === 'grant') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['document_id'], $data['user_name'], $data['user_email'], $data['permission_level'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $success = doc_grant_permission(
            (int) $data['document_id'],
            (string) $data['user_name'],
            (string) $data['user_email'],
            (string) $data['permission_level'],
            (string) ($data['granted_by'] ?? 'Admin')
        );
        
        echo json_encode(['success' => $success]);
    }
    elseif ($action === 'revoke') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['permission_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing permission_id']);
            exit;
        }
        
        $success = doc_revoke_permission((int) $data['permission_id']);
        echo json_encode(['success' => $success]);
    }
    elseif ($action === 'check') {
        $document_id = (int) ($_GET['document_id'] ?? 0);
        $user_email = trim((string) ($_GET['user_email'] ?? ''));
        $min_level = trim((string) ($_GET['min_level'] ?? 'Viewers'));
        
        if ($document_id <= 0 || !$user_email) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing parameters']);
            exit;
        }
        
        $has_perm = doc_user_has_permission($document_id, $user_email, $min_level);
        echo json_encode(['success' => true, 'has_permission' => $has_perm]);
    }
    else {
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
