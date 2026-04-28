/**
 * Cloudflare Worker — alert-lb.com proxy
 * Deploy at: https://workers.cloudflare.com
 *
 * Free tier: 100,000 requests/day — more than enough.
 * Cloudflare edge IPs are never blocked by Vercel.
 */

export default {
  async fetch(request) {
    // ── CORS pre-flight ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // ── Proxy to alert-lb.com ────────────────────────────────
    const now          = Math.floor(Date.now() / 1000);
    const sessionStart = now - 30;

    const upstream = await fetch('https://alert-lb.com/api/alerts', {
      method:  'GET',
      headers: {
        'Accept':            'application/json, text/plain, */*',
        'Accept-Language':   'ar,en-US;q=0.9,en;q=0.8',
        'Cache-Control':     'no-cache',
        'Pragma':            'no-cache',
        'Referer':           'https://alert-lb.com/ar/',
        'Origin':            'https://alert-lb.com',
        'Sec-Fetch-Dest':    'empty',
        'Sec-Fetch-Mode':    'cors',
        'Sec-Fetch-Site':    'same-origin',
        'Sec-Ch-Ua':         '"Google Chrome";v="147", "Chromium";v="147", "Not/A)Brand";v="24"',
        'Sec-Ch-Ua-Mobile':  '?0',
        'Sec-Ch-Ua-Platform':'"Windows"',
        'User-Agent':        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'Cookie':            `_ga=GA1.1.731047427.1777034475; NEXT_LOCALE=ar; _ga_W5F5NZFN2J=GS2.1.s${sessionStart}$o2$g1$t${now}$j60$l0$h0`,
      },
    });

    const body = await upstream.text();

    return new Response(body, {
      status:  upstream.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'no-store, no-cache',
  };
}
