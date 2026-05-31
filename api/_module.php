<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const QUALI_MODULES = [
    'clients' => ['table' => 'clients', 'public' => 'client_ref'],
    'equipements' => ['table' => 'equipements', 'public' => 'code_interne'],
    'audits' => ['table' => 'audits', 'public' => 'audit_ref'],
    'non_conformites' => ['table' => 'non_conformites', 'public' => 'nc_ref', 'relations' => ['audit_ref', 'audit_id']],
    'diagnostic' => ['table' => 'diagnostic_iso', 'public' => 'diagnostic_ref'],
    'utilisateurs' => ['table' => 'utilisateurs', 'public' => 'email', 'relations' => ['personnel_ref']],
    'discussion' => ['table' => 'discussion_messages', 'public' => 'message_ref', 'relations' => ['from_email', 'to_email']],
    'parametres' => ['table' => 'parametres', 'public' => 'param_ref'],
    'risques' => ['table' => 'risques_api', 'public' => 'risque_ref'],
    'swot' => ['table' => 'swot', 'public' => 'swot_ref'],
    'satisfaction' => ['table' => 'satisfaction_client', 'public' => 'satisfaction_ref', 'relations' => ['client_ref']],
    'reclamations' => ['table' => 'reclamations_client', 'public' => 'reclamation_ref', 'relations' => ['client_ref']],
    'personnel' => ['table' => 'personnel', 'public' => 'personnel_ref', 'relations' => ['user_email']],
];

function quali_module_config(string $module): array
{
    if (!isset(QUALI_MODULES[$module])) quali_api_json_error('Module API inconnu.', 404);
    return QUALI_MODULES[$module];
}

function quali_module_input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) $data = $_POST;
    return is_array($data) ? $data : [];
}

function quali_module_identifiers(array $data, string $publicField): array
{
    $payload = $data['data'] ?? $data;
    if (!is_array($payload)) $payload = [];
    $publicId = (string) ($data[$publicField] ?? $payload[$publicField] ?? $data['ref'] ?? $payload['ref'] ?? $data['id'] ?? $payload['id'] ?? '');
    if ($publicId === '') $publicId = strtoupper($publicField) . '-' . date('YmdHis') . '-' . random_int(100, 999);
    $label = (string) ($data['label'] ?? $payload['label'] ?? $payload['name'] ?? $payload['title'] ?? $payload['ref'] ?? $publicId);
    return [$payload, $publicId, $label];
}

function quali_module_bootstrap(PDO $pdo, string $module): void
{
    $cfg = quali_module_config($module);
    $table = str_replace('`', '``', $cfg['table']);
    $public = str_replace('`', '``', $cfg['public']);
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$table}` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          `{$public}` VARCHAR(255) NOT NULL UNIQUE,
          label VARCHAR(255),
          data_json LONGTEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    foreach (($cfg['relations'] ?? []) as $relation) {
        $col = str_replace('`', '``', $relation);
        $exists = $pdo->prepare("SHOW COLUMNS FROM `{$table}` LIKE ?");
        $exists->execute([$col]);
        if (!$exists->fetch()) $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` VARCHAR(255) NULL, ADD INDEX (`{$col}`)");
    }
}

function quali_module_response(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

function quali_module_relation_values(array $payload, array $relations): array
{
    $values = [];
    foreach ($relations as $relation) {
        $camel = preg_replace_callback('/_([a-z])/', fn($m) => strtoupper($m[1]), $relation);
        $values[$relation] = (string) ($payload[$relation] ?? $payload[$camel] ?? '');
    }
    return $values;
}

function quali_module_save(string $module): void
{
    $pdo = quali_api_pdo();
    quali_module_bootstrap($pdo, $module);
    $cfg = quali_module_config($module);
    [$payload, $publicId, $label] = quali_module_identifiers(quali_module_input(), $cfg['public']);
    $relations = $cfg['relations'] ?? [];
    $relationValues = quali_module_relation_values($payload, $relations);
    $table = $cfg['table'];
    $public = $cfg['public'];
    $cols = array_merge([$public, 'label', 'data_json'], $relations);
    $params = [":{$public}", ':label', ':data_json'];
    $updates = ["label = VALUES(label)", "data_json = VALUES(data_json)"];
    foreach ($relations as $relation) {
        $params[] = ":{$relation}";
        $updates[] = "`{$relation}` = VALUES(`{$relation}`)";
    }
    $sql = "INSERT INTO `{$table}` (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', $params) . ") ON DUPLICATE KEY UPDATE " . implode(', ', $updates);
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(":{$public}", $publicId);
    $stmt->bindValue(':label', $label);
    $stmt->bindValue(':data_json', json_encode($payload, JSON_UNESCAPED_UNICODE));
    foreach ($relationValues as $relation => $value) $stmt->bindValue(":{$relation}", $value);
    $stmt->execute();
    quali_module_response(['message' => 'Enregistrement terminé.', 'id' => $publicId, 'data' => $payload]);
}

function quali_module_update(string $module): void
{
    quali_module_save($module);
}

function quali_module_get(string $module): void
{
    $pdo = quali_api_pdo();
    quali_module_bootstrap($pdo, $module);
    $cfg = quali_module_config($module);
    $table = $cfg['table'];
    $public = $cfg['public'];
    $q = trim((string) ($_GET['q'] ?? ''));
    $where = '';
    $params = [];
    if ($q !== '') {
        $where = "WHERE `{$public}` LIKE :q OR label LIKE :q OR data_json LIKE :q";
        $params[':q'] = '%' . $q . '%';
    }
    $stmt = $pdo->prepare("SELECT * FROM `{$table}` {$where} ORDER BY updated_at DESC, id DESC");
    $stmt->execute($params);
    $rows = array_map(function ($row) {
        $row['data'] = json_decode($row['data_json'] ?? '{}', true) ?: [];
        unset($row['data_json']);
        return $row;
    }, $stmt->fetchAll());
    quali_module_response(['items' => $rows]);
}

function quali_module_delete(string $module): void
{
    $pdo = quali_api_pdo();
    quali_module_bootstrap($pdo, $module);
    $cfg = quali_module_config($module);
    $data = quali_module_input();
    $id = (string) ($data[$cfg['public']] ?? $data['id'] ?? '');
    if ($id === '') quali_api_json_error('Identifiant manquant.', 422);
    $stmt = $pdo->prepare("DELETE FROM `{$cfg['table']}` WHERE `{$cfg['public']}` = ?");
    $stmt->execute([$id]);
    quali_module_response(['message' => 'Suppression terminée.', 'id' => $id]);
}
?>
