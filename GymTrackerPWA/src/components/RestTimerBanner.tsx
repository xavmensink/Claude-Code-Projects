import { useWorkout } from '../context/WorkoutContext';

export default function RestTimerBanner() {
  const { timer, extendTimer, dismissTimer } = useWorkout();

  if (!timer.isRunning && timer.secondsLeft === 0) return null;

  const m = Math.floor(timer.secondsLeft / 60);
  const s = timer.secondsLeft % 60;
  const timeStr = timer.secondsLeft === 0 ? 'GO! 💪' : `${m}:${String(s).padStart(2, '0')}`;
  const progress = timer.totalSeconds > 0 ? timer.secondsLeft / timer.totalSeconds : 0;
  const urgent = timer.secondsLeft <= 10 && timer.secondsLeft > 0;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'var(--nav-height)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--bg-tertiary)',
      zIndex: 49,
    }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--bg-tertiary)' }}>
        <div style={{
          height: 3,
          width: `${progress * 100}%`,
          background: urgent ? 'var(--accent)' : 'var(--success)',
          transition: 'width 1s linear',
        }} />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
      }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>REST</div>
          <div style={{
            fontSize: 30,
            fontWeight: 800,
            color: urgent ? 'var(--accent)' : 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}>
            {timeStr}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[30, 60].map(n => (
            <button
              key={n}
              onClick={() => extendTimer(n)}
              style={{
                background: 'var(--bg-tertiary)',
                border: 'none',
                color: 'var(--text-primary)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +{n}s
            </button>
          ))}
          <button
            onClick={dismissTimer}
            style={{
              background: 'var(--bg-primary)',
              border: 'none',
              color: 'var(--text-secondary)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
