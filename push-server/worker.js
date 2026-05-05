/**
 * GymTracker Push Server — Cloudflare Worker
 *
 * Required environment variables (set in Cloudflare dashboard or wrangler.toml):
 *   VAPID_PRIVATE_KEY_JWK  — JSON string of the P-256 EC private key JWK
 *   VAPID_PUBLIC_KEY       — Base64url uncompressed P-256 public key (from /generate-keys)
 *   VAPID_SUBJECT          — "mailto:you@example.com"
 *
 * Endpoints:
 *   GET  /generate-keys  — One-time key generation (delete after use)
 *   POST /schedule       — Body: { subscription, delay }  (delay in ms)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // ── POST /schedule ────────────────────────────────────────────────────────
    if (url.pathname === '/schedule' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return new Response('Bad JSON', { status: 400, headers: CORS });
      }

      const { subscription, delay } = body;
      if (!subscription?.endpoint || typeof delay !== 'number') {
        return new Response('Missing subscription or delay', { status: 400, headers: CORS });
      }

      // Respond immediately; waitUntil keeps the worker alive until the push is sent.
      ctx.waitUntil(
        new Promise(resolve => {
          setTimeout(async () => {
            try { await sendPush(env, subscription); } catch (e) { console.error('push error', e); }
            resolve(undefined);
          }, delay);
        })
      );

      return new Response(JSON.stringify({ ok: true, scheduledIn: delay }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── GET /generate-keys ────────────────────────────────────────────────────
    // Call this once to generate a VAPID key pair, then remove it (or add auth).
    if (url.pathname === '/generate-keys' && request.method === 'GET') {
      const key = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
      const privateJwk = await crypto.subtle.exportKey('jwk', key.privateKey);
      const publicJwk  = await crypto.subtle.exportKey('jwk', key.publicKey);

      // Build uncompressed point (0x04 || x || y) then base64url-encode it
      const x = b64ToBytes(publicJwk.x);
      const y = b64ToBytes(publicJwk.y);
      const uncompressed = new Uint8Array(65);
      uncompressed[0] = 0x04;
      uncompressed.set(x, 1);
      uncompressed.set(y, 33);
      const publicKeyB64url = bytesToB64url(uncompressed);

      return new Response(JSON.stringify({
        instructions: [
          '1. Copy "privateKeyJwk" → set as VAPID_PRIVATE_KEY_JWK env var in Cloudflare',
          '2. Copy "publicKey"     → paste into GymTracker Settings > VAPID Public Key',
          '3. Set VAPID_SUBJECT    → "mailto:your@email.com" in Cloudflare env vars',
          '4. Redeploy the worker  → keys are now active',
          '5. In GymTracker Settings, enter your worker URL and the publicKey, then tap "Enable Background Push"',
        ],
        privateKeyJwk: JSON.stringify(privateJwk),
        publicKey: publicKeyB64url,
      }, null, 2), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('GymTracker Push Server', { headers: CORS });
  },
};

// ── VAPID push ────────────────────────────────────────────────────────────────

async function sendPush(env, subscription) {
  if (!env.VAPID_PRIVATE_KEY_JWK || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) {
    throw new Error('VAPID env vars not configured');
  }

  const endpoint = subscription.endpoint;
  const audience = new URL(endpoint).origin;

  const privateKey = await importPrivateKey(env.VAPID_PRIVATE_KEY_JWK);
  const jwt        = await signVapidJwt(privateKey, audience, env.VAPID_SUBJECT);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
      TTL: '300',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Push failed ${res.status}: ${text}`);
  }
}

async function importPrivateKey(jwkStr) {
  return crypto.subtle.importKey(
    'jwk',
    JSON.parse(jwkStr),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function signVapidJwt(privateKey, audience, subject) {
  const enc = new TextEncoder();
  const header  = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200, // 12 h
    sub: subject,
  })));
  const toSign = `${header}.${payload}`;

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(toSign)
  );

  return `${toSign}.${bytesToB64url(new Uint8Array(sig))}`;
}

// ── Base64url helpers ─────────────────────────────────────────────────────────

function bytesToB64url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64ToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
