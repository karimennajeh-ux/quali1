<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
doc_ensure_all_main_lifecycle_folders();
$q = trim((string) ($_GET['q'] ?? ''));
$processus = trim((string) ($_GET['processus'] ?? ''));
$type = trim((string) ($_GET['type_document'] ?? $_GET['type'] ?? ''));
$cycle = trim((string) ($_GET['cycle_documentaire'] ?? ''));
$statut = trim((string) ($_GET['statut'] ?? ''));
$letter = trim((string) ($_GET['letter'] ?? ''));
$dossier = trim((string) ($_GET['dossier'] ?? ''));
$sort = trim((string) ($_GET['sort'] ?? 'updated_desc'));
$version = trim((string) ($_GET['version'] ?? ''));
$redacteur = trim((string) ($_GET['redacteur'] ?? $_GET['responsable_redacteur'] ?? ''));
$cleanup = filter_var($_GET['cleanup'] ?? false, FILTER_VALIDATE_BOOLEAN);
$includeHidden = filter_var($_GET['include_hidden'] ?? false, FILTER_VALIDATE_BOOLEAN);
$includeArchives = filter_var($_GET['include_archives'] ?? $_GET['show_archives'] ?? false, FILTER_VALIDATE_BOOLEAN);

$where = [];
$params = [];
if ($q !== '') {
    $where[] = "(titre_document LIKE :q OR reference_documentaire LIKE :q OR nom_fichier LIKE :q OR chemin_relatif LIKE :q OR observation LIKE :q OR responsable_redacteur LIKE :q)";
    $params[':q'] = "%{$q}%";
}
if ($processus !== '' && $processus !== 'all') {
    if ($processus === 'Documents gÃ©nÃ©raux' || $processus === 'Documents generaux') {
        $where[] = "(processus LIKE :processus_general OR chemin_relatif LIKE :processus_general_path OR type_document IN ('Manuel qualitÃ©', 'Manuel qualite', 'Politique qualitÃ©', 'Politique QualitÃ©', 'Politique qualite'))";
        $params[':processus_general'] = '%Documents%';
        $params[':processus_general_path'] = '00_Documents_generaux%';
    } else {
        $where[] = "processus IN (:processus, :processus_alt)";
        $params[':processus'] = $processus;
        $params[':processus_alt'] = str_replace(['opÃ©rationnel', 'gÃ©nÃ©raux'], ['operationnel', 'generaux'], $processus);
    }
}
if ($type !== '' && $type !== 'all') {
    if ($type === 'Autre') {
        $where[] = "(type_document IS NULL OR type_document NOT IN ('Manuel qualitÃ©','Manuel qualite','Politique qualitÃ©','Politique QualitÃ©','Politique qualite','ProcÃ©dure','Procedure','Instruction','Formulaire','Enregistrement','Rapport','Image'))";
    } elseif ($type === 'ProcÃ©dure') {
        $where[] = "type_document IN ('ProcÃ©dure', 'Procedure')";
    } elseif ($type === 'Manuel qualitÃ©') {
        $where[] = "type_document IN ('Manuel qualitÃ©', 'Manuel qualite')";
    } elseif ($type === 'Politique qualitÃ©') {
        $where[] = "type_document IN ('Politique qualitÃ©', 'Politique QualitÃ©', 'Politique qualite')";
    } else {
        $where[] = "type_document = :type";
        $params[':type'] = $type;
    }
}
if ($cycle !== '' && $cycle !== 'all') {
    if ($cycle === 'ModÃ¨les' || $cycle === 'Modeles') {
        $where[] = "(cycle_documentaire IN ('ModÃ¨les', 'Modeles', 'ModÃ¨le', 'Modele') OR dossier_statut = '01_Modeles')";
    } elseif ($cycle === 'Archives') {
        $where[] = "(cycle_documentaire IN ('Archives', 'Archive') OR dossier_statut = '04_Archives')";
    } else {
        $where[] = "cycle_documentaire = :cycle";
        $params[':cycle'] = $cycle;
    }
}
if ($letter !== '' && $letter !== 'all') {
    if ($letter === '0-9') {
        $where[] = "(titre_document REGEXP '^[0-9]' OR nom_fichier REGEXP '^[0-9]')";
    } elseif (preg_match('/^[A-Za-z]$/', $letter)) {
        $where[] = "(titre_document LIKE :letter OR nom_fichier LIKE :letter)";
        $params[':letter'] = strtoupper($letter) . '%';
    }
}
if ($dossier !== '' && $dossier !== 'all') {
    $where[] = "chemin_relatif LIKE :dossier";
    $params[':dossier'] = str_replace('/', '\\', $dossier) . '%';
}
if ($version !== '') {
    $where[] = "version LIKE :version";
    $params[':version'] = "%{$version}%";
}
if ($redacteur !== '') {
    $where[] = "responsable_redacteur LIKE :redacteur";
    $params[':redacteur'] = "%{$redacteur}%";
}
if (!$includeHidden && !$includeArchives) {
    $where[] = "(est_version_active IS NULL OR est_version_active = 1)";
}
if ($cleanup) {
    $where[] = "statut = :cleanup_missing";
    $params[':cleanup_missing'] = 'Fichier introuvable';
} elseif ($statut !== '' && $statut !== 'all') {
    if (in_array($statut, doc_archived_statuses(), true) || $statut === 'ArchivÃ©') {
        $where[] = "statut IN (:statut_archive_1, :statut_archive_2)";
        $params[':statut_archive_1'] = 'ArchivÃ©';
        $params[':statut_archive_2'] = 'Archive';
    } elseif ($statut === 'ApprouvÃ©') {
        $where[] = "statut IN ('ApprouvÃ©', 'Approuve')";
    } elseif ($statut === 'DiffusÃ©') {
        $where[] = "statut IN ('DiffusÃ©', 'Diffuse')";
    } else {
        $where[] = "statut = :statut";
        $params[':statut'] = $statut;
    }
} elseif (!$includeHidden && !$includeArchives) {
    $hiddenParams = [];
    foreach (doc_hidden_statuses() as $index => $hiddenStatus) {
        $key = ':hidden_' . $index;
        $hiddenParams[] = $key;
        $params[$key] = $hiddenStatus;
    }
    $where[] = "(statut IS NULL OR statut NOT IN (" . implode(', ', $hiddenParams) . "))";
} elseif (!$includeHidden && $includeArchives) {
    $where[] = "(statut IS NULL OR statut NOT IN ('Exclu', 'Fichier introuvable', 'Dossier introuvable'))";
}

