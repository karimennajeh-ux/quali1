<?php

header('Content-Type: application/json');
include 'config.php';

// Get email
$email = $_GET['email'] ?? ''; 

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Email required']);
    exit;
}

// Get pilot
$stmt = $conn->prepare("SELECT id, email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status FROM pilots WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Pilot not found']);
    exit;
}

$row = $result->fetch_assoc();

$pilot = [
    'id' => $row['id'],
    'email' => $row['email'],
    'name' => $row['name'],
    'firstName' => $row['first_name'],
    'lastName' => $row['last_name'],
    'role' => $row['role'],
    'dept' => $row['dept'],
    'func' => $row['func'],
    'matricule' => $row['matricule'],
    'orgName' => $row['org_name'],
    'status' => $row['status'],
    'pilot' => true
];

echo json_encode(['success' => true, 'pilot' => $pilot]);

$stmt->close();
$conn->close();

?>