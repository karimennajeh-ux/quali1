<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$data = doc_input();
$actor = trim((string) ($data['actorName'] ?? $data['acteur'] ?? 'Utilisateur')) ?: 'Utilisateur';
if (empty($data['confirmCleanup'])) {
    doc_error('Confirmation requise pour nettoyer les introuvables.', 422);
}

$docStmt = $pdo->prepare("DELETE FROM documents WHERE statut = 'Fichier introuvable'");
$folderStmt = $pdo->prepare("DELETE FROM dossiers_documentaires WHERE statut = 'Dossier introuvable' OR actif = 0");

$docCount = (int) $pdo->query("SELECT COUNT(*) FROM documents WHERE statut = 'Fichier introuvable'")->fetchColumn();
$folderCount = (int) $pdo->query("SELECT COUNT(*) FROM dossiers_documentaires WHERE statut = 'Dossier introuvable' OR actif = 0")->fetchColumn();

$docStmt->execute();
$folderStmt->execute();

doc_log($pdo, null, 'Nettoyage des introuvables', "Fiches MySQL supprimees uniquement : {$docCount} document(s), {$folderCount} dossier(s). Aucun fichier Windows supprime.", $actor);
doc_json([
    'message' => 'Nettoyage des introuvables termine. Aucun fichier Windows supprime.',
    'deletedDocuments' => $docCount,
    'deletedFolders' => $folderCount,
]);
?>
