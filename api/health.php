<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/documentation/_documentation.php';

header('Content-Type: application/json; charset=utf-8');

$checks = [
    'apache' => [
        'ok' => true,
        'message' => 'PHP API accessible depuis Apache',
        'host' => $_SERVER['HTTP_HOST'] ?? '',
    ],
    'mysql' => [
        'ok' => false,
        'message' => '',
    ],
    'documentation_api' => [
        'ok' => false,
        'message' => '',
    ],
];

try {
    $pdo = quali_api_pdo();
    $pdo->query('SELECT 1');
    $checks['mysql'] = ['ok' => true, 'message' => 'MySQL quali_db accessible'];
} catch (Throwable $e) {
    $checks['mysql'] = ['ok' => false, 'message' => 'MySQL indisponible'];
}

try {
    $root = realpath(doc_root());
    $checks['documentation_api'] = [
        'ok' => $root !== false && is_dir($root),
        'message' => $root !== false && is_dir($root) ? 'Dossier Processus accessible sur le serveur' : 'Dossier Processus introuvable sur le serveur',
    ];
} catch (Throwable $e) {
    $checks['documentation_api'] = ['ok' => false, 'message' => 'API Documentation indisponible'];
}

$ok = array_reduce($checks, fn(bool $carry, array $item): bool => $carry && (bool) $item['ok'], true);
echo json_encode([
    'success' => $ok,
    'ok' => $ok,
    'application' => 'QUALI',
    'networkUrlExample' => 'http://IP-SERVEUR/QUALI/',
    'checks' => $checks,
], JSON_UNESCAPED_UNICODE);
?>
