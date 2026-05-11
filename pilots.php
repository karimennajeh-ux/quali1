<?php

include conn.php;

// Get POST data
$prenom = $_POST['prenom'] ?? '';
$nom = $_POST['nom'] ?? '';
$email = $_POST['email'] ?? '';
$mot_de_passe = $_POST['mot_de_passe'] ?? '';
$confirmer_mot_de_passe = $_POST['confirmer_mot_de_passe'] ?? '';
$role = $_POST['role'] ?? 'Administrateur';
$poste_fonction = $_POST['poste_fonction'] ?? '';
$departement_service = $_POST['departement_service'] ?? '';
$statut = $_POST['statut'] ?? 'Actif';
$profil = $_POST['profil'] ?? 'Personnalise';
$matricule = $_POST['matricule'] ?? '';

// Validate required fields
if (empty($prenom) || empty($nom) || empty($email) || empty($mot_de_passe) || empty($confirmer_mot_de_passe) || empty($poste_fonction) || empty($matricule)) {
    die("All required fields must be filled.");
}

// Check if passwords match
if ($mot_de_passe !== $confirmer_mot_de_passe) {
    die("Passwords do not match.");
}

// Check if email already exists
$stmt = $conn->prepare("SELECT id FROM pilots WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    die("Email already exists.");
}
$stmt->close();

// Hash the password
$hashed_password = password_hash($mot_de_passe, PASSWORD_DEFAULT);

// Prepare and bind
$stmt = $conn->prepare("INSERT INTO pilots (email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUALI by ENNAJEH', ?, NOW(), NOW())");
$name = $prenom . ' ' . $nom;
$stmt->bind_param("sssssssss", $email, $hashed_password, $name, $prenom, $nom, $role, $departement_service, $poste_fonction, $matricule, $statut);

// Execute
if ($stmt->execute()) {
    echo "Pilot account created successfully.";
} else {
    echo "Error: " . $stmt->error;
}

// Close connections
$stmt->close();
$conn->close();

?>