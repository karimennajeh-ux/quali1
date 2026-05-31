<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

function org_structure_paths(): array
{
    $statusFolders = ['01_Modeles', '02_En_cours', '03_En_vigueur', '04_Archives'];
    $typeFolders = ['Procedures', 'Instructions', 'Formulaires', 'Enregistrements'];
    $paths = [
        '00_Documents_generaux',
        'Templates',
        '00_Documents_generaux/Manuel_qualite',
        '00_Documents_generaux/Politique_qualite',
        '00_Documents_generaux/Modeles_documentaires',
    ];
    foreach (['Manuel_qualite', 'Politique_qualite'] as $generalType) {
        foreach ($statusFolders as $status) {
            $paths[] = "00_Documents_generaux/{$generalType}/{$status}";
        }
    }
    foreach (['01_Processus_pilotage', '02_Processus_operationnel', '03_Processus_support'] as $process) {
        $paths[] = $process;
        foreach ($typeFolders as $type) {
            $paths[] = "{$process}/{$type}";
            foreach ($statusFolders as $status) {
                $paths[] = "{$process}/{$type}/{$status}";
            }
        }
    }
    return $paths;
}

function create_template_docx(string $path, string $title): bool
{
    if (file_exists($path) || !class_exists('ZipArchive')) return false;
    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) return false;
    $xmlTitle = htmlspecialchars($title, ENT_QUOTES | ENT_XML1, 'UTF-8');
    $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' . $xmlTitle . '</w:t></w:r></w:p><w:p><w:r><w:t>Modele documentaire QUALI ISO 17025 a completer.</w:t></w:r></w:p></w:body></w:document>');
    $zip->close();
    return true;
}

$pdo = doc_pdo();
$input = doc_input();
$actor = trim((string) ($input['actorName'] ?? $input['acteur'] ?? 'Systeme')) ?: 'Systeme';
$root = doc_root();
if (!is_dir($root)) doc_error("Dossier documentaire introuvable : {$root}", 404);
$rootReal = realpath($root);
if (!$rootReal) doc_error('Dossier documentaire autorise introuvable.', 500);

$created = [];
$existing = [];
$registered = 0;
$selectStmt = $pdo->prepare("SELECT id FROM dossiers_documentaires WHERE chemin_dossier = ? LIMIT 1");
$insertStmt = $pdo->prepare("INSERT INTO dossiers_documentaires (nom_dossier, chemin_dossier, chemin_relatif, role_dossier, statut, actif) VALUES (?, ?, ?, ?, 'Actif', 1)");
$updateStmt = $pdo->prepare("UPDATE dossiers_documentaires SET nom_dossier = ?, chemin_relatif = ?, role_dossier = ?, statut = 'Actif', actif = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?");

foreach (org_structure_paths() as $relativeUnix) {
    $relative = str_replace('/', DIRECTORY_SEPARATOR, $relativeUnix);
    $path = $rootReal . DIRECTORY_SEPARATOR . $relative;
    if (is_dir($path)) {
        $existing[] = $relativeUnix;
    } elseif (!mkdir($path, 0775, true) && !is_dir($path)) {
        doc_error("Creation du dossier impossible : {$relativeUnix}", 500);
    } else {
        $created[] = $relativeUnix;
    }
    $real = realpath($path);
    if (!$real || !doc_path_is_inside_root($real . DIRECTORY_SEPARATOR . 'check.tmp', $rootReal)) {
        doc_error("Chemin refuse hors dossier autorise : {$relativeUnix}", 403);
    }
    $depth = substr_count($relativeUnix, '/');
    $role = $depth === 0 ? 'process' : ($depth === 1 ? 'type' : 'status');
    $relDb = str_replace(DIRECTORY_SEPARATOR, '\\', $relative);
    $selectStmt->execute([$real]);
    $folderId = (int) $selectStmt->fetchColumn();
    if ($folderId > 0) $updateStmt->execute([basename($real), $relDb, $role, $folderId]);
    else $insertStmt->execute([basename($real), $real, $relDb, $role]);
    $registered++;
}

$templateNames = [
    'Modele_Manuel_Qualite.docx' => 'Modele Manuel Qualite',
    'Modele_Politique_Qualite.docx' => 'Modele Politique Qualite',
    'Modele_Procedure.docx' => 'Modele Procedure',
    'Modele_Instruction.docx' => 'Modele Instruction',
    'Modele_Formulaire.docx' => 'Modele Formulaire',
    'Modele_Enregistrement.docx' => 'Modele Enregistrement',
];
$templatesCreated = 0;
foreach ($templateNames as $file => $title) {
    $path = $rootReal . DIRECTORY_SEPARATOR . 'Templates' . DIRECTORY_SEPARATOR . $file;
    if (!doc_path_is_inside_root($path, $rootReal)) doc_error('Chemin modele refuse.', 403);
    if (create_template_docx($path, $title)) $templatesCreated++;
}

doc_log($pdo, null, 'Initialisation organisation documentaire', count($created) . ' dossier(s) cree(s), ' . count($existing) . ' deja existant(s).', $actor);
doc_json([
    'summary' => [
        'createdCount' => count($created),
        'existingCount' => count($existing),
        'registeredCount' => $registered,
        'templatesCreated' => $templatesCreated,
    ],
    'created' => $created,
    'existing' => $existing,
]);
?>
