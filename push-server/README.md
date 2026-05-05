# GymTracker Push Server

A tiny Cloudflare Worker that waits a specified delay, then sends a Web Push notification to your phone. This powers the "Rest Over!" notification when the GymTracker app is fully closed.

---

## Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Node.js](https://nodejs.org) installed (any recent version)
- `npm install -g wrangler` (Cloudflare's CLI)

---

## Setup (one-time, ~10 minutes)

### Step 1 — Deploy the worker

```bash
cd push-server
wrangler login          # opens browser to authenticate
wrangler deploy         # deploys to *.workers.dev
```

Note the URL shown, e.g. `https://gymtracker-push.YOUR-SUBDOMAIN.workers.dev`.

### Step 2 — Generate VAPID keys

Open this URL in your browser (replace with your actual worker URL):

```
https://gymtracker-push.YOUR-SUBDOMAIN.workers.dev/generate-keys
```

You'll see a JSON response like:

```json
{
  "privateKeyJwk": "{\"kty\":\"EC\",\"crv\":\"P-256\",\"d\":\"...\",\"x\":\"...\",\"y\":\"...\"}",
  "publicKey": "BNabc123..."
}
```

### Step 3 — Set environment variables

Run these commands (paste the exact values from Step 2):

```bash
# The full JSON string from "privateKeyJwk"
wrangler secret put VAPID_PRIVATE_KEY_JWK

# The base64url string from "publicKey"
wrangler secret put VAPID_PUBLIC_KEY

# Your email address (used as VAPID contact)
wrangler secret put VAPID_SUBJECT
# enter:  mailto:your@email.com
```

### Step 4 — Redeploy with secrets

```bash
wrangler deploy
```

### Step 5 — Configure GymTracker

1. Open GymTracker on your phone
2. Go to **Settings → Background Push**
3. Paste your worker URL (e.g. `https://gymtracker-push.xxx.workers.dev`)
4. Paste the `publicKey` value from Step 2
5. Tap **Enable Background Push**
6. Allow notifications when prompted

### Step 6 — Test it

Start a rest timer, swipe GymTracker away from the multitasking view, and lock your phone. The notification should arrive when the timer ends.

---

## Notes

- **Free Cloudflare tier**: Workers have a 10 ms CPU limit per request. The `setTimeout` delay uses zero CPU time (it's wall-clock wait), so this works fine for rest timers up to several minutes.
- **iOS requirement**: Push notifications on iOS PWAs require iOS 16.4+ and the app must be **installed to the Home Screen** (Add to Home Screen in Safari).
- **Security**: The `/generate-keys` endpoint is safe to leave deployed since it only generates new keys — it can't expose your existing private key. If you want to be extra safe, deploy the worker without that route after setup.
- **Double notifications**: If you return to the app before the timer ends, the in-app beep fires. The server push will also arrive shortly after and show a second banner — that's normal, just dismiss it.
