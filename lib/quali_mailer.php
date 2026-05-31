<?php
declare(strict_types=1);

function quali_smtp_configured(): bool
{
    return trim((string) getenv('QUALI_SMTP_HOST')) !== '';
}

function quali_log_email_error(mysqli $conn, string $email, string $purpose, string $message): void
{
    try {
        $stmt = $conn->prepare('INSERT INTO email_error_log (email, purpose, error_message) VALUES (?, ?, ?)');
        $stmt->bind_param('sss', $email, $purpose, $message);
        $stmt->execute();
        $stmt->close();
    } catch (Throwable $e) {
        error_log('QUALI email log failed: ' . $e->getMessage());
    }
}

function quali_send_smtp_mail(mysqli $conn, string $email, string $subject, string $body, string $purpose = 'validation'): bool
{
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (is_file($autoload)) {
        require_once $autoload;
    }

    if (!class_exists('\\PHPMailer\\PHPMailer\\PHPMailer')) {
        quali_log_email_error($conn, $email, $purpose, 'PHPMailer non installe. Ajoutez PHPMailer via Composer et configurez QUALI_SMTP_HOST.');
        return false;
    }

    try {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = (string) getenv('QUALI_SMTP_HOST');
        $mail->Port = (int) (getenv('QUALI_SMTP_PORT') ?: 587);
        $mail->SMTPAuth = true;
        $mail->Username = (string) getenv('QUALI_SMTP_USER');
        $mail->Password = (string) getenv('QUALI_SMTP_PASSWORD');
        $secure = strtolower((string) (getenv('QUALI_SMTP_SECURE') ?: 'tls'));
        if ($secure === 'ssl') $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        elseif ($secure === 'tls') $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $from = (string) (getenv('QUALI_SMTP_FROM') ?: getenv('QUALI_SMTP_USER') ?: 'no-reply@quali.local');
        $fromName = (string) (getenv('QUALI_SMTP_FROM_NAME') ?: 'QUALI');
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($from, $fromName);
        $mail->addAddress($email);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->AltBody = $body;
        $mail->send();
        return true;
    } catch (Throwable $e) {
        quali_log_email_error($conn, $email, $purpose, $e->getMessage());
        return false;
    }
}
?>