$orderBy = match ($sort) {
    'title_asc' => 'titre_document ASC, id DESC',
    'ref_asc' => 'reference_documentaire ASC, id DESC',
    'version_desc' => 'version DESC, updated_at DESC, id DESC',
    'status_asc' => 'statut ASC, updated_at DESC, id DESC',
    default => 'updated_at DESC, id DESC',
};
$sql = "SELECT * FROM documents" . ($where ? " WHERE " . implode(" AND ", $where) : "") . " ORDER BY {$orderBy}";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$items = array_map('doc_item', $stmt->fetchAll());

$counts = ['active' => 0, 'archived' => 0, 'excluded' => 0, 'missing' => 0, 'folderMissing' => 0, 'total' => 0];
$countRows = $pdo->query("SELECT statut, COUNT(*) total FROM documents GROUP BY statut")->fetchAll();
foreach ($countRows as $row) {
    $status = (string) ($row['statut'] ?? '');
    $total = (int) ($row['total'] ?? 0);
    $counts['total'] += $total;
    if (in_array($status, doc_archived_statuses(), true)) $counts['archived'] += $total;
    elseif ($status === 'Exclu') $counts['excluded'] += $total;
    elseif ($status === 'Fichier introuvable') $counts['missing'] += $total;
    else $counts['active'] += $total;
}

$folderWhere = "";
if ($cleanup || $statut === 'Dossier introuvable') {
    $folderWhere = "WHERE statut = 'Dossier introuvable' OR actif = 0";
} elseif (!$includeHidden) {
    $folderWhere = "WHERE (statut IS NULL OR statut <> 'Dossier introuvable') AND (actif IS NULL OR actif = 1)";
}
$folders = $pdo->query("SELECT id, nom_dossier label, '' absPath, chemin_relatif relPath, role_dossier role, statut status, actif active, 0 depth FROM dossiers_documentaires {$folderWhere} ORDER BY chemin_relatif")->fetchAll();
$counts['folderMissing'] = (int) $pdo->query("SELECT COUNT(*) FROM dossiers_documentaires WHERE statut = 'Dossier introuvable' OR actif = 0")->fetchColumn();
$events = $pdo->query("
    SELECT j.id, j.document_id documentId, j.action eventType, j.action eventLabel, j.acteur actorName, j.detail eventDetail,
           j.ancien_statut oldStatus, j.nouveau_statut newStatus, j.ancienne_version oldVersion,
           j.nouvelle_version newVersion, j.observation observation,
           j.created_at createdAt, d.reference_documentaire ref, d.titre_document title
    FROM journal_documentaire j
    LEFT JOIN documents d ON d.id = j.document_id
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT 80
")->fetchAll();

doc_json([
    'items' => $items,
    'counts' => $counts,
    'statusOptions' => array_values(array_unique(array_merge(['Brouillon', 'En revue', 'En vérification', 'En approbation', 'A corriger', 'En correction', 'En révision', 'Approuvé', 'Diffusé', 'En vigueur'], doc_hidden_statuses()))),
    'folders' => $folders,
    'events' => $events,
    'server' => ['root' => doc_root()],
    'settings' => ['pilotRoot' => doc_root(), 'archivesRoot' => 'Archiver', 'trashRoot' => 'Supprimer', 'lifecycleFolders' => doc_lifecycle_folders(), 'hierarchy' => ['processFolders' => array_values(array_unique(array_filter(array_column($items, 'processName'))))]],
]);
?>
