<?php
/**
 * Extract readable preview content from files stored under DMS/uploads.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$root = realpath(__DIR__ . '/../../DMS/uploads');
$relative = trim((string) ($_GET['path'] ?? ''));

function dms_preview_json(array $payload): void {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dms_preview_text_from_docx(string $path): string {
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return '';
    }

    $parts = [];
    foreach (['word/document.xml', 'word/header1.xml', 'word/footer1.xml'] as $entry) {
        $xml = $zip->getFromName($entry);
        if ($xml === false) continue;

        $xml = preg_replace('/<w:tab\b[^>]*\/>/u', "\t", $xml);
        $xml = preg_replace('/<w:br\b[^>]*\/>/u', "\n", $xml);
        $xml = preg_replace('/<\/w:p>/u', "\n", $xml);
        $xml = preg_replace('/<\/w:tr>/u', "\n", $xml);
        $xml = preg_replace('/<\/w:tc>/u', "\t", $xml);
        $text = html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
        $text = preg_replace("/[ \t]+\n/u", "\n", $text);
        $text = preg_replace("/\n{3,}/u", "\n\n", $text);
        $text = trim($text);
        if ($text !== '') $parts[] = $text;
    }

    $zip->close();
    return trim(implode("\n\n", $parts));
}

function dms_preview_xml_text(string $xml): string {
    $xml = preg_replace('/<t[^>]*>/u', '<t>', $xml);
    return trim(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8'));
}

function dms_preview_text_from_xlsx(string $path): string {
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return '';
    }

    $shared = [];
    $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($sharedXml !== false && preg_match_all('/<si\b[^>]*>(.*?)<\/si>/su', $sharedXml, $matches)) {
        foreach ($matches[1] as $itemXml) {
            $shared[] = dms_preview_xml_text($itemXml);
        }
    }

    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if ($sheetXml === false) {
        $zip->close();
        return '';
    }

    $lines = [];
    if (preg_match_all('/<row\b[^>]*>(.*?)<\/row>/su', $sheetXml, $rows)) {
        foreach ($rows[1] as $rowXml) {
            $cells = [];
            if (preg_match_all('/<c\b([^>]*)>(.*?)<\/c>/su', $rowXml, $cellMatches, PREG_SET_ORDER)) {
                foreach ($cellMatches as $cell) {
                    $attributes = $cell[1];
                    $cellXml = $cell[2];
                    $value = '';

                    if (preg_match('/\bt="s"/u', $attributes) && preg_match('/<v>(.*?)<\/v>/su', $cellXml, $valueMatch)) {
                        $index = (int) $valueMatch[1];
                        $value = $shared[$index] ?? '';
                    } elseif (preg_match('/\bt="inlineStr"/u', $attributes)) {
                        $value = dms_preview_xml_text($cellXml);
                    } elseif (preg_match('/<v>(.*?)<\/v>/su', $cellXml, $valueMatch)) {
                        $value = html_entity_decode($valueMatch[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
                    }

                    $cells[] = trim($value);
                }
            }

            $line = trim(implode("\t", $cells));
            if ($line !== '') $lines[] = $line;
            if (count($lines) >= 300) break;
        }
    }

    $zip->close();
    return trim(implode("\n", $lines));
}

if (!$root || !is_dir($root)) {
    dms_preview_json(['success' => false, 'error' => 'Dossier DMS introuvable']);
}

$relative = str_replace('\\', '/', $relative);
$relative = preg_replace('#^DMS/uploads/#i', '', $relative);
$relative = trim($relative, '/');

if ($relative === '' || strpos($relative, "\0") !== false || preg_match('#(^|/)\.\.(/|$)#', $relative)) {
    dms_preview_json(['success' => false, 'error' => 'Chemin de fichier invalide']);
}

$path = realpath($root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative));

if (!$path || strpos($path, $root) !== 0 || !is_file($path)) {
    dms_preview_json(['success' => false, 'error' => 'Fichier introuvable']);
}

$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$text = '';

if ($extension === 'docx') {
    $text = dms_preview_text_from_docx($path);
} elseif ($extension === 'xlsx') {
    $text = dms_preview_text_from_xlsx($path);
} elseif (in_array($extension, ['txt', 'csv', 'tsv', 'json', 'xml', 'md', 'log'], true)) {
    $text = (string) file_get_contents($path);
} else {
    dms_preview_json(['success' => false, 'error' => 'Aperçu texte non disponible pour ce format']);
}

if (trim($text) === '') {
    dms_preview_json(['success' => false, 'error' => 'Aucun contenu texte lisible dans ce fichier']);
}

dms_preview_json([
    'success' => true,
    'fileName' => basename($path),
    'extension' => $extension,
    'text' => mb_substr($text, 0, 60000, 'UTF-8'),
]);
?>
