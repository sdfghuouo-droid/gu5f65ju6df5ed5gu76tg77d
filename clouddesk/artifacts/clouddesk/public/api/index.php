<?php
/**
 * CloudDesk API - PHP backend for shared hosting (cPanel).
 *
 * Mirrors the original Express API. Uses JSON files for storage,
 * PHP sessions for dashboard auth, and per-client tokens for agents.
 */

require_once __DIR__ . '/config/auth.php';
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/storage.php';

$dataDir = __DIR__ . '/data';
$store = new CDStorage($dataDir);
$storage = $store; // alias

// ---------------------------------------------------------------------------
// Request routing
// ---------------------------------------------------------------------------
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip everything up to and including "/api"
$pos = strrpos((string)$uri, '/api');
$path = $pos !== false ? substr((string)$uri, $pos + 4) : (string)$uri;
if ($path === '' || $path === '/') {
    $path = '/';
}
$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// AUTH (public)
// ---------------------------------------------------------------------------
if ($path === '/auth/login' && $method === 'POST') {
    $body = cd_read_body();
    $user = cd_str($body, 'username');
    $pass = cd_str($body, 'password');

    if (
        $user !== null
        && $pass !== null
        && hash_equals(CD_USER, $user)
        && (CD_PASSWORD_HASH === '' || hash_equals(CD_PASSWORD_HASH, hash('sha256', $pass)))
    ) {
        cd_session_start();
        session_regenerate_id(true);
        $_SESSION['cd_user'] = $user;
        cd_json(200, ['username' => $user, 'message' => 'Login successful']);
    }
    cd_error(401, 'Invalid credentials');
}

if ($path === '/auth/logout' && $method === 'POST') {
    cd_session_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    cd_json(200, ['message' => 'Logged out']);
}

if ($path === '/auth/me' && $method === 'GET') {
    cd_session_start();
    if (isset($_SESSION['cd_user'])) {
        cd_json(200, ['username' => $_SESSION['cd_user']]);
    }
    cd_error(401, 'Not authenticated');
}

// ---------------------------------------------------------------------------
// HEALTH (public)
// ---------------------------------------------------------------------------
if ($path === '/healthz') {
    if ($method !== 'GET') { cd_error(405, 'Method not allowed'); }
    cd_json(200, ['status' => 'ok']);
}

// ---------------------------------------------------------------------------
// AGENTS (public, token-based)
// ---------------------------------------------------------------------------
if ($path === '/clients/register' && $method === 'POST') {
    $body = cd_read_body();
    $hostname = cd_str($body, 'hostname');
    if (!$hostname) {
        cd_error(400, 'Invalid registration data');
    }

    $client = [
        'id' => cd_uuid(),
        'hostname' => $hostname,
        'username' => cd_str($body, 'username'),
        'os' => cd_str($body, 'os'),
        'agentVersion' => cd_str($body, 'agentVersion'),
        'ipAddress' => cd_str($body, 'ipAddress'),
        'cpu' => null,
        'ram' => null,
        'ramTotal' => null,
        'disk' => null,
        'diskTotal' => null,
        'status' => 'online',
        'health' => 'good',
        'group' => null,
        'tags' => [],
        'agentToken' => cd_uuid(),
        'lastSeen' => cd_now(),
        'createdAt' => cd_now(),
    ];

    $clients = $storage->read('clients');
    $clients[] = $client;
    if (!$storage->write('clients', $clients)) {
        cd_error(500, 'Storage write failed');
    }

    cd_json(201, ['clientId' => $client['id'], 'token' => $client['agentToken']]);
}

if ($path === '/agents/heartbeat' && $method === 'POST') {
    $body = cd_read_body();
    $clientId = cd_str($body, 'clientId');
    $token = cd_str($body, 'token');

    $clients = $storage->read('clients');
    $idx = null;
    $client = null;
    foreach ($clients as $i => $c) {
        if (($c['id'] ?? '') === $clientId) { $idx = $i; $client = $c; break; }
    }

    if ($idx === null || !cd_verify_token($client, $token)) {
        cd_error(401, 'Invalid credentials');
    }

    $clients[$idx]['cpu'] = cd_num($body['cpu'] ?? null);
    $clients[$idx]['ram'] = cd_num($body['ram'] ?? null);
    $clients[$idx]['ramTotal'] = cd_num($body['ramTotal'] ?? null);
    $clients[$idx]['disk'] = cd_num($body['disk'] ?? null);
    $clients[$idx]['diskTotal'] = cd_num($body['diskTotal'] ?? null);
    $clients[$idx]['ipAddress'] = cd_str($body, 'ipAddress') ?? $client['ipAddress'] ?? null;
    $clients[$idx]['status'] = 'online';
    $clients[$idx]['lastSeen'] = cd_now();
    $clients[$idx]['health'] = cd_compute_health($clients[$idx]);

    $updated = $storage->write('clients', $clients);
    if (!$updated) { cd_error(500, 'Storage write failed'); }

    // Pull pending commands and mark them running
    $pending = [];
    $commands = $storage->read('commands');
    $changed = false;
    foreach ($commands as &$cmd) {
        if (($cmd['clientId'] ?? '') === $clientId && ($cmd['status'] ?? '') === 'pending') {
            $cmd['status'] = 'running';
            $cmd['startedAt'] = cd_now();
            $changed = true;
            $pending[] = $cmd;
        }
    }
    unset($cmd);
    if ($changed) {
        $storage->write('commands', $commands);
    }

    cd_json(200, ['pendingCommands' => $pending]);
}

