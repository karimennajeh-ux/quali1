<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

function word_xml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function word_slug(string $value, string $fallback = 'document'): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    $clean = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/', '', $ascii);
    $clean = preg_replace('/\s+/', '_', (string) $clean);
    $clean = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) $clean);
    $clean = trim((string) $clean, '._-');
    return $clean !== '' ? $clean : $fallback;
}

function word_file_version(string $version): string
{
    $clean = preg_replace('/^v/i', '', trim($version));
    return 'V' . word_slug($clean !== '' ? $clean : '1.0', '1.0');
}

function word_process_folder(string $processus): string
{
    $key = mb_strtolower(trim($processus), 'UTF-8');
    if (str_contains($key, 'pilotage')) return 'Processus pilotage';
    if (str_contains($key, 'opérationnel') || str_contains($key, 'opérationnel')) return 'Processus opérationnel';
    if (str_contains($key, 'support')) return 'Processus support';
    return trim($processus) !== '' ? trim($processus) : 'Processus support';
}

function word_unique_path(string $dir, string $fileName): string
{
    $path = $dir . DIRECTORY_SEPARATOR . $fileName;
    if (!file_exists($path)) return $path;
    $base = pathinfo($fileName, PATHINFO_FILENAME);
    $ext = pathinfo($fileName, PATHINFO_EXTENSION);
    for ($i = 2; $i < 1000; $i++) {
        $candidate = $dir . DIRECTORY_SEPARATOR . $base . '_' . $i . ($ext ? '.' . $ext : '');
        if (!file_exists($candidate)) return $candidate;
    }
    doc_error('Impossible de trouver un nom de fichier disponible.', 500);
}

function word_p(string $text, string $style = ''): string
{
    $styleXml = $style !== '' ? '<w:pPr><w:pStyle w:val="' . word_xml($style) . '"/></w:pPr>' : '';
    return '<w:p>' . $styleXml . '<w:r><w:t xml:space="preserve">' . word_xml($text) . '</w:t></w:r></w:p>';
}

function word_table(array $rows): string
{
    $xml = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="B8C6D9"/><w:left w:val="single" w:sz="6" w:space="0" w:color="B8C6D9"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="B8C6D9"/><w:right w:val="single" w:sz="6" w:space="0" w:color="B8C6D9"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="B8C6D9"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="B8C6D9"/></w:tblBorders></w:tblPr>';
    foreach ($rows as $row) {
        $xml .= '<w:tr>';
        foreach ($row as $cell) {
            $xml .= '<w:tc><w:tcPr><w:tcW w:w="2600" w:type="dxa"/></w:tcPr>' . word_p((string) $cell) . '</w:tc>';
        }
        $xml .= '</w:tr>';
    }
    return $xml . '</w:tbl>';
}

function word_sections(string $type): array
{
    $key = mb_strtolower(trim($type), 'UTF-8');
    if (str_contains($key, 'instruction')) {
        return ['1. Objet', '2. Matériel / moyens nécessaires', '3. Méthode de réalisation', "4. Critères d'acceptation", '5. Enregistrements associés'];
    }
    if (str_contains($key, 'formulaire')) {
        return ['Identification du formulaire', 'Zones à remplir', 'Date', 'Responsable', 'Visa / signature'];
    }
    if (str_contains($key, 'enregistrement')) {
        return ["Identification de l'enregistrement", 'Date', 'Responsable', 'Données enregistrées', 'Visa / signature'];
    }
    return ['1. Objet', "2. Domaine d'application", '3. Références', '4. Responsabilités', '5. Description de la procédure', '6. Documents associés', '7. Historique des modifications'];
}

