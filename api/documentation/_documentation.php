<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';

const QUALI_DOCUMENT_ROOT = 'C:\\Users\\karim\\OneDrive\\Desktop\\projet fin d\'étude 2026\\Processus';
const QUALI_UPLOAD_ROOT = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'DMS' . DIRECTORY_SEPARATOR . 'uploads';
const QUALI_DOCUMENT_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg'];
const QUALI_LIFECYCLE_FOLDERS = ['Vérifier', 'Approuver', 'Diffuser', 'Utiliser', 'Réviser', 'Archiver', 'Supprimer'];

function doc_upload_root(): string
{
    $root = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, QUALI_UPLOAD_ROOT);
    if (!is_dir($root) && !mkdir($root, 0775, true) && !is_dir($root)) {
        doc_error('Le dossier de stockage des fichiers imports est inaccessible.', 500);
    }
    $real = realpath($root);
    if (!$real) {
        doc_error('Impossible de resoudre le dossier de stockage des fichiers.', 500);
    }
    return $real;
}

function doc_upload_category_folder(string $type): string
{
    $key = doc_key($type);
    if (str_contains($key, 'procedure')) {
        return 'Procedures';
    }
    if (str_contains($key, 'instruction') || str_contains($key, 'work')) {
        return 'WorkInstructions';
    }
    if (str_contains($key, 'formulaire') || str_contains($key, 'form')) {
        return 'Forms';
    }
    if (str_contains($key, 'enregistrement') || str_contains($key, 'record')) {
        return 'Records';
    }
    return 'Other';
}

function doc_upload_document_folder(string $documentNumber, string $type): string
{
    $root = doc_upload_root();
    $category = doc_upload_category_folder($type);
    $documentNumber = trim($documentNumber) !== '' ? preg_replace('/[^A-Za-z0-9_-]+/', '_', trim($documentNumber)) : 'DOC_000';
    $folder = $root . DIRECTORY_SEPARATOR . $category . DIRECTORY_SEPARATOR . $documentNumber;
    if (!is_dir($folder) && !mkdir($folder, 0775, true) && !is_dir($folder)) {
        doc_error('Impossible de creer le dossier du document.', 500);
    }
    $real = realpath($folder);
    if (!$real) {
        doc_error('Impossible de resoudre le dossier du document.', 500);
    }
    return $real;
}

function doc_upload_file_path(string $path): string
{
    $root = doc_upload_root();
    $real = realpath($path);
    if (!$real) {
        return $path;
    }
    if (str_starts_with($real, $root)) {
        return ltrim(str_replace($root, '', $real), DIRECTORY_SEPARATOR);
    }
    return $real;
}

function doc_upload_file_name(string $documentNumber, string $version, string $extension): string
{
    $base = preg_replace('/[^A-Za-z0-9_-]+/', '_', trim($documentNumber) ?: 'DOC');
    $ver = preg_replace('/[^A-Za-z0-9_.-]+/', '_', trim($version) ?: '1.0');
    return $base . '_V' . $ver . ($extension !== '' ? '.' . ltrim($extension, '.') : '');
}

function doc_pdo(): PDO
{
    $pdo = quali_api_pdo();
    doc_bootstrap($pdo);
    return $pdo;
}