if ($path === '/agents/command-result' && $method === 'POST') {
    $body = cd_read_body();
    $commandId = cd_str($body, 'commandId');
    $clientToken = cd_str($body, 'clientToken');
    $output = cd_str($body, 'output') ?? '';
    $exitCode = isset($body['exitCode']) ? (int)$body['exitCode'] : null;
    $status = cd_str($body, 'status', 'completed');
    if (!in_array($status, ['completed', 'failed', 'timeout'], true)) {
        $status = 'completed';
    }

    $commands = $storage->read('commands');
    $cidx = null;
    foreach ($commands as $i => $c) {
        if (($c['id'] ?? '') === $commandId) { $cidx = $i; break; }
    }
    if ($cidx === null) { cd_error(404, 'Command not found'); }

    $clients = $storage->read('clients');
    $client = null;
    foreach ($clients as $c) {
        if (($c['id'] ?? '') === ($commands[$cidx]['clientId'] ?? '')) { $client = $c; break; }
    }
    if (!cd_verify_token($client, $clientToken)) {
        cd_error(401, 'Invalid credentials');
    }

    $commands[$cidx]['output'] = $output;
    $commands[$cidx]['exitCode'] = $exitCode;
    $commands[$cidx]['status'] = $status;
    $commands[$cidx]['completedAt'] = cd_now();
    $storage->write('commands', $commands);

    cd_json(200, ['ok' => true]);
}

// ---------------------------------------------------------------------------
// DASHBOARD (protected by session)
// ---------------------------------------------------------------------------
cd_require_auth();

if ($path === '/stats' && $method === 'GET') {
    $clients = $storage->read('clients');
    $counts = ['total' => count($clients), 'online' => 0, 'offline' => 0, 'alerting' => 0, 'maintenance' => 0];
    foreach ($clients as $c) {
        $s = $c['status'] ?? 'offline';
        if (isset($counts[$s])) { $counts[$s]++; }
    }
    cd_json(200, $counts);
}

if ($path === '/clients' && $method === 'GET') {
    $status = cd_str($_GET, 'status');
    $search = cd_str($_GET, 'search');
    $group = cd_str($_GET, 'group');

    $clients = $storage->read('clients');
    $out = [];
    foreach ($clients as $c) {
        if ($status && ($c['status'] ?? '') !== $status) { continue; }
        if ($group && ($c['group'] ?? '') !== $group) { continue; }
        if ($search) {
            $needle = strtolower($search);
            $hay = strtolower(implode(' ', [
                $c['hostname'] ?? '', $c['username'] ?? '', $c['ipAddress'] ?? '', $c['os'] ?? ''
            ]));
            if (strpos($hay, $needle) === false) { continue; }
        }
        $out[] = cd_public_client($c);
    }
    cd_json(200, $out);
}

if (preg_match('#^/clients/([^/]+)$#', $path, $m) && $method === 'GET') {
    $clients = $storage->read('clients');
    $client = null;
    foreach ($clients as $c) {
        if (($c['id'] ?? '') === $m[1]) { $client = $c; break; }
    }
    if (!$client) { cd_error(404, 'Client not found'); }
    cd_json(200, cd_public_client($client));
}

if (preg_match('#^/clients/([^/]+)$#', $path, $m) && $method === 'PUT') {
    $body = cd_read_body();
    $clients = $storage->read('clients');
    $idx = null;
    foreach ($clients as $i => $c) {
        if (($c['id'] ?? '') === $m[1]) { $idx = $i; break; }
    }
    if ($idx === null) { cd_error(404, 'Client not found'); }

    if (array_key_exists('group', $body)) { $clients[$idx]['group'] = $body['group']; }
    if (array_key_exists('tags', $body) && is_array($body['tags'])) { $clients[$idx]['tags'] = $body['tags']; }
    if (array_key_exists('status', $body)) {
        $s = $body['status'];
        if (in_array($s, ['online', 'offline', 'alerting', 'maintenance'], true)) {
            $clients[$idx]['status'] = $s;
        }
    }
    $storage->write('clients', $clients);
    cd_json(200, cd_public_client($clients[$idx]));
}

