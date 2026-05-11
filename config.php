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
?>