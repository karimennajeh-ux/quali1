<?php

// Database connection
$servername = "localhost";
$username = "root";
$password = ""; // Default for XAMPP
$dbname = "quali test"; // From the SQL dump

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get POST data
$last_name = $_POST['last_name'] ?? '';
$first_name = $_POST['first_name'] ?? '';
$func = $_POST['func'] ?? '';
$uid = $_POST['uid'] ?? '';
$org_name = $_POST['org_name'] ?? '';
$email = $_POST['email'] ?? '';
$email2 = $_POST['email2'] ?? '';
$pwd = $_POST['pwd'] ?? '';
$pwd2 = $_POST['pwd2'] ?? '';
$code = $_POST['code'] ?? '';

// Validate required fields
if (empty($last_name) || empty($first_name) || empty($func) || empty($uid) || empty($org_name) || empty($email) || empty($email2) || empty($pwd) || empty($pwd2) || empty($code)) {
    die("All required fields must be filled.");
}

// Check if emails match
if ($email !== $email2) {
    die("Emails do not match.");
}

// Check if passwords match
if ($pwd !== $pwd2) {
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
$hashed_password = password_hash($pwd, PASSWORD_DEFAULT);

// Prepare name
$name = $first_name . ' ' . $last_name;

// Prepare and bind
$stmt = $conn->prepare("INSERT INTO pilots (email, password, name, first_name, last_name, role, dept, func, matricule, org_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Administrateur', 'Pilotage application', ?, ?, ?, 'Actif', NOW(), NOW())");
$stmt->bind_param("sssssss", $email, $hashed_password, $name, $first_name, $last_name, $func, $uid, $org_name);

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