if (preg_match('#^/clients/([^/]+)$#', $path, $m) && $method === 'DELETE') {
    $clients = $storage->read('clients');
    $kept = [];
    foreach ($clients as $c) {
        if (($c['id'] ?? '') !== $m[1]) { $kept[] = $c; }
    }
    $storage->write('clients', $kept);

    // Also remove the client's commands
    $commands = $storage->read('commands');
    $keptCmds = [];
    foreach ($commands as $c) {
        if (($c['clientId'] ?? '') !== $m[1]) { $keptCmds[] = $c; }
    }
    $storage->write('commands', $keptCmds);

    http_response_code(204);
    exit;
}

if (preg_match('#^/clients/([^/]+)/commands/([^/]+)$#', $path, $m) && $method === 'GET') {
    $commands = $storage->read('commands');
    $found = null;
    foreach ($commands as $c) {
        if (($c['clientId'] ?? '') === $m[1] && ($c['id'] ?? '') === $m[2]) { $found = $c; break; }
    }
    if (!$found) { cd_error(404, 'Command not found'); }
    cd_json(200, $found);
}

if (preg_match('#^/clients/([^/]+)/commands$#', $path, $m)) {
    $clientId = $m[1];

    if ($method === 'GET') {
        $commands = $storage->read('commands');
        $out = [];
        foreach ($commands as $c) {
            if (($c['clientId'] ?? '') === $clientId) { $out[] = $c; }
        }
        usort($out, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));
        $out = array_slice($out, 0, 50);
        cd_json(200, $out);
    }

    if ($method === 'POST') {
        $body = cd_read_body();
        $commandText = cd_str($body, 'command');
        if (!$commandText) { cd_error(400, 'Invalid command data'); }

        $clients = $storage->read('clients');
        $client = null;
        foreach ($clients as $c) {
            if (($c['id'] ?? '') === $clientId) { $client = $c; break; }
        }
        if (!$client) { cd_error(404, 'Client not found'); }

        $cmd = [
            'id' => cd_uuid(),
            'clientId' => $clientId,
            'command' => $commandText,
            'output' => null,
            'exitCode' => null,
            'status' => 'pending',
            'createdAt' => cd_now(),
            'completedAt' => null,
        ];

        if (in_array($client['status'] ?? '', ['offline', 'maintenance'], true)) {
            $cmd['status'] = 'failed';
            $cmd['output'] = 'Client is ' . ($client['status'] ?? 'unknown') . '. Cannot execute command.';
            $cmd['completedAt'] = cd_now();
        }

        $commands = $storage->read('commands');
        $commands[] = $cmd;
        $storage->write('commands', $commands);

        cd_json(202, $cmd);
    }
}

if (preg_match('#^/clients/([^/]+)/files$#', $path, $m) && $method === 'GET') {
    $clients = $storage->read('clients');
    $client = null;
    foreach ($clients as $c) {
        if (($c['id'] ?? '') === $m[1]) { $client = $c; break; }
    }
    if (!$client) { cd_error(404, 'Client not found'); }

    $isWindows = strtolower((string)($client['os'] ?? '')).' ' !== 'linux';
    $now = cd_now();

    if ($isWindows) {
        $files = [
            ['name' => 'Users', 'path' => 'C:\\Users', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'Program Files', 'path' => 'C:\\Program Files', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'Windows', 'path' => 'C:\\Windows', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'Temp', 'path' => 'C:\\Temp', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'pagefile.sys', 'path' => 'C:\\pagefile.sys', 'isDirectory' => false, 'size' => 1073741824, 'modifiedAt' => $now],
            ['name' => 'hiberfil.sys', 'path' => 'C:\\hiberfil.sys', 'isDirectory' => false, 'size' => 536870912, 'modifiedAt' => $now],
        ];
    } else {
        $files = [
            ['name' => 'home', 'path' => '/home', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'etc', 'path' => '/etc', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'var', 'path' => '/var', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'usr', 'path' => '/usr', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
            ['name' => 'tmp', 'path' => '/tmp', 'isDirectory' => true, 'size' => null, 'modifiedAt' => $now],
        ];
    }

    cd_json(200, $files);
}

cd_error(404, 'Not found');