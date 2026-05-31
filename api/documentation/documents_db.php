<?php
/**
 * Database functions for documents table
 * Manages document records in the QUALI database
 */

/**
 * Get database connection
 */
function getDocumentsDb() {
    try {
        $dsn = 'mysql:host=localhost;dbname=quali;charset=utf8mb4';
        $pdo = new PDO($dsn, 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        return $pdo;
    } catch (Exception $e) {
        error_log('Database connection error: ' . $e->getMessage());
        return null;
    }
}

/**
 * Create documents table if it doesn't exist
 */
function ensureDocumentsTable() {
    try {
        $db = getDocumentsDb();
        if (!$db) return false;
        
        $sql = "CREATE TABLE IF NOT EXISTS documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            document_number VARCHAR(50),
            title VARCHAR(255),
            process VARCHAR(100),
            version VARCHAR(20),
            status VARCHAR(50),
            file_name VARCHAR(255),
            file_path VARCHAR(500),
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            uploaded_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_document_number (document_number),
            INDEX idx_process (process),
            INDEX idx_status (status),
            INDEX idx_upload_date (upload_date)
        )";
        
        $db->exec($sql);
        return true;
    } catch (Exception $e) {
        error_log('Error creating documents table: ' . $e->getMessage());
        return false;
    }
}

/**
 * Insert a new document record
 */
function addDocument($data) {
    try {
        $db = getDocumentsDb();
        if (!$db) return ['success' => false, 'error' => 'Database connection failed'];
        
        ensureDocumentsTable();
        
        $sql = "INSERT INTO documents 
                (document_number, title, process, version, status, file_name, file_path, uploaded_by)
                VALUES 
                (:doc_number, :title, :process, :version, :status, :file_name, :file_path, :uploaded_by)";
        
        $stmt = $db->prepare($sql);
        $result = $stmt->execute([
            ':doc_number' => $data['document_number'] ?? null,
            ':title' => $data['title'] ?? '',
            ':process' => $data['process'] ?? '',
            ':version' => $data['version'] ?? '1.0',
            ':status' => $data['status'] ?? 'Draft',
            ':file_name' => $data['file_name'] ?? '',
            ':file_path' => $data['file_path'] ?? '',
            ':uploaded_by' => $data['uploaded_by'] ?? ''
        ]);
        
        if ($result) {
            return [
                'success' => true,
                'id' => $db->lastInsertId(),
                'message' => 'Document added successfully'
            ];
        }
        
        return ['success' => false, 'error' => 'Failed to insert document'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Get all documents or filtered documents
 */
function getDocuments($filters = []) {
    try {
        $db = getDocumentsDb();
        if (!$db) return ['success' => false, 'error' => 'Database connection failed'];
        
        ensureDocumentsTable();
        
        $sql = "SELECT * FROM documents WHERE 1=1";
        $params = [];
        
        if (!empty($filters['process'])) {
            $sql .= " AND process = :process";
            $params[':process'] = $filters['process'];
        }
        
        if (!empty($filters['status'])) {
            $sql .= " AND status = :status";
            $params[':status'] = $filters['status'];
        }
        
        if (!empty($filters['document_number'])) {
            $sql .= " AND document_number LIKE :doc_number";
            $params[':doc_number'] = '%' . $filters['document_number'] . '%';
        }
        
        if (!empty($filters['search'])) {
            $sql .= " AND (title LIKE :search OR document_number LIKE :search)";
            $params[':search'] = '%' . $filters['search'] . '%';
        }
        
        $sql .= " ORDER BY upload_date DESC LIMIT 1000";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $documents = $stmt->fetchAll();
        
        return [
            'success' => true,
            'documents' => $documents,
            'count' => count($documents)
        ];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Get a single document by ID
 */
function getDocumentById($id) {
    try {
        $db = getDocumentsDb();
        if (!$db) return ['success' => false, 'error' => 'Database connection failed'];
        
        $sql = "SELECT * FROM documents WHERE id = :id";
        $stmt = $db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $document = $stmt->fetch();
        
        if ($document) {
            return ['success' => true, 'document' => $document];
        }
        
        return ['success' => false, 'error' => 'Document not found'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Update a document record
 */
function updateDocument($id, $data) {
    try {
        $db = getDocumentsDb();
        if (!$db) return ['success' => false, 'error' => 'Database connection failed'];
        
        $updateFields = [];
        $params = [':id' => $id];
        
        foreach (['title', 'process', 'version', 'status', 'file_name', 'file_path', 'document_number'] as $field) {
            if (isset($data[$field])) {
                $updateFields[] = "$field = :$field";
                $params[":$field"] = $data[$field];
            }
        }
        
        if (empty($updateFields)) {
            return ['success' => false, 'error' => 'No fields to update'];
        }
        
        $sql = "UPDATE documents SET " . implode(', ', $updateFields) . " WHERE id = :id";
        $stmt = $db->prepare($sql);
        $result = $stmt->execute($params);
        
        if ($result) {
            return ['success' => true, 'message' => 'Document updated successfully'];
        }
        
        return ['success' => false, 'error' => 'Failed to update document'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Delete a document record
 */
function deleteDocument($id) {
    try {
        $db = getDocumentsDb();
        if (!$db) return ['success' => false, 'error' => 'Database connection failed'];
        
        $sql = "DELETE FROM documents WHERE id = :id";
        $stmt = $db->prepare($sql);
        $result = $stmt->execute([':id' => $id]);
        
        if ($result) {
            return ['success' => true, 'message' => 'Document deleted successfully'];
        }
        
        return ['success' => false, 'error' => 'Failed to delete document'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Get document statistics
 */
function getDocumentStats() {
    try {
        $db = getDocumentsDb();
        if (!$db) return ['success' => false, 'error' => 'Database connection failed'];
        
        $stats = [];
        
        // Total documents
        $stmt = $db->query("SELECT COUNT(*) as total FROM documents");
        $stats['total'] = $stmt->fetch()['total'];
        
        // By status
        $stmt = $db->query("SELECT status, COUNT(*) as count FROM documents GROUP BY status");
        $stats['byStatus'] = $stmt->fetchAll();
        
        // By process
        $stmt = $db->query("SELECT process, COUNT(*) as count FROM documents WHERE process != '' GROUP BY process");
        $stats['byProcess'] = $stmt->fetchAll();
        
        // Recent uploads (last 7 days)
        $stmt = $db->query("SELECT COUNT(*) as count FROM documents WHERE upload_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
        $stats['recentUploads'] = $stmt->fetch()['count'];
        
        return ['success' => true, 'stats' => $stats];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}
?>