function doc_bootstrap(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS dossiers_documentaires (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nom_dossier VARCHAR(255) NOT NULL,
          chemin_dossier TEXT NOT NULL,
          chemin_relatif TEXT,
          parent_id INT NULL,
          role_dossier VARCHAR(100) DEFAULT 'process',
          statut VARCHAR(100) DEFAULT 'Actif',
          actif TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX (parent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    doc_ensure_column($pdo, 'dossiers_documentaires', 'statut', "VARCHAR(100) DEFAULT 'Actif'");
    doc_ensure_column($pdo, 'dossiers_documentaires', 'actif', 'TINYINT(1) DEFAULT 1');

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          reference_documentaire VARCHAR(255) NOT NULL UNIQUE,
          document_number VARCHAR(50) DEFAULT NULL,
          titre_document VARCHAR(255) NOT NULL,
          nom_fichier VARCHAR(255) NOT NULL,
          extension VARCHAR(20),
          type_document VARCHAR(150),
          processus VARCHAR(255),
          version VARCHAR(50) DEFAULT '1.0',
          statut VARCHAR(100) DEFAULT 'Brouillon',
          statut_precedent VARCHAR(100) NULL,
          responsable_redacteur VARCHAR(255),
          verificateur VARCHAR(255),
          approbateur VARCHAR(255),
          diffuseur VARCHAR(255),
          chemin_fichier TEXT NOT NULL,
          chemin_relatif TEXT,
          file_path VARCHAR(500) DEFAULT NULL,
          file_storage_type VARCHAR(50) DEFAULT 'local_server',
          sharepoint_url VARCHAR(500) DEFAULT NULL,
          upload_date DATETIME NULL,
          uploaded_by VARCHAR(255) DEFAULT NULL,
          taille_fichier BIGINT DEFAULT 0,
          date_modification DATETIME NULL,
          stockage VARCHAR(100) DEFAULT 'Local',
          observation TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX (processus),
          INDEX (type_document),
          INDEX (statut)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    doc_ensure_column($pdo, 'documents', 'statut_precedent', 'VARCHAR(100) NULL');
    doc_ensure_column($pdo, 'documents', 'cycle_documentaire', "VARCHAR(100) NULL");
    doc_ensure_column($pdo, 'documents', 'dossier_processus', "VARCHAR(255) NULL");
    doc_ensure_column($pdo, 'documents', 'dossier_type', "VARCHAR(255) NULL");
    doc_ensure_column($pdo, 'documents', 'dossier_statut', "VARCHAR(255) NULL");
    doc_ensure_column($pdo, 'documents', 'version_parent_id', "INT NULL");
    doc_ensure_column($pdo, 'documents', 'est_version_active', "TINYINT(1) DEFAULT 1");
    doc_ensure_column($pdo, 'documents', 'date_creation_doc', "DATETIME NULL");
    doc_ensure_column($pdo, 'documents', 'date_verification', "DATETIME NULL");
    doc_ensure_column($pdo, 'documents', 'poste_verificateur', "VARCHAR(255) NULL");
    doc_ensure_column($pdo, 'documents', 'date_approbation', "DATETIME NULL");
    doc_ensure_column($pdo, 'documents', 'poste_approbateur', "VARCHAR(255) NULL");
    doc_ensure_column($pdo, 'documents', 'date_diffusion', "DATETIME NULL");
    doc_ensure_column($pdo, 'documents', 'date_archivage', "DATETIME NULL");
    doc_ensure_column($pdo, 'documents', 'motif_revision', "TEXT NULL");    doc_ensure_column($pdo, 'documents', 'document_number', "VARCHAR(50) DEFAULT NULL");
    doc_ensure_column($pdo, 'documents', 'file_path', "VARCHAR(500) DEFAULT NULL");
    doc_ensure_column($pdo, 'documents', 'file_storage_type', "VARCHAR(50) DEFAULT 'local_server'");
    doc_ensure_column($pdo, 'documents', 'sharepoint_url', "VARCHAR(500) DEFAULT NULL");
    doc_ensure_column($pdo, 'documents', 'upload_date', "DATETIME NULL");
    doc_ensure_column($pdo, 'documents', 'uploaded_by', "VARCHAR(255) DEFAULT NULL");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS document_versions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          document_id INT NOT NULL,
          ancienne_version VARCHAR(50),
          nouvelle_version VARCHAR(50),
          ancien_chemin TEXT,
          nouveau_chemin TEXT,
          motif_revision TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX (document_id),
          CONSTRAINT fk_document_versions_document
            FOREIGN KEY (document_id) REFERENCES documents(id)
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS journal_documentaire (
          id INT AUTO_INCREMENT PRIMARY KEY,
          document_id INT NULL,
          action VARCHAR(100) NOT NULL,
          acteur VARCHAR(255) DEFAULT 'Systeme',
          detail TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_journal_documentaire_document
            FOREIGN KEY (document_id) REFERENCES documents(id)
            ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    doc_ensure_column($pdo, 'journal_documentaire', 'ancien_statut', "VARCHAR(100) NULL");
    doc_ensure_column($pdo, 'journal_documentaire', 'nouveau_statut', "VARCHAR(100) NULL");
    doc_ensure_column($pdo, 'journal_documentaire', 'ancienne_version', "VARCHAR(50) NULL");
    doc_ensure_column($pdo, 'journal_documentaire', 'nouvelle_version', "VARCHAR(50) NULL");
    doc_ensure_column($pdo, 'journal_documentaire', 'observation', "TEXT NULL");
}

function doc_ensure_column(PDO $pdo, string $table, string $column, string $definition): void
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $column)) {
        return;
    }
    $dbName = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    ");
    $stmt->execute([$dbName, $table, $column]);
    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    }
}

