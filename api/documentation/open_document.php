<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$id = (int) ($_GET['id'] ?? $_POST['id'] ?? 0);
$mode = (string) ($_GET['mode'] ?? $_POST['mode'] ?? 'read');
if ($id <= 0) doc_error('Identifiant document manquant.', 422);

$stmt = $pdo->prepare("SELECT * FROM documents WHERE id = ?");
$stmt->execute([$id]);
$doc = $stmt->fetch();
if (!$doc) doc_error('Document introuvable.', 404);

$path = (string) $doc['chemin_fichier'];
$rootReal = realpath(doc_root());
$fileReal = realpath($path);
if (!$rootReal || !$fileReal || !is_file($fileReal)) {
    doc_error('Fichier introuvable sur le disque.', 404);
}

$rootCheck = rtrim(strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $rootReal)), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
$fileCheck = strtolower(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $fileReal));
if (strpos($fileCheck, $rootCheck) !== 0) {
    doc_log($pdo, $id, 'ouverture_refusee', "Tentative d'ouverture hors dossier documentaire.");
    doc_error('Acces refuse : le fichier est hors du dossier documentaire autorise.', 403);
}

$extension = strtolower(pathinfo($fileReal, PATHINFO_EXTENSION));
if (!in_array($extension, QUALI_DOCUMENT_EXTENSIONS, true)) {
    doc_log($pdo, $id, 'ouverture_refusee', 'Extension non autorisée : ' . $extension);
    doc_error('Type de fichier non autorise.', 403);
}

$mode = $mode === 'download' ? 'download' : 'read';
$mime = doc_mime($extension);
$inline = in_array($extension, ['pdf', 'png', 'jpg', 'jpeg'], true) && $mode !== 'download';
$fileName = basename($fileReal);
$fallbackName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $fileName) ?: 'document.' . $extension;

doc_log($pdo, $id, 'ouverture', 'Ouverture du fichier : ' . $fileName);

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($fileReal));
header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $fallbackName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=0, must-revalidate');
readfile($fileReal);
exit;
?>
