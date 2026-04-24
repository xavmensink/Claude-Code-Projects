import { useEffect, useState } from 'react';
import { PersonalRecord } from '../types';

interface Props {
  prs: PersonalRecord[];
  unit: string;
  onDone: () => void;
}

export default function PRCelebration({ prs, unit, onDone }: Props) {
  const [fading, setFading] = useState(false);
  const pr = prs[0];

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