function doc_archived_status(): string
{
    return 'Archivé';
}

function doc_archived_statuses(): array
{
    return [doc_archived_status(), 'Archive'];
}

function doc_hidden_statuses(): array
{
    return array_values(array_unique(array_merge(doc_archived_statuses(), ['Exclu', 'Fichier introuvable', 'Dossier introuvable'])));
}

function doc_is_hidden_status(string $status): bool
{
    return in_array(trim($status), doc_hidden_statuses(), true);
}

function doc_previous_status_candidate(string $status): ?string
{
    $status = trim($status);
    if ($status === '' || doc_is_hidden_status($status)) return null;
    return $status;
}

function doc_restore_status(?string $previous): string
{
    $status = trim((string) $previous);
    if ($status !== '' && !doc_is_hidden_status($status)) return $status;
    return 'Brouillon';
}

function doc_json(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

function doc_input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) $data = $_POST;
    return is_array($data) ? $data : [];
}

function doc_error(string $message, int $status = 500): void
{
    quali_api_json_error($message, $status);
}

function doc_root(): string
{
    return doc_upload_root();
}

function doc_normalize_path(string $path): string
{
    return str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
}

function doc_relative_path(string $path): string
{
    $root = realpath(doc_root()) ?: doc_root();
    $candidate = realpath($path) ?: $path;
    $rootNorm = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $root), DIRECTORY_SEPARATOR);
    $pathNorm = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $candidate);
    if (stripos($pathNorm, $rootNorm) === 0) {
        return ltrim(substr($pathNorm, strlen($rootNorm)), "\\/");
    }
    return basename($path);
}

function doc_process_from_relative(string $relative): string
{
    $parts = preg_split('/[\\\\\\/]+/', $relative);
    return $parts && $parts[0] !== '' ? $parts[0] : 'Processus';
}

function doc_lifecycle_folders(): array
{
    return QUALI_LIFECYCLE_FOLDERS;
}

function doc_lifecycle_folder_from_status(string $status): string
{
    $key = doc_key($status);
    if (str_contains($key, 'supprim') || str_contains($key, 'exclu') || str_contains($key, 'introuvable')) return 'Supprimer';
    if (str_contains($key, 'archiv') || str_contains($key, 'obsolete') || str_contains($key, 'remplace')) return 'Archiver';
    if (str_contains($key, 'revision') || str_contains($key, 'reviser') || str_contains($key, 'correction') || str_contains($key, 'corriger')) return 'Réviser';
    if (str_contains($key, 'vigueur') || str_contains($key, 'utilis') || $key === 'valide') return 'Utiliser';
    if (str_contains($key, 'diffus')) return 'Diffuser';
    if (str_contains($key, 'appro')) return 'Approuver';
    return 'Vérifier';
}

function doc_cycle_from_lifecycle_folder(string $folder): string
{
    return in_array($folder, doc_lifecycle_folders(), true) ? $folder : 'Vérifier';
}

