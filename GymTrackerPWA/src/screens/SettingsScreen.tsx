import { useRef, useState } from 'react';
import { AppSettings } from '../types';
import { getSettings, saveSettings, exportAllData, importAllData } from '../storage/storage';

const REST_OPTIONS = [60, 90, 120, 180, 240];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(getSettings);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Push notification state
  const [pushServerUrl, setPushServerUrl] = useState(() => localStorage.getItem('gt_push_server') ?? '');
  const [vapidKey, setVapidKey]           = useState(() => localStorage.getItem('gt_vapid_pub') ?? '');
  const [pushStatus, setPushStatus]       = useState<{ ok: boolean; msg: string } | null>(null);
  const [pushBusy, setPushBusy]           = useState(false);

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
        setPushStatus({ ok: false, msg: '✗ Notification permission denied. Allow notifications in Safari settings.' });
        return;
      }
      if (!('serviceWorker' in navigator)) {
        setPushStatus({ ok: false, msg: '✗ Service workers not supported on this browser.' });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // applicationServerKey accepts a base64url string directly
        applicationServerKey: vapidKey.trim(),
      });
      const subJson = JSON.stringify(sub.toJSON());
      localStorage.setItem('gt_push_sub', subJson);
      localStorage.setItem('gt_push_server', pushServerUrl.trim());
      localStorage.setItem('gt_vapid_pub', vapidKey.trim());
      setPushStatus({ ok: true, msg: '✓ Push enabled! Start a rest timer to test it — close the app and wait.' });
    } catch (err) {
      setPushStatus({ ok: false, msg: `✗ ${String(err)}` });
    } finally {
      setPushBusy(false);
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
            Allow notifications so the app can beep and show a banner when rest ends — even when your phone is locked.
          </div>
          <button className="btn-primary" onClick={() => {
            if ('Notification' in window) Notification.requestPermission().then(p => alert(`Permission: ${p}`));
            else alert('Notifications not supported on this browser.');
          }}>
            Enable Notifications
          </button>
        </div>

        {/* ── Background Push (Cloudflare Worker) ── */}
        <div className="section-label" style={{ marginTop: 20 }}>Background Push (app fully closed)</div>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            For notifications when the app is completely closed, deploy the included Cloudflare Worker
            (see <code style={{ fontFamily: 'monospace', fontSize: 12 }}>push-server/README.md</code>),
            then paste your Worker URL and VAPID public key below.
            {hasPushSub && (
              <span style={{ color: 'var(--success)', fontWeight: 600 }}> Push is active.</span>
            )}
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Push Server URL</div>
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

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>VAPID Public Key</div>
          <input
            type="text"
            placeholder="Base64url VAPID public key (from /generate-keys)"
            value={vapidKey}
            onChange={e => setVapidKey(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 14,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--card)', color: 'var(--text)',
              fontSize: 13, boxSizing: 'border-box', wordBreak: 'break-all',
            }}
          />

          <button
            className="btn-primary"
            onClick={enablePush}
            disabled={pushBusy}
            style={{ opacity: pushBusy ? 0.6 : 1 }}
          >
            {pushBusy ? 'Subscribing…' : hasPushSub ? 'Re-subscribe' : 'Enable Background Push'}
          </button>

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
