<?php
/**
 * Create new DMS document
 * Creates a new document file in the specified folder
 */

header('Content-Type: application/json');

function dms_xml(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function dms_docx_template_path(string $templateType): ?string {
    $templatesDir = realpath(__DIR__ . '/../../database/word_documents/templates');
    if (!$templatesDir || !is_dir($templatesDir)) return null;

    $key = strtolower(trim($templateType));
    $map = [
        'procedure' => 'modèle procédure.docx',
        'procédure' => 'modèle procédure.docx',
        'instruction' => 'modèle instruction.docx',
        'formulaire' => 'modèle formulaire.docx',
        'enregistrement' => 'modèle Enregistrement.docx',
        'doc' => 'modèle procédure.docx',
        'document' => 'modèle procédure.docx',
    ];

    $fileName = $map[$key] ?? 'modèle procédure.docx';
    $path = $templatesDir . DIRECTORY_SEPARATOR . $fileName;

    return is_file($path) ? $path : null;
}

function dms_decode_logo_data_url(string $dataUrl): ?array {
    if (!preg_match('#^data:(image/png|image/jpeg|image/jpg);base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $matches)) {
        return null;
    }

    $bytes = base64_decode($matches[2], true);
    if ($bytes === false || strlen($bytes) > 2 * 1024 * 1024) {
        return null;
    }

    $mime = $matches[1] === 'image/jpg' ? 'image/jpeg' : $matches[1];
    return [
        'mime' => $mime,
        'ext' => $mime === 'image/png' ? 'png' : 'jpg',
        'bytes' => $bytes,
    ];
}

function dms_docx_logo_drawing_xml(string $relId): string {
    return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        . '<wp:extent cx="1524000" cy="762000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="401" name="Logo en-tête"/>'
        . '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        . '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        . '<pic:pic><pic:nvPicPr><pic:cNvPr id="402" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr>'
        . '<pic:blipFill><a:blip r:embed="' . $relId . '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        . '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1524000" cy="762000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        . '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function dms_docx_identifier_header_xml(array $identifier, string $logoRelId = ''): string {
    $type = dms_xml($identifier['type'] ?? 'DOCUMENT');
    $subtitle = dms_xml($identifier['subtitle'] ?? 'MAITRISE DES DOCUMENTS');
    $ref = dms_xml($identifier['ref'] ?? '-');
    $ie = dms_xml($identifier['ie'] ?? '-');
    $date = dms_xml($identifier['date'] ?? date('d/m/Y'));
    $page = dms_xml($identifier['page'] ?? '1/1');

    $p = static function (string $text, bool $bold = false, int $size = 20, string $color = '777777'): string {
        $boldXml = $bold ? '<w:b/>' : '';
        return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr>' . $boldXml . '<w:color w:val="' . $color . '"/><w:sz w:val="' . $size . '"/></w:rPr><w:t xml:space="preserve">' . $text . '</w:t></w:r></w:p>';
    };
    $leftP = static function (string $text, bool $bold = false, int $size = 20, string $color = '777777'): string {
        $boldXml = $bold ? '<w:b/>' : '';
        return '<w:p><w:r><w:rPr>' . $boldXml . '<w:color w:val="' . $color . '"/><w:sz w:val="' . $size . '"/></w:rPr><w:t xml:space="preserve">' . $text . '</w:t></w:r></w:p>';
    };
    $cell = static function (string $content, string $width, string $vAlign = 'center', string $gridSpan = ''): string {
        $span = $gridSpan !== '' ? '<w:gridSpan w:val="' . $gridSpan . '"/>' : '';
        return '<w:tc><w:tcPr><w:tcW w:w="' . $width . '" w:type="dxa"/>' . $span . '<w:vAlign w:val="' . $vAlign . '"/></w:tcPr>' . $content . '</w:tc>';
    };
    $labelCell = static function (string $text) use ($leftP, $cell): string {
        return $cell($leftP($text, true, 20), '1100');
    };
    $valueCell = static function (string $text) use ($leftP, $cell): string {
        return $cell($leftP($text, true, 20), '1700');
    };

    $logo = $logoRelId !== ''
        ? dms_docx_logo_drawing_xml($logoRelId)
        : $p('ENER', true, 52, '9DCCED') . $p('Laboratoire De Métrologie', true, 18, '79BBED');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        . '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'
        . '<w:top w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/><w:left w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/>'
        . '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/><w:right w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/>'
        . '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/>'
        . '</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2800"/><w:gridCol w:w="4300"/><w:gridCol w:w="1100"/><w:gridCol w:w="1700"/></w:tblGrid>'
        . '<w:tr>'
        . '<w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/><w:vMerge w:val="restart"/><w:vAlign w:val="center"/></w:tcPr>' . $logo . '</w:tc>'
        . $cell($p($type, true, 20), '4300')
        . $labelCell('Réf :') . $valueCell($ref)
        . '</w:tr><w:tr>'
        . '<w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/><w:vMerge/><w:vAlign w:val="center"/></w:tcPr><w:p/></w:tc>'
        . '<w:tc><w:tcPr><w:tcW w:w="4300" w:type="dxa"/><w:vMerge w:val="restart"/><w:vAlign w:val="center"/></w:tcPr>' . $p($subtitle, true, 24) . '</w:tc>'
        . $labelCell('IE :') . $valueCell($ie)
        . '</w:tr><w:tr>'
        . '<w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/><w:vMerge/><w:vAlign w:val="center"/></w:tcPr><w:p/></w:tc>'
        . '<w:tc><w:tcPr><w:tcW w:w="4300" w:type="dxa"/><w:vMerge/><w:vAlign w:val="center"/></w:tcPr><w:p/></w:tc>'
        . $labelCell('Date :') . $valueCell($date)
        . '</w:tr><w:tr>'
        . '<w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/><w:vMerge/><w:vAlign w:val="center"/></w:tcPr><w:p/></w:tc>'
        . '<w:tc><w:tcPr><w:tcW w:w="4300" w:type="dxa"/><w:vMerge/><w:vAlign w:val="center"/></w:tcPr><w:p/></w:tc>'
        . $labelCell('Page :') . $valueCell($page)
        . '</w:tr></w:tbl><w:p/></w:hdr>';
}

function dms_apply_docx_identifier_header(string $path, array $identifier): bool {
    if (!class_exists('ZipArchive')) return false;

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) return false;

    $headerPath = 'word/headerDmsIdentifier.xml';
    $relId = 'rIdDmsIdentifierHeader';
    $logoRelId = '';

    $logoData = isset($identifier['logoDataUrl']) && is_string($identifier['logoDataUrl'])
        ? dms_decode_logo_data_url($identifier['logoDataUrl'])
        : null;

    if ($logoData) {
        $logoRelId = 'rIdDmsHeaderLogo';
        $logoPath = 'word/media/dmsHeaderLogo.' . $logoData['ext'];
        $zip->addFromString($logoPath, $logoData['bytes']);

        $headerRelsPath = 'word/_rels/headerDmsIdentifier.xml.rels';
        $headerRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="' . $logoRelId . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/dmsHeaderLogo.' . $logoData['ext'] . '"/>'
            . '</Relationships>';
        $zip->addFromString($headerRelsPath, $headerRels);

        $contentTypesPath = '[Content_Types].xml';
        $contentTypes = $zip->getFromName($contentTypesPath);
        if ($contentTypes !== false) {
            $defaultExt = '<Default Extension="' . $logoData['ext'] . '" ContentType="' . $logoData['mime'] . '"/>';
            if (strpos($contentTypes, 'Extension="' . $logoData['ext'] . '"') === false) {
                $contentTypes = str_replace('</Types>', $defaultExt . '</Types>', $contentTypes);
                $zip->addFromString($contentTypesPath, $contentTypes);
            }
        }
    }

    $zip->addFromString($headerPath, dms_docx_identifier_header_xml($identifier, $logoRelId));

    $relsPath = 'word/_rels/document.xml.rels';
    $rels = $zip->getFromName($relsPath);
    if ($rels === false) {
        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }
    if (strpos($rels, 'Id="' . $relId . '"') === false) {
        $relationship = '<Relationship Id="' . $relId . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerDmsIdentifier.xml"/>';
        $rels = str_replace('</Relationships>', $relationship . '</Relationships>', $rels);
        $zip->addFromString($relsPath, $rels);
    }

    $contentTypesPath = '[Content_Types].xml';
    $contentTypes = $zip->getFromName($contentTypesPath);
    if ($contentTypes !== false && strpos($contentTypes, 'PartName="/word/headerDmsIdentifier.xml"') === false) {
        $override = '<Override PartName="/word/headerDmsIdentifier.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>';
        $contentTypes = str_replace('</Types>', $override . '</Types>', $contentTypes);
        $zip->addFromString($contentTypesPath, $contentTypes);
    }

    $documentPath = 'word/document.xml';
    $document = $zip->getFromName($documentPath);
    if ($document === false) {
        $zip->close();
        return false;
    }

    if (strpos($document, 'xmlns:r=') === false) {
        $document = preg_replace('/<w:document\b/', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"', $document, 1);
    }

    $document = preg_replace('/<w:headerReference\b[^>]*w:type="default"[^>]*\/>/', '', $document);
    $headerReference = '<w:headerReference w:type="default" r:id="' . $relId . '"/>';

    if (preg_match('/<w:sectPr\b[^>]*>/', $document, $matches, PREG_OFFSET_CAPTURE)) {
        $insertAt = $matches[0][1] + strlen($matches[0][0]);
        $document = substr($document, 0, $insertAt) . $headerReference . substr($document, $insertAt);
    } else {
        $sectPr = '<w:sectPr>' . $headerReference . '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';
        $document = str_replace('</w:body>', $sectPr . '</w:body>', $document);
    }

    $zip->addFromString($documentPath, $document);
    return $zip->close();
}

// Get JSON data
$data = json_decode(file_get_contents('php://input'), true);

$fileName = $data['fileName'] ?? '';
$content = $data['content'] ?? '';
$folder = $data['folder'] ?? '';
$extension = strtolower(trim($data['extension'] ?? 'txt'));
$templateType = trim((string) ($data['templateType'] ?? 'procedure'));
$identifier = is_array($data['identifier'] ?? null) ? $data['identifier'] : [];

if (empty($fileName) || empty($folder)) {
    echo json_encode(['success' => false, 'error' => 'Missing parameters']);
    exit;
}

$dmsPath = realpath(__DIR__ . '/../../DMS/uploads');

if (!$dmsPath || !is_dir($dmsPath)) {
    echo json_encode(['success' => false, 'error' => 'DMS directory not found']);
    exit;
}

$folder = trim(str_replace('\\', '/', $folder), '/');

if ($folder === '' || strpos($folder, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $folder)) {
    echo json_encode(['success' => false, 'error' => 'Invalid folder']);
    exit;
}

$uploadDir = $dmsPath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $folder);

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    echo json_encode(['success' => false, 'error' => 'Failed to create folder']);
    exit;
}