function doc_ensure_lifecycle_folders(string $mainFolder): void
{
    $rootReal = realpath(doc_root());
    if (!$rootReal) doc_error('Dossier documentaire autorise introuvable.', 500);
    $mainFolder = trim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $mainFolder), DIRECTORY_SEPARATOR);
    if ($mainFolder === '' || str_contains($mainFolder, '..') || str_contains($mainFolder, "\0")) {
        doc_error('Dossier documentaire refuse.', 403);
    }
    $base = $rootReal . DIRECTORY_SEPARATOR . $mainFolder;
    if (!is_dir($base) && !mkdir($base, 0775, true) && !is_dir($base)) {
        doc_error('Creation du dossier documentaire impossible.', 500);
    }
    $baseReal = realpath($base);
    if (!$baseReal || !doc_path_is_inside_root($baseReal . DIRECTORY_SEPARATOR . 'check.tmp', $rootReal)) {
        doc_error('Chemin de dossier documentaire refuse.', 403);
    }
    foreach (doc_lifecycle_folders() as $folder) {
        $dir = $baseReal . DIRECTORY_SEPARATOR . $folder;
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            doc_error('Creation du dossier cycle documentaire impossible : ' . $folder, 500);
        }
    }
}

function doc_ensure_all_main_lifecycle_folders(): void
{
    $rootReal = realpath(doc_root());
    if (!$rootReal) doc_error('Dossier documentaire autorise introuvable.', 500);
    $entries = scandir($rootReal) ?: [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $path = $rootReal . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($path) && !in_array($entry, doc_lifecycle_folders(), true)) {
            doc_ensure_lifecycle_folders($entry);
        }
    }
}

function doc_key(string $value): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    return strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', ' ', $ascii)));
}

