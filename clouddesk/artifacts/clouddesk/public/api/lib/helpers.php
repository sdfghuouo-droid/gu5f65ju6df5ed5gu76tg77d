<?php
/**
 * CloudDesk - API helpers: HTTP responses, UUIDs, JSON body parsing, auth.
 */

function cd_json(int $status, $data): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function cd_error(int $status, string $message): void {
    cd_json($status, ['error' => $message]);
}

function cd_uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function cd_now(): string {
    return gmdate('Y-m-d\TH:i:s.v\Z'); // ISO-8601 UTC with ms
}

function cd_read_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function cd_str(array $arr, string $key, ?string $default = null): ?string {
    $v = $arr[$key] ?? $default;
    return is_string($v) ? $v : $default;
}

function cd_num(?float $v): ?float {
    return $v === null ? null : (float)$v;
}

/** Start the session if not already started. */
function cd_session_start(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(CD_SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => CD_SESSION_LIFETIME,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function cd_is_logged_in(): bool {
    cd_session_start();
    return isset($_SESSION['cd_user']);
}

function cd_require_auth(): void {
    if (CD_PASSWORD_HASH === '' || CD_PASSWORD_HASH === null || CD_PASSWORD_HASH === false) {
        // Open mode: no password configured.
        return;
    }
    cd_session_start();
    if (!isset($_SESSION['cd_user'])) {
        cd_error(401, 'Unauthorized');
    }
}

/** Agent-facing endpoints (register/heartbeat/command-result) use token auth, not sessions. */
function cd_verify_token(array $client, ?string $token): bool {
    return $token !== null && is_array($client) && isset($client['agentToken']) && hash_equals((string)$client['agentToken'], (string)$token);
}

/** Strip sensitive fields before sending a client to the dashboard. */
function cd_public_client(array $c): array {
    unset($c['agentToken']);
    return $c;
}

/** Derive a health label from resource usage (mirrors dashboard semantics). */
function cd_compute_health(array $c): string {
    $cpu = (float)($c['cpu'] ?? 0);
    $ramPct = $c['ramTotal'] > 0 ? ((float)$c['ram'] / (float)$c['ramTotal']) * 100 : 0;
    $diskPct = $c['diskTotal'] > 0 ? ((float)$c['disk'] / (float)$c['diskTotal']) * 100 : 0;
    $peak = max($cpu, $ramPct, $diskPct);
    if ($peak > 85) { return 'critical'; }
    if ($peak > 70) { return 'warning'; }
    return 'good';
}