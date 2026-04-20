export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

export function totalVolume(session: { exercises: Array<{ sets: Array<{ weight: number; reps: number; completed: boolean }> }> }): number {
  return session.exercises.reduce((t, ex) =>
    t + ex.sets.filter(s => s.completed).reduce((sum, s) => sum + s.weight * s.reps, 0), 0);
}

export function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* ignore */ }
}

export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}