function doc_process_folder_name(string $processus): string
{
    $key = doc_key($processus);
    if (str_contains($key, 'manuel')) return 'manuel qualité';
    if (str_contains($key, 'politique')) return 'Politique qualité';
    if (str_contains($key, 'pilotage')) return 'Procesus Pilotage';
    if (str_contains($key, 'operationnel')) return 'Procesus Operationnel';
    if (str_contains($key, 'support')) return 'Procesus support';
    $clean = trim((string) preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/', '_', $processus));
    return $clean !== '' ? $clean : 'Procesus support';
}

function doc_type_folder_parts(string $type): array
{
    return [trim($type) !== '' ? trim($type) : 'Document'];
}

function doc_status_folder_name(string $type, string $status): string
{
    return doc_lifecycle_folder_from_status($status);
}

function doc_cycle_from_status_folder(string $folder): string
{
    return doc_cycle_from_lifecycle_folder($folder);
}

function doc_target_parts(string $processus, string $type, string $status): array
{
    $processFolder = doc_process_folder_name($processus);
    $typeParts = doc_type_folder_parts($type);
    $statusFolder = doc_status_folder_name($type, $status);
    if (str_contains(doc_key($type), 'manuel')) $processFolder = 'manuel qualité';
    if (str_contains(doc_key($type), 'politique')) $processFolder = 'Politique qualité';
    return [$processFolder, $typeParts[0], $statusFolder, doc_cycle_from_status_folder($statusFolder)];
}

function doc_target_directory(string $processus, string $type, string $status, bool $create = true): array
{
    [$processFolder, $typeFolder, $statusFolder, $cycle] = doc_target_parts($processus, $type, $status);
    $rootReal = realpath(doc_root());
    if (!$rootReal) doc_error('Dossier documentaire autorise introuvable.', 500);
    doc_ensure_lifecycle_folders($processFolder);
    $dir = $rootReal . DIRECTORY_SEPARATOR . $processFolder . DIRECTORY_SEPARATOR . $statusFolder;
    if ($create && !is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        doc_error('Creation du dossier documentaire impossible.', 500);
    }
    $dirReal = realpath($dir);
    if (!$dirReal || !doc_path_is_inside_root($dirReal . DIRECTORY_SEPARATOR . 'check.tmp', $rootReal)) {
        doc_error('Chemin de destination refuse.', 403);
    }
    return [$dirReal, $processFolder, $typeFolder, $statusFolder, $cycle];
}

function doc_unique_path(string $dir, string $fileName, string $currentReal = ''): string
{
    $base = pathinfo($fileName, PATHINFO_FILENAME);
    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    for ($i = 0; $i < 1000; $i++) {
        $suffix = $i === 0 ? '' : '_' . $i;
        $candidate = $dir . DIRECTORY_SEPARATOR . $base . $suffix . ($ext !== '' ? '.' . $ext : '');
        if (!file_exists($candidate)) return $candidate;
        $candidateReal = realpath($candidate);
        if ($currentReal !== '' && $candidateReal && strcasecmp($candidateReal, $currentReal) === 0) return $candidateReal;
    }
    doc_error('Impossible de trouver un nom de fichier disponible.', 500);
}

function doc_relocate_document_file(PDO $pdo, array $doc, string $processus, string $type, string $status): array
{
    $currentPath = (string) ($doc['chemin_fichier'] ?? '');
    $currentReal = $currentPath !== '' ? realpath($currentPath) : false;
    [$targetDir, $processFolder, $typeFolder, $statusFolder, $cycle] = doc_target_directory($processus, $type, $status, true);
    if (!$currentReal || !is_file($currentReal)) {
        return [null, null, $processFolder, $typeFolder, $statusFolder, $cycle];
    }
    $rootReal = realpath(doc_root());
    if (!$rootReal || !doc_path_is_inside_root($currentReal, $rootReal)) {
        doc_error('Deplacement refuse : fichier hors du dossier documentaire autorise.', 403);
    }
    $targetPath = doc_unique_path($targetDir, basename($currentReal), $currentReal);
    $targetReal = realpath($targetPath);
    if (!$targetReal || strcasecmp($targetReal, $currentReal) !== 0) {
        if (!rename($currentReal, $targetPath)) {
            doc_error('Deplacement du fichier vers le cycle documentaire impossible.', 500);
        }
        $targetReal = realpath($targetPath);
    }
    if (!$targetReal || !doc_path_is_inside_root($targetReal, $rootReal)) {
        doc_error('Chemin de destination refuse.', 403);
    }
    return [$targetReal, doc_relative_path($targetReal), $processFolder, $typeFolder, $statusFolder, $cycle];
}

function doc_type_from_name(string $fileName, string $extension): string
{
    $name = mb_strtolower($fileName, 'UTF-8');
    if (str_contains($name, 'manuel')) return 'Manuel qualité';
    if (str_contains($name, 'politique')) return 'Politique Qualité';
    if (str_contains($name, 'procedure') || str_contains($name, 'procédure') || str_starts_with($name, 'pro')) return 'Procedure';
    if (str_contains($name, 'instruction') || str_starts_with($name, 'ins')) return 'Instruction';
    if (str_contains($name, 'formulaire') || str_starts_with($name, 'for')) return 'Formulaire';
    if (str_contains($name, 'enregistrement') || str_starts_with($name, 'enr')) return 'Enregistrement';
    if (in_array($extension, ['xls', 'xlsx'], true)) return 'Enregistrement';
    if (in_array($extension, ['png', 'jpg', 'jpeg'], true)) return 'Image';
    return 'Document';
}

function doc_ref_from_file(string $relative): string
{
    $base = preg_replace('/\.[^.]+$/', '', $relative);
    $ref = strtoupper(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $base) ?: $base);
    $ref = preg_replace('/[^A-Z0-9]+/', '-', $ref);
    $ref = trim((string) $ref, '-');
    $prefix = substr($ref ?: 'DOC', 0, 90);
    return $prefix . '-' . strtoupper(substr(sha1($relative), 0, 10));
}

function doc_log(PDO $pdo, ?int $documentId, string $action, string $detail = '', string $actor = 'Systeme'): void
{
    $stmt = $pdo->prepare("INSERT INTO journal_documentaire (document_id, action, acteur, detail) VALUES (?, ?, ?, ?)");
    $stmt->execute([$documentId, $action, $actor, $detail]);
}

function doc_log_activity(PDO $pdo, ?int $documentId, string $action, array $meta = [], string $actor = 'Systeme'): void
{
    $stmt = $pdo->prepare("
        INSERT INTO journal_documentaire
          (document_id, action, acteur, detail, ancien_statut, nouveau_statut, ancienne_version, nouvelle_version, observation)
        VALUES
          (:document_id, :action, :acteur, :detail, :ancien_statut, :nouveau_statut, :ancienne_version, :nouvelle_version, :observation)
    ");
    $stmt->execute([
        ':document_id' => $documentId,
        ':action' => $action,
        ':acteur' => $actor,
        ':detail' => (string) ($meta['detail'] ?? ''),
        ':ancien_statut' => $meta['ancien_statut'] ?? null,
        ':nouveau_statut' => $meta['nouveau_statut'] ?? null,
        ':ancienne_version' => $meta['ancienne_version'] ?? null,
        ':nouvelle_version' => $meta['nouvelle_version'] ?? null,
        ':observation' => $meta['observation'] ?? null,
    ]);
}

function doc_fetch(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) doc_error('Document introuvable.', 404);
    return $doc;
}

