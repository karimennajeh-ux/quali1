<?php

include 'config.php';

// Get email
$email = $_POST['email'] ?? '';

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Email required']);
    exit;
}

// Delete pilot
$stmt = $conn->prepare("DELETE FROM pilots WHERE email = ?");
$stmt->bind_param("s", $email);
$success = $stmt->execute();

echo json_encode(['success' => $success]);

$stmt->close();
$conn->close();

?>