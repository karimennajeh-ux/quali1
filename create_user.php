<?php
header('Content-Type: application/json');
include 'config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$prenom = $input['prenom'] ?? $input['firstName'] ?? '';
$nom = $input['nom'] ?? $input['lastName'] ?? '';
$email = $input['email'] ?? '';
$mot_de_passe = $input['mot_de_passe'] ?? $input['password'] ?? '';
$confirmer_mot_de_passe = $input['confirmer_mot_de_passe'] ?? $input['confirmPassword'] ?? $mot_de_passe;
$role = $input['role'] ?? 'Administrateur';
$poste_fonction = $input['poste_fonction'] ?? $input['func'] ?? '';
$departement_service = $input['departement_service'] ?? $input['dept'] ?? '';
$statut = $input['statut'] ?? $input['status'] ?? 'Actif';
$matricule = $input['matricule'] ?? '';

if (empty($prenom) || empty($nom) || empty($email) || empty($mot_de_passe) || empty($poste_fonction) || empty($matricule)) {
    echo json_encode(['success' => false, 'message' => 'All required fields must be filled.']);
    exit;
}

if ($mot_de_passe !== $confirmer_mot_de_passe) {
    echo json_encode(['success' => false, 'message' => 'Passwords do not match.']);
    exit;
}

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'Email already exists.']);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

$hashed_password = password_hash($mot_de_passe, PASSWORD_DEFAULT);
$name = trim($prenom . ' ' . $nom);

$stmt = $conn->prepare("INSERT INTO users (email, password, name, first_name, last_name, role, dept, func, matricule, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
$stmt->bind_param("ssssssssss", $email, $hashed_password, $name, $prenom, $nom, $role, $departement_service, $poste_fonction, $matricule, $statut);

echo json_encode([
    'success' => $stmt->execute(),
    'message' => 'User account created successfully.'
]);

$stmt->close();
$conn->close();
?>