function doc_update_lifecycle_status(PDO $pdo, array $doc, string $nextStatus, string $action, string $detail, string $actor = 'Systeme'): array
{
    $id = (int) $doc['id'];
    $current = trim((string) ($doc['statut'] ?? ''));
    $storedPrevious = trim((string) ($doc['statut_precedent'] ?? ''));
    $previous = doc_previous_status_candidate($current) ?? ($storedPrevious !== '' ? $storedPrevious : null);
    $processus = trim((string) ($doc['processus'] ?? 'Processus support'));
    $type = trim((string) ($doc['type_document'] ?? 'Document'));
    [$movedPath, $movedRelative, $processFolder, $typeFolder, $statusFolder, $cycle] = doc_relocate_document_file($pdo, $doc, $processus, $type, $nextStatus);

    if (doc_is_hidden_status($nextStatus)) {
        $stmt = $pdo->prepare("
            UPDATE documents
            SET statut = ?, statut_precedent = ?, cycle_documentaire = ?, dossier_processus = ?,
                dossier_type = ?, dossier_statut = ?,
                chemin_fichier = COALESCE(?, chemin_fichier), chemin_relatif = COALESCE(?, chemin_relatif),
                file_path = COALESCE(?, file_path), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$nextStatus, $previous, $cycle, $processFolder, $typeFolder, $statusFolder, $movedPath, $movedRelative, $movedRelative, $id]);
    } else {
        $stmt = $pdo->prepare("
            UPDATE documents
            SET statut = ?, statut_precedent = NULL, cycle_documentaire = ?, dossier_processus = ?,
                dossier_type = ?, dossier_statut = ?,
                chemin_fichier = COALESCE(?, chemin_fichier), chemin_relatif = COALESCE(?, chemin_relatif),
                file_path = COALESCE(?, file_path), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([$nextStatus, $cycle, $processFolder, $typeFolder, $statusFolder, $movedPath, $movedRelative, $movedRelative, $id]);
    }

    doc_log($pdo, $id, $action, $detail ?: (($doc['reference_documentaire'] ?? '') . ' : ' . $current . ' -> ' . $nextStatus), $actor);
    return doc_fetch($pdo, $id);
}

function doc_delete_application(PDO $pdo, array $doc, string $actor = 'Systeme'): void
{
    $id = (int) $doc['id'];
    doc_log($pdo, $id, "Supprimer de l'application", 'Fiche MySQL supprimee uniquement. Fichier Windows conserve : ' . ($doc['chemin_fichier'] ?? ''), $actor);
    $stmt = $pdo->prepare("DELETE FROM documents WHERE id = ?");
    $stmt->execute([$id]);
}

function doc_path_is_inside_root(string $fileReal, string $rootReal): bool
{
    $rootCheck = rtrim(strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $rootReal)), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    $fileCheck = strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $fileReal));
    return strpos($fileCheck, $rootCheck) === 0;
}

