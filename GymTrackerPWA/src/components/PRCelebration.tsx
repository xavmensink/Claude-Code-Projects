import { useEffect, useState, useCallback } from 'react';
import { PersonalRecord } from '../types';

interface Props {
  prs: PersonalRecord[];
  unit: string;
  onDone: () => void;
}

export default function PRCelebration({ prs, unit, onDone }: Props) {
  const [fading, setFading] = useState(false);
  const pr = prs[0];

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(onDone, 400);
  }, [onDone]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1700);
    const doneTimer = setTimeout(onDone, 2100);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.88)',
      animation: fading ? 'prFadeOut 0.4s ease forwards' : 'prFadeIn 0.25s ease',
    }}>
      {/* Close button */}
      <button
        onClick={dismiss}
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 36, height: 36, borderRadius: 18,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div style={{
        textAlign: 'center',
        padding: '40px 32px',
        animation: 'prScaleUp 0.45s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 80, animation: 'prPulse 0.8s ease-in-out infinite', display: 'inline-block' }}>🏆</div>
        <div style={{
          fontSize: 36, fontWeight: 900, color: '#FFD700',
          letterSpacing: 3, marginTop: 12, textShadow: '0 0 24px rgba(255,215,0,0.6)',
        }}>
          NEW PR!
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 10 }}>
          {pr.exerciseName}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#FFD700', marginTop: 6 }}>
          {pr.weight}{unit} × {pr.reps} reps
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
          {pr.prType === 'weight' ? '🔥 Heaviest weight ever!' : `💪 Most reps at ${pr.weight}${unit}!`}
        </div>
      </div>
    </div>
  );
}
