<?php
/**
 * alert-lb-proxy.php
 * Proxy for https://alert-lb.com/api/alerts
 *
 * Uses exact cookie format captured from a real browser session.
 * The GA cookies follow a specific structure that Vercel validates.
 */

// ── CORS ──────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Construct cookies matching the exact real-browser format ──
// Real _ga format:   GA1.1.{clientId}.{firstVisit}
// Real _ga_* format: GS2.1.s{sessionStart}$o{visits}$g1$t{lastHit}$j60$l0$h0
$now         = time();
$clientId    = '731047427';          // stable client ID from captured session
$firstVisit  = '1777034475';        // first visit timestamp (fixed)
$sessionStart = $now;
$lastHit      = $now + 30;

$ga          = 'GA1.1.' . $clientId . '.' . $firstVisit;
$gaSession   = 'GS2.1.s' . $sessionStart . '$o2$g1$t' . $lastHit . '$j60$l0$h0';

$cookieHeader = '_ga=' . $ga . '; NEXT_LOCALE=ar; _ga_W5F5NZFN2J=' . $gaSession;

// ── cURL request ──────────────────────────────────────────────
$ch = curl_init('https://alert-lb.com/api/alerts');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_ENCODING       => '',
    CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_2_0,

    CURLOPT_COOKIE => $cookieHeader,

    CURLOPT_HTTPHEADER => [
        'Accept: */*',
        'Accept-Language: ar,en-US;q=0.9,en;q=0.8',
        'Cache-Control: no-cache',
        'Pragma: no-cache',
        'Referer: https://alert-lb.com/ar/',
        'Origin: https://alert-lb.com',
        'Sec-Ch-Ua: "Google Chrome";v="147", "Chromium";v="147", "Not/A)Brand";v="24"',
        'Sec-Ch-Ua-Mobile: ?0',
        'Sec-Ch-Ua-Platform: "Windows"',
        'Sec-Fetch-Dest: empty',
        'Sec-Fetch-Mode: cors',
        'Sec-Fetch-Site: same-origin',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            . 'AppleWebKit/537.36 (KHTML, like Gecko) '
            . 'Chrome/147.0.0.0 Safari/537.36',
    ],
]);

$body       = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

// ── Error handling ────────────────────────────────────────────
if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => ['code' => '502', 'message' => 'cURL error: ' . $curlError]]);
    exit;
}

if ($httpStatus !== 200) {
    http_response_code($httpStatus);
    echo $body ?: json_encode([
        'error' => [
            'code'    => (string) $httpStatus,
            'message' => 'Upstream returned HTTP ' . $httpStatus,
        ],
    ]);
    exit;
}

// ── Success ───────────────────────────────────────────────────
echo $body;