$uploadDir = realpath($uploadDir);

if (!$uploadDir || strpos($uploadDir, $dmsPath) !== 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid folder path']);
    exit;
}

$validExtensions = ['docx', 'xlsx', 'pdf', 'pptx', 'png', 'txt'];
if (!in_array($extension, $validExtensions, true)) {
    $extension = 'txt';
}

// Sanitize filename and apply selected extension
$fileName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $fileName);
$pathInfo = pathinfo($fileName);
$baseName = $pathInfo['filename'] ?? $fileName;
$baseName = $baseName !== '' ? $baseName : 'document';
$fileName = $baseName . '.' . $extension;

$destinationPath = $uploadDir . '/' . $fileName;

// Prevent overwrite, add number if file exists
$counter = 1;
$pathInfo = pathinfo($destinationPath);
while (file_exists($destinationPath)) {
    $newName = $pathInfo['filename'] . '_' . $counter . '.' . $pathInfo['extension'];
    $destinationPath = $pathInfo['dirname'] . '/' . $newName;
    $counter++;
}

if ($extension === 'docx') {
    $templatePath = dms_docx_template_path($templateType);
    if (!$templatePath || !copy($templatePath, $destinationPath)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create Word document from template']);
        exit;
    }

    if (!dms_apply_docx_identifier_header($destinationPath, $identifier)) {
        echo json_encode(['success' => false, 'error' => 'Failed to write Word header']);
        exit;
    }
} else {
    // Write file
    if (!file_put_contents($destinationPath, $content)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create file']);
        exit;
    }
}

// Set proper permissions
chmod($destinationPath, 0644);

echo json_encode([
    'success' => true,
    'message' => 'Document created successfully',
    'fileName' => basename($destinationPath),
    'folder' => $folder,
    'path' => $destinationPath,
    'size' => filesize($destinationPath)
]);