function word_document_xml(array $data): string
{
    $created = date('Y-m-d');
    $xml = word_table([
        ['QUALI by ENNAJEH', $data['titre_document']],
        ['Référence', $data['reference_documentaire']],
        ['Version', $data['version']],
        ['Processus', $data['processus']],
        ['Type documentaire', $data['type_document']],
        ['Statut', $data['statut']],
        ['Rédacteur', $data['responsable_redacteur']],
        ['Vérificateur', $data['verificateur']],
        ['Approbateur', $data['approbateur']],
        ['Date de création', $created],
    ]);
    $xml .= word_p('');
    $xml .= word_p($data['titre_document'], 'Title');
    $xml .= word_p("Objectif / domaine d'application : " . ($data['objectif'] ?: '-'));
    $xml .= word_p('Contenu principal / résumé : ' . ($data['contenu'] ?: '-'));
    $xml .= word_p('Diffuseur : ' . ($data['diffuseur'] ?: '-'));
    $xml .= word_p('Diffusion services / personnes : ' . ($data['diffusion'] ?: '-'));
    $xml .= word_p('Observation : ' . ($data['observation'] ?: '-'));

    foreach (word_sections($data['type_document']) as $section) {
        $xml .= word_p($section, 'Heading1');
        if (str_contains($section, 'Historique')) {
            $xml .= word_table([['Version', 'Date', 'Modification', 'Auteur'], [$data['version'], $created, 'Création du document', $data['responsable_redacteur'] ?: '-']]);
        } elseif (str_contains($section, 'Zones') || str_contains($section, 'Données')) {
            $xml .= word_table([['Champ', 'Information'], ['', ''], ['', ''], ['', '']]);
        } elseif (str_contains($section, 'Visa')) {
            $xml .= word_table([['Rédacteur', 'Vérificateur', 'Approbateur'], ['', '', '']]);
        } else {
            $xml .= word_p($data['contenu'] ?: 'A compléter.');
        }
    }

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        . '<w:body>' . $xml . '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>';
}

function word_create_docx(string $path, array $data): void
{
    if (!class_exists('ZipArchive')) doc_error('Extension PHP ZipArchive indisponible pour générer le document Word.', 500);
    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        doc_error('Création du fichier Word impossible.', 500);
    }
    $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
    $zip->addFromString('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
    $zip->addFromString('word/document.xml', word_document_xml($data));
    $zip->addFromString('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' . word_xml($data['titre_document']) . '</dc:title><dc:creator>' . word_xml($data['responsable_redacteur'] ?: 'QUALI') . '</dc:creator><cp:lastModifiedBy>QUALI</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' . date('c') . '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' . date('c') . '</dcterms:modified></cp:coreProperties>');
    $zip->addFromString('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>QUALI</Application></Properties>');
    $zip->close();
}

$pdo = doc_pdo();
$input = doc_input();
$data = [
    'titre_document' => trim((string) ($input['titre_document'] ?? $input['title'] ?? '')),
    'reference_documentaire' => trim((string) ($input['reference_documentaire'] ?? $input['ref'] ?? '')),
    'processus' => trim((string) ($input['processus'] ?? $input['processName'] ?? 'Processus support')),
    'type_document' => trim((string) ($input['type_document'] ?? $input['docType'] ?? 'Procedure')),
    'version' => trim((string) ($input['version'] ?? '1.0')),
    'statut' => trim((string) ($input['statut'] ?? 'Brouillon')),
    'responsable_redacteur' => trim((string) ($input['responsable_redacteur'] ?? '')),
    'verificateur' => trim((string) ($input['verificateur'] ?? '')),
    'poste_verificateur' => trim((string) ($input['poste_verificateur'] ?? $input['verifierRole'] ?? '')),
    'approbateur' => trim((string) ($input['approbateur'] ?? '')),
    'poste_approbateur' => trim((string) ($input['poste_approbateur'] ?? $input['approverRole'] ?? '')),
    'diffuseur' => trim((string) ($input['diffuseur'] ?? '')),
    'diffusion' => trim((string) ($input['diffusion'] ?? '')),
    'objectif' => trim((string) ($input['objectif'] ?? '')),
    'contenu' => trim((string) ($input['contenu'] ?? '')),
    'observation' => trim((string) ($input['observation'] ?? '')),
];
if ($data['titre_document'] === '' || $data['reference_documentaire'] === '') doc_error('Titre et référence documentaire obligatoires.', 422);
if ($data['statut'] === '') $data['statut'] = 'Brouillon';
if ($data['version'] === '') $data['version'] = '1.0';

