<?php
$servername = "localhost";
$username = "root";
$password = ""; // Default for XAMPP
$dbname = "quali"; // Assuming database name is 'quali'

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>