<?php

header('Content-Type: application/json');
include 'config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    $input = $_POST;
}

$last_name = $input['lastName'] ?? $input['last_name'] ?? '';
$first_name = $input['firstName'] ?? $input['first_name'] ?? '';
$func = $input['func'] ?? '';
$uid = $input['uid'] ?? '';
$org_name = $input['orgName'] ?? $input['org_name'] ?? '';
$email = $input['email'] ?? '';
$pwd = $input['pw'] ?? $input['password'] ?? '';

// Validate required fields
if (empty($last_name) || empty($first_name) || empty($func) || empty($uid) || empty($org_name) || empty($email) || empty($pwd)) {
    echo json_encode(['success' => false, 'message' => 'All required fields must be filled.']);
    exit;
}

// Check if email already exists
$stmt = $conn->prepare("SELECT id FROM pilots WHERE email = ?");
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

// Hash the password
$hashed_password = password_hash($pwd, PASSWORD_DEFAULT);

// Prepare name
$name = trim($first_name . ' ' . $last_name);

// Prepare and bind
$stmt = $conn->prepare("INSERT INTO pilots (email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Administrateur', 'Pilotage application', ?, ?, ?, 'Actif', NOW(), NOW())");
$stmt->bind_param("ssssssss", $email, $hashed_password, $name, $first_name, $last_name, $func, $uid, $org_name);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Pilot account created successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => $stmt->error]);
}

$stmt->close();
$conn->close();

?>