$rootReal = realpath(doc_root());
if (!$rootReal) doc_error('Dossier documentaire autorisé introuvable.', 500);

[$targetReal, $processFolder, $typeFolder, $statusFolder, $cycle] = doc_target_directory($data['processus'], $data['type_document'], $data['statut'], true);

$fileName = word_slug($data['reference_documentaire'], 'REF') . '_' . word_slug($data['titre_document'], 'Titre') . '_' . word_file_version($data['version']) . '.docx';
$path = word_unique_path($targetReal, $fileName);
word_create_docx($path, $data);
$fileReal = realpath($path);
if (!$fileReal || !doc_path_is_inside_root($fileReal, $rootReal)) doc_error('Fichier généré hors du dossier documentaire autorisé.', 403);

$relative = doc_relative_path($fileReal);
$observation = trim("Objectif / domaine d'application : {$data['objectif']}\nContenu principal / résumé : {$data['contenu']}\nDiffusion services / personnes : {$data['diffusion']}\nObservation : {$data['observation']}");
$stmt = $pdo->prepare("
    INSERT INTO documents (
      reference_documentaire, titre_document, nom_fichier, extension, type_document, processus, version, statut,
      responsable_redacteur, verificateur, poste_verificateur, approbateur, poste_approbateur, diffuseur, chemin_fichier, chemin_relatif,
      taille_fichier, date_modification, stockage, observation, cycle_documentaire, dossier_processus,
      dossier_type, dossier_statut, date_creation_doc, est_version_active
    ) VALUES (?, ?, ?, 'docx', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Local', ?, ?, ?, ?, ?, NOW(), 1)
    ON DUPLICATE KEY UPDATE
      titre_document = VALUES(titre_document),
      nom_fichier = VALUES(nom_fichier),
      extension = VALUES(extension),
      type_document = VALUES(type_document),
      processus = VALUES(processus),
      version = VALUES(version),
      statut = VALUES(statut),
      responsable_redacteur = VALUES(responsable_redacteur),
      verificateur = VALUES(verificateur),
      poste_verificateur = VALUES(poste_verificateur),
      approbateur = VALUES(approbateur),
      poste_approbateur = VALUES(poste_approbateur),
      diffuseur = VALUES(diffuseur),
      chemin_fichier = VALUES(chemin_fichier),
      chemin_relatif = VALUES(chemin_relatif),
      taille_fichier = VALUES(taille_fichier),
      date_modification = VALUES(date_modification),
      stockage = VALUES(stockage),
      observation = VALUES(observation),
      cycle_documentaire = VALUES(cycle_documentaire),
      dossier_processus = VALUES(dossier_processus),
      dossier_type = VALUES(dossier_type),
      dossier_statut = VALUES(dossier_statut),
      updated_at = CURRENT_TIMESTAMP
");
$stmt->execute([
    $data['reference_documentaire'],
    $data['titre_document'],
    basename($fileReal),
    $data['type_document'],
    $data['processus'],
    $data['version'],
    $data['statut'],
    $data['responsable_redacteur'],
    $data['verificateur'],
    $data['poste_verificateur'],
    $data['approbateur'],
    $data['poste_approbateur'],
    $data['diffuseur'],
    $fileReal,
    $relative,
    filesize($fileReal),
    date('Y-m-d H:i:s', filemtime($fileReal)),
    $observation,
    $cycle,
    $processFolder,
    $typeFolder,
    $statusFolder,
]);

$id = (int) $pdo->lastInsertId();
if ($id <= 0) {
    $lookup = $pdo->prepare("SELECT id FROM documents WHERE reference_documentaire = ?");
    $lookup->execute([$data['reference_documentaire']]);
    $id = (int) $lookup->fetchColumn();
}
doc_log($pdo, $id, 'Création document Word', 'Document créé depuis modèle', trim((string) ($input['actorName'] ?? 'Utilisateur')));
$stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
$stmt->execute([$id]);
doc_json(['item' => doc_item($stmt->fetch()), 'relativePath' => $relative]);
?>
