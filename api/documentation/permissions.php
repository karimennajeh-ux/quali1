<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

/**
 * Permissions module for document role-based access control
 * Roles: Administrators, Approvers, Editors, Viewers
 */

function doc_init_permissions_table(): void
{
    $pdo = doc_pdo();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS document_permissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          document_id INT NOT NULL,
          user_id INT,
          user_name VARCHAR(255),
          user_email VARCHAR(255),
          role VARCHAR(50) NOT NULL,
          permission_level ENUM('Administrators', 'Approvers', 'Editors', 'Viewers') NOT NULL DEFAULT 'Viewers',
          granted_by VARCHAR(255),
          granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_doc_user_role (document_id, user_id, role),
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
          INDEX (user_id),
          INDEX (permission_level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

function doc_grant_permission(
    int $document_id,
    string $user_name,
    string $user_email,
    string $permission_level,
    string $granted_by = 'System'
): bool {
    if (!in_array($permission_level, ['Administrators', 'Approvers', 'Editors', 'Viewers'])) {
        return false;
    }
    
    $pdo = doc_pdo();
    $stmt = $pdo->prepare("
        INSERT INTO document_permissions 
        (document_id, user_name, user_email, role, permission_level, granted_by)
        VALUES (:doc_id, :user_name, :user_email, :role, :perm_level, :granted_by)
        ON DUPLICATE KEY UPDATE 
            permission_level = :perm_level,
            granted_by = :granted_by,
            updated_at = CURRENT_TIMESTAMP
    ");
    
    return $stmt->execute([
        ':doc_id' => $document_id,
        ':user_name' => $user_name,
        ':user_email' => $user_email,
        ':role' => 'document_user',
        ':perm_level' => $permission_level,
        ':granted_by' => $granted_by
    ]);
}

function doc_get_permissions(int $document_id): array
{
    $pdo = doc_pdo();
    $stmt = $pdo->prepare("
        SELECT id, user_name, user_email, permission_level, granted_at
        FROM document_permissions
        WHERE document_id = :doc_id
        ORDER BY permission_level DESC, granted_at DESC
    ");
    $stmt->execute([':doc_id' => $document_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function doc_revoke_permission(int $permission_id): bool
{
    $pdo = doc_pdo();
    $stmt = $pdo->prepare("DELETE FROM document_permissions WHERE id = :id");
    return $stmt->execute([':id' => $permission_id]);
}

function doc_user_has_permission(int $document_id, string $user_email, string $min_level = 'Viewers'): bool
{
    $pdo = doc_pdo();
    
    $level_hierarchy = [
        'Administrators' => 4,
        'Approvers' => 3,
        'Editors' => 2,
        'Viewers' => 1
    ];
    
    $min_value = $level_hierarchy[$min_level] ?? 1;
    
    $stmt = $pdo->prepare("
        SELECT permission_level FROM document_permissions
        WHERE document_id = :doc_id AND user_email = :email
        LIMIT 1
    ");
    $stmt->execute([':doc_id' => $document_id, ':email' => $user_email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row) {
        return false;
    }
    
    $user_level = $level_hierarchy[$row['permission_level']] ?? 0;
    return $user_level >= $min_value;
}
?>