function doc_delete_permanent(PDO $pdo, array $doc, string $actor = 'Systeme'): bool
{
    $path = (string) ($doc['chemin_fichier'] ?? '');
    if ($path !== '' && is_dir($path)) {
        doc_error('Suppression refusee : le chemin pointe vers un dossier.', 403);
    }

    $rootReal = realpath(doc_root());
    if (!$rootReal) {
        doc_error('Dossier documentaire autorise introuvable.', 500);
    }

    $fileDeleted = false;
    $fileReal = $path !== '' ? realpath($path) : false;
    if ($fileReal !== false) {
        if (!is_file($fileReal)) {
            doc_error('Suppression refusee : seul un fichier peut etre supprime.', 403);
        }
        if (!doc_path_is_inside_root($fileReal, $rootReal)) {
            doc_error('Suppression refusee : le fichier est hors du dossier documentaire autorise.', 403);
        }
        if (!unlink($fileReal)) {
            doc_error('Suppression du fichier Windows impossible.', 500);
        }
        $fileDeleted = true;
    } elseif ((string) ($doc['statut'] ?? '') !== 'Fichier introuvable') {
        doc_error("Suppression definitive refusee : le fichier Windows est introuvable. Utilisez la suppression de l'application si vous voulez seulement retirer la fiche.", 404);
    }

    $id = (int) $doc['id'];
    $detail = ($fileDeleted ? 'Fichier Windows supprime definitivement : ' : 'Fichier Windows deja introuvable : ') . $path;
    doc_log($pdo, $id, 'Supprimer définitivement', $detail, $actor);
    $stmt = $pdo->prepare("DELETE FROM documents WHERE id = ?");
    $stmt->execute([$id]);
    return $fileDeleted;
}

function doc_item(array $row): array
{
    $id = (int) $row['id'];
    $ext = strtolower((string) ($row['extension'] ?? ''));
    return [
        'id' => $id,
        'ref' => $row['reference_documentaire'] ?? '',
        'documentNumber' => $row['document_number'] ?? $row['reference_documentaire'] ?? '',
        'title' => $row['titre_document'] ?? '',
        'fileName' => $row['nom_fichier'] ?? '',
        'fileExt' => $ext,
        'docType' => $row['type_document'] ?? '',
        'processName' => $row['processus'] ?? '',
        'versionLabel' => $row['version'] ?? '',
        'status' => $row['statut'] ?? '',
        'previousStatus' => $row['statut_precedent'] ?? '',
        'isHiddenStatus' => doc_is_hidden_status((string) ($row['statut'] ?? '')),
        'ownerName' => $row['responsable_redacteur'] ?? '',
        'verifierName' => $row['verificateur'] ?? '',
        'verifierRole' => $row['poste_verificateur'] ?? '',
        'approverName' => $row['approbateur'] ?? '',
        'approverRole' => $row['poste_approbateur'] ?? '',
        'diffuserName' => $row['diffuseur'] ?? '',
        'absPath' => '',
        'relPath' => $row['chemin_relatif'] ?? '',
        'fileSize' => (int) ($row['taille_fichier'] ?? 0),
        'modifiedAt' => $row['date_modification'] ?? '',
        'storage' => $row['stockage'] ?? 'Local',
        'filePath' => $row['file_path'] ?? $row['chemin_relatif'] ?? '',
        'fileStorageType' => $row['file_storage_type'] ?? 'local_server',
        'sharepointUrl' => $row['sharepoint_url'] ?? '',
        'uploadDate' => $row['upload_date'] ?? $row['created_at'] ?? '',
        'uploadedBy' => $row['uploaded_by'] ?? $row['responsable_redacteur'] ?? '',
        'notes' => $row['observation'] ?? '',
        'cycleDocumentaire' => $row['cycle_documentaire'] ?? '',
        'processFolder' => $row['dossier_processus'] ?? '',
        'typeFolder' => $row['dossier_type'] ?? '',
        'statusFolder' => $row['dossier_statut'] ?? '',
        'versionParentId' => isset($row['version_parent_id']) ? (int) $row['version_parent_id'] : null,
        'isActiveVersion' => isset($row['est_version_active']) ? (int) $row['est_version_active'] : 1,
        'createdDocAt' => $row['date_creation_doc'] ?? '',
        'verifiedAt' => $row['date_verification'] ?? '',
        'approvedAt' => $row['date_approbation'] ?? '',
        'diffusedAt' => $row['date_diffusion'] ?? '',
        'archivedAt' => $row['date_archivage'] ?? '',
        'revisionReason' => $row['motif_revision'] ?? '',
        'webUrl' => 'api/documentation/open_document.php?id=' . $id,
        'createdAt' => $row['created_at'] ?? '',
        'updatedAt' => $row['updated_at'] ?? '',
    ];
}

function doc_mime(string $extension): string
{
    return [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ][$extension] ?? 'application/octet-stream';
}
?>
