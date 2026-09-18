<?php
/**
 * CloudDesk - Authentication configuration
 * =========================================
 * Change these credentials BEFORE going live.
 *
 * The dashboard requires login (session cookie). If you don't set these,
 * the API starts in "open mode": /api/auth/me always returns authenticated.
 */

define('CD_USER', 'admin');

// Password is stored as SHA-256 hash of the secret.
// To change it, run:   php -r "echo hash('sha256', 'YOUR_PASSWORD');"
// and paste the result below.
define('CD_PASSWORD_HASH', 'e2186dbdb1bb4193608605e84f33208765b5693b55edd4f730a719a100eeea6f'); // default: change-me

define('CD_SESSION_NAME', 'clouddesk_sess');
define('CD_SESSION_LIFETIME', 86400); // 24h