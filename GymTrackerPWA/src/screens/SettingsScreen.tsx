import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { getSettings, saveSettings } from '../storage/storage';

const REST_OPTIONS = [60, 90, 120, 180, 240];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(getSettings);

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
                  flex: 1, minWidth: 52, padding: '10px 4px', border: `1px solid ${settings.restTimerDuration === s ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, background: settings.restTimerDuration === s ? 'var(--accent-dim)' : 'none',
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
                  flex: 1, padding: '12px', border: `1px solid ${settings.weightUnit === u ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, background: settings.weightUnit === u ? 'var(--accent-dim)' : 'none',
                  color: settings.weightUnit === u ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: settings.weightUnit === u ? 700 : 400, cursor: 'pointer', fontSize: 15,
                }}>
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 20 }}>Notifications</div>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
            Tap below to allow notifications. On Android Chrome, you'll get a push notification when rest is over even if the app is in the background. On iOS, the app will beep and vibrate.
          </div>
          <button className="btn-primary" onClick={() => {
            if ('Notification' in window) Notification.requestPermission().then(p => alert(`Notification permission: ${p}`));
            else alert('Notifications not supported on this browser.');
          }}>
            Enable Notifications
          </button>
        </div>

        <div className="section-label" style={{ marginTop: 20 }}>Data</div>
        <div className="card">
          <button onClick={clearAll} style={{
            width: '100%', padding: 14, border: '1px solid var(--danger)', borderRadius: 10,
            background: 'none', color: 'var(--danger)', fontSize: 15, cursor: 'pointer',
          }}>
            Clear All Data
          </button>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>GymTracker v1.0 · PWA</div>
      </div>
    </div>
  );
}
