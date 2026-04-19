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

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function totalVolume(session: { exercises: Array<{ sets: Array<{ weight: number; reps: number; completed: boolean }> }> }): number {
  return session.exercises.reduce((total, ex) =>
    total + ex.sets.filter((s) => s.completed).reduce((sum, s) => sum + s.weight * s.reps, 0), 0);
}
