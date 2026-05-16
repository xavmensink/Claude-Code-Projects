import { useRef, useState } from 'react';
import { AppSettings } from '../types';
import { getSettings, saveSettings, exportAllData, importAllData } from '../storage/storage';

const REST_OPTIONS = [60, 90, 120, 180, 240];

function bytesToB64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/_/g, '/').replace(/=/g, '').replace(/\//g, '_');
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(getSettings);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Push notification state
  const [pushServerUrl, setPushServerUrl] = useState(() => localStorage.getItem('gt_push_server') ?? '');
  const [vapidKey, setVapidKey]           = useState(() => localStorage.getItem('gt_vapid_pub') ?? '');
  const [pushStatus, setPushStatus]       = useState<{ ok: boolean; msg: string } | null>(null);
  const [pushBusy, setPushBusy]           = useState(false);

  // Generated private key shown for copying into Cloudflare
  const [privateKeyJwk, setPrivateKeyJwk] = useState('');
  const [keyGenBusy, setKeyGenBusy]       = useState(false);

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const clearAll = () => {
    if (confirm('Delete ALL workout data? This cannot be undone.')) {
      if (confirm('Are you absolutely sure?')) {
        localStorage.clear();
        location.reload();
      }
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importAllData(reader.result as string);
        setImportMsg('✓ Data restored successfully. Reloading…');
        setTimeout(() => location.reload(), 1200);
      } catch {
        setImportMsg('✗ Invalid backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Generate a VAPID key pair in the browser using Web Crypto.
  // Private key is exported as PKCS8 base64url (plain string, no JSON — easier to copy).
  // Public key is auto-saved; shown for reference.
  const generateKeys = async () => {
    setKeyGenBusy(true);
    try {
      const key = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      // Private key → PKCS8 binary → base64url string (no JSON, no quotes)
      const pkcs8 = await crypto.subtle.exportKey('pkcs8', key.privateKey);
      const privateKeyB64url = bytesToB64url(new Uint8Array(pkcs8));

      // Public key → uncompressed EC point (0x04 || x || y) → base64url
      const publicJwk = await crypto.subtle.exportKey('jwk', key.publicKey) as JsonWebKey;
      const decode = (s: string) => {
        const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from([...atob(b64)].map(c => c.charCodeAt(0)));
      };
      const x = decode(publicJwk.x!);
      const y = decode(publicJwk.y!);
      const uncompressed = new Uint8Array(65);
      uncompressed[0] = 0x04;
      uncompressed.set(x, 1);
      uncompressed.set(y, 33);
      const pubB64url = bytesToB64url(uncompressed);

      localStorage.setItem('gt_vapid_pub', pubB64url);
      setVapidKey(pubB64url);
      setPrivateKeyJwk(privateKeyB64url);
    } catch (err) {
      alert(`Key generation failed: ${err}`);
    } finally {
      setKeyGenBusy(false);
    }
  };

  const enablePush = async () => {
    if (!pushServerUrl.trim() || !vapidKey.trim()) {
      setPushStatus({ ok: false, msg: 'Enter push server URL and VAPID public key first.' });
      return;
    }
    setPushBusy(true);
    setPushStatus(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushStatus({ ok: false, msg: '✗ Permission denied — allow notifications in Safari Settings.' });
        return;
      }
      if (!('serviceWorker' in navigator)) {
        setPushStatus({ ok: false, msg: '✗ Service workers not supported on this browser.' });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey.trim(),
      });
      localStorage.setItem('gt_push_sub', JSON.stringify(sub.toJSON()));
      localStorage.setItem('gt_push_server', pushServerUrl.trim());
      localStorage.setItem('gt_vapid_pub', vapidKey.trim());
      setPushStatus({ ok: true, msg: '✓ Push enabled! Start a rest timer, close the app, and wait for the notification.' });
    } catch (err) {
      setPushStatus({ ok: false, msg: `✗ ${String(err)}` });
    } finally {
      setPushBusy(false);
    }
  };

  const testConnection = async () => {
    const serverUrl = localStorage.getItem('gt_push_server');
    const subJson   = localStorage.getItem('gt_push_sub');
    if (!serverUrl || !subJson) {
      setPushStatus({ ok: false, msg: '✗ No server URL or subscription saved. Complete Step 3 first.' });
      return;
    }
    setPushStatus({ ok: true, msg: '⏳ Sending test push now…' });
    try {
      const res = await fetch(`${serverUrl}/test-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: JSON.parse(subJson) }),
      });
      const json = await res.json() as { ok: boolean; message?: string; error?: string };
      if (json.ok) {
        setPushStatus({ ok: true, msg: `✓ ${json.message ?? 'Push sent!'}` });
      } else {
        setPushStatus({ ok: false, msg: `✗ Server error: ${json.error}` });
      }
    } catch (err) {
      setPushStatus({ ok: false, msg: `✗ Could not reach server: ${String(err)}. Check the Worker URL is correct.` });
    }
  };

  const hasPushSub = !!localStorage.getItem('gt_push_sub');

  return (
    <div>
      <div className="screen-header"><span className="screen-title">Settings</span></div>

      <div style={{ padding: 16 }}>
        <div className="section-label">Rest Timer Default</div>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REST_OPTIONS.map(s => (
              <button key={s} onClick={() => update({ restTimerDuration: s })}
                style={{
                  flex: 1, minWidth: 52, padding: '10px 4px',
                  border: `1px solid ${settings.restTimerDuration === s ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: settings.restTimerDuration === s ? 'var(--accent-dim)' : 'none',
                  color: settings.restTimerDuration === s ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: settings.restTimerDuration === s ? 700 : 400, cursor: 'pointer', fontSize: 14,
                }}>
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </button>
            ))}
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 20 }}>Weight Unit</div>
        <div className="card">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['kg', 'lbs'] as const).map(u => (
              <button key={u} onClick={() => update({ weightUnit: u })}
                style={{
                  flex: 1, padding: '12px',
                  border: `1px solid ${settings.weightUnit === u ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: settings.weightUnit === u ? 'var(--accent-dim)' : 'none',
                  color: settings.weightUnit === u ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: settings.weightUnit === u ? 700 : 400, cursor: 'pointer', fontSize: 15,
                }}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* ── In-App Notifications ── */}
        <div className="section-label" style={{ marginTop: 20 }}>In-App Notifications</div>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
            Allow notifications so the app can beep and show a banner when rest ends.
          </div>
          <button className="btn-primary" onClick={() => {
            if ('Notification' in window) Notification.requestPermission().then(p => alert(`Permission: ${p}`));
            else alert('Notifications not supported on this browser.');
          }}>
            Enable Notifications
          </button>
        </div>

        {/* ── Background Push ── */}
        <div className="section-label" style={{ marginTop: 20 }}>Background Push (when app is closed)</div>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            To get notifications when the app is fully closed, you need a free Cloudflare Worker.
            Follow the 3 steps below — everything can be done on your phone.
            {hasPushSub && (
              <span style={{ color: 'var(--success)', fontWeight: 600 }}> ✓ Push is active.</span>
            )}
          </div>

          {/* Step 1 */}
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>
            Step 1 — Generate keys (do this first)
          </div>
          <button
            onClick={generateKeys}
            disabled={keyGenBusy}
            style={{
              width: '100%', padding: 12, marginBottom: 10,
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
              opacity: keyGenBusy ? 0.6 : 1,
            }}
          >
            {keyGenBusy ? 'Generating…' : vapidKey ? '↻ Regenerate VAPID Keys' : '🔑 Generate VAPID Keys'}
          </button>

          {vapidKey && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                Public Key (auto-saved ✓)
              </div>
              <div style={{
                padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
                borderRadius: 8, border: '1px solid var(--border)',
                fontSize: 11, wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--text-secondary)',
              }}>
                {vapidKey}
              </div>
            </div>
          )}

          {privateKeyJwk && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#FFD700', marginBottom: 6, fontWeight: 600 }}>
                ⚠ Private Key — paste this into Cloudflare as VAPID_PRIVATE_KEY
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                Tap "Copy Private Key" below, or tap inside the box → Select All → Copy.
              </div>
              <textarea
                readOnly
                value={privateKeyJwk}
                rows={4}
                onFocus={e => e.target.select()}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: 'rgba(255,215,0,0.06)',
                  border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: 8, fontSize: 10,
                  fontFamily: 'monospace', color: 'var(--text-secondary)',
                  resize: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => navigator.clipboard?.writeText(privateKeyJwk).then(() => alert('Copied to clipboard!')).catch(() => alert('Tap inside the box above, then Select All → Copy manually.'))}
                style={{
                  width: '100%', marginTop: 6, padding: 10,
                  border: '1px solid rgba(255,215,0,0.4)', borderRadius: 8,
                  background: 'rgba(255,215,0,0.08)', color: '#FFD700',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                Copy Private Key
              </button>
            </div>
          )}

          {/* Step 2 */}
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>
            Step 2 — Deploy Cloudflare Worker
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
            1. Go to <span style={{ fontFamily: 'monospace' }}>dash.cloudflare.com</span> → sign up free{'\n'}
            2. Workers &amp; Pages → Create → Create Worker → Deploy{'\n'}
            3. Edit code → paste contents of <span style={{ fontFamily: 'monospace' }}>push-server/worker.js</span>{'\n'}
            4. Settings → Variables &amp; Secrets → add:{'\n'}
            &nbsp;&nbsp;<span style={{ fontFamily: 'monospace', fontSize: 11 }}>VAPID_PRIVATE_KEY_JWK</span> = private key from Step 1{'\n'}
            &nbsp;&nbsp;<span style={{ fontFamily: 'monospace', fontSize: 11 }}>VAPID_PUBLIC_KEY</span> = public key from Step 1{'\n'}
            &nbsp;&nbsp;<span style={{ fontFamily: 'monospace', fontSize: 11 }}>VAPID_SUBJECT</span> = mailto:you@example.com{'\n'}
            5. Save and Deploy — copy your Worker URL (e.g. <span style={{ fontFamily: 'monospace', fontSize: 11 }}>https://xyz.workers.dev</span>)
          </div>

          {/* Step 3 */}
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>
            Step 3 — Connect
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Your Worker URL</div>
          <input
            type="url"
            placeholder="https://your-worker.workers.dev"
            value={pushServerUrl}
            onChange={e => setPushServerUrl(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 12,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--card)', color: 'var(--text)',
              fontSize: 14, boxSizing: 'border-box',
            }}
          />

          <button
            className="btn-primary"
            onClick={enablePush}
            disabled={pushBusy}
            style={{ opacity: pushBusy ? 0.6 : 1, marginBottom: 8 }}
          >
            {pushBusy ? 'Subscribing…' : hasPushSub ? 'Re-subscribe' : 'Enable Background Push'}
          </button>

          {hasPushSub && (
            <button
              onClick={testConnection}
              style={{
                width: '100%', padding: 12,
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'none', color: 'var(--text-secondary)',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              🔔 Test Push (fires in 5s)
            </button>
          )}

          {pushStatus && (
            <div style={{
              marginTop: 10, fontSize: 13, lineHeight: 1.5,
              color: pushStatus.ok ? 'var(--success)' : 'var(--danger)',
            }}>
              {pushStatus.msg}
            </div>
          )}
        </div>

        {/* ── Backup & Restore ── */}
        <div className="section-label" style={{ marginTop: 20 }}>Backup & Restore</div>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            Export a backup file and save it to your Files app or iCloud. Import it to restore everything if history is lost.
          </div>

          <button className="btn-primary" onClick={exportAllData} style={{ marginBottom: 10 }}>
            ⬇ Export Backup
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: 14,
              border: '1px solid var(--border)', borderRadius: 12,
              background: 'none', color: 'var(--text-secondary)',
              fontSize: 15, cursor: 'pointer',
            }}
          >
            ⬆ Import Backup
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />

          {importMsg && (
            <div style={{
              marginTop: 10, fontSize: 13,
              color: importMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
            }}>
              {importMsg}
            </div>
          )}
        </div>

        <div className="section-label" style={{ marginTop: 20 }}>Danger Zone</div>
        <div className="card">
          <button onClick={clearAll} style={{
            width: '100%', padding: 14,
            border: '1px solid var(--danger)', borderRadius: 10,
            background: 'none', color: 'var(--danger)', fontSize: 15, cursor: 'pointer',
          }}>
            Clear All Data
          </button>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
          GymTracker v1.0 · PWA
        </div>
      </div>
    </div>
  );
}
