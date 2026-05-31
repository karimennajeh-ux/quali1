<?php
declare(strict_types=1);

require_once __DIR__ . '/_documentation.php';

$pdo = doc_pdo();
$data = doc_input();
$id = (int) ($data['id'] ?? 0);
$action = trim((string) ($data['action'] ?? ''));
$actor = trim((string) ($data['actorName'] ?? $data['acteur'] ?? 'Systeme')) ?: 'Systeme';

if ($id <= 0) doc_error('Identifiant document manquant.', 422);
if ($action === '') doc_error('Action documentaire manquante.', 422);

$doc = doc_fetch($pdo, $id);

switch ($action) {
    case 'archive':
        $updated = doc_update_lifecycle_status(
            $pdo,
            $doc,
            doc_archived_status(),
            'Archiver',
            'Document archive dans MySQL. Fichier Windows conserve : ' . ($doc['chemin_fichier'] ?? ''),
            $actor
        );
        doc_json(['message' => 'Document archive. Le fichier Windows est conserve.', 'item' => doc_item($updated)]);
        break;

    case 'exclude':
        $updated = doc_update_lifecycle_status(
            $pdo,
            $doc,
            'Exclu',
            'Exclure',
            'Document exclu de la liste principale. Fichier Windows conserve : ' . ($doc['chemin_fichier'] ?? ''),
            $actor
        );
        doc_json(['message' => 'Document exclu de la liste principale. Le fichier Windows est conserve.', 'item' => doc_item($updated)]);
        break;

    case 'restore':
        $restoreStatus = doc_restore_status($doc['statut_precedent'] ?? null);
        $updated = doc_update_lifecycle_status(
            $pdo,
            $doc,
            $restoreStatus,
            'Restaurer',
            'Document restaure avec le statut : ' . $restoreStatus,
            $actor
        );
        doc_json(['message' => 'Document restaure dans la liste principale.', 'item' => doc_item($updated)]);
        break;

    case 'delete_app':
        if (empty($data['confirmApplicationDelete'])) {
            doc_error("Confirmation requise pour supprimer la fiche de l'application.", 422);
        }
        doc_delete_application($pdo, $doc, $actor);
        doc_json(['message' => "Fiche supprimee de l'application. Le fichier Windows est conserve."]);
        break;

    case 'delete_permanent':
        $phrase = trim((string) ($data['confirmPhrase'] ?? ''));
        if (empty($data['confirmPermanent']) || $phrase !== 'SUPPRIMER DEFINITIVEMENT') {
            doc_error('Double confirmation requise pour supprimer definitivement le fichier Windows.', 422);
        }
        $fileDeleted = doc_delete_permanent($pdo, $doc, $actor);
        doc_json([
            'message' => $fileDeleted
                ? 'Fiche MySQL et fichier Windows supprimes definitivement.'
                : 'Fiche MySQL supprimee. Le fichier Windows etait deja introuvable.',
            'fileDeleted' => $fileDeleted,
        ]);
        break;

    default:
        doc_error('Action documentaire inconnue.', 422);
}
?>
