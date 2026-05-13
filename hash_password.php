<?php
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$password = $input['password'] ?? $_POST['password'] ?? '';

if ($password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password required']);
    exit;
}

echo json_encode([
    'success' => true,
    'hash' => password_hash($password, PASSWORD_DEFAULT)
]);
?>
