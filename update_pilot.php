<?php

header('Content-Type: application/json');
include 'config.php';

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['email'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data']);
    exit;
}

$email = $data['email'];
$name = $data['name'] ?? '';
$first_name = $data['firstName'] ?? '';
$last_name = $data['lastName'] ?? '';
$role = $data['role'] ?? '';
$dept = $data['dept'] ?? '';
$func = $data['func'] ?? '';
$matricule = $data['matricule'] ?? '';
$org_name = $data['orgName'] ?? '';
$password = $data['password'] ?? null;

// Update pilot
$sql = "UPDATE pilots SET name = ?, first_name = ?, last_name = ?, role = ?, dept = ?, func = ?, matricule = ?, org_name = ?";
$params = [$name, $first_name, $last_name, $role, $dept, $func, $matricule, $org_name];
$types = "ssssssss";

if ($password) {
    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $sql .= ", password = ?";
    $params[] = $hashed;
    $types .= "s";
}

$sql .= " WHERE email = ?";
$params[] = $email;
$types .= "s";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$success = $stmt->execute();

echo json_encode(['success' => $success]);

$stmt->close();
$conn->close();

?>