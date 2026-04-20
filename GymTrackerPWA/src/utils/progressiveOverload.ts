import { WorkoutSession, SetLog } from '../types';

function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function getBestSet(sets: SetLog[]): SetLog | null {
  const done = sets.filter(s => s.completed && s.weight > 0 && s.reps > 0);
  if (!done.length) return null;
  return done.reduce((best, s) =>
    epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps) ? s : best);
}

export interface Suggestion {
  weight: number;
  direction: 'increase' | 'maintain' | 'decrease';
}

export function getSuggestedWeight(
  exerciseId: string,
  targetReps: number,
  history: WorkoutSession[],
  unit: 'kg' | 'lbs' = 'kg',
): Suggestion | null {
  const increment = unit === 'kg' ? 2.5 : 5;
  const relevant = history.filter(s => s.exercises.some(e => e.exerciseId === exerciseId));
  if (!relevant.length) return null;

  const lastEx = relevant[0].exercises.find(e => e.exerciseId === exerciseId);
  if (!lastEx) return null;

  const best = getBestSet(lastEx.sets);
  if (!best) return null;

  const completedSets = lastEx.sets.filter(s => s.completed && s.rpe != null);
  const avgRpe = completedSets.length
    ? completedSets.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / completedSets.length
    : NaN;

  const hitTarget = best.reps >= targetReps;

  if (hitTarget && (isNaN(avgRpe) || avgRpe <= 7)) {
    return { weight: best.weight + increment, direction: 'increase' };
  } else if (hitTarget && avgRpe <= 9) {
    return { weight: best.weight, direction: 'maintain' };
  } else {
    return {
      weight: Math.max(0, Math.round((best.weight * 0.95) / increment) * increment),
      direction: 'decrease',
    };
  }
}

export function getPR(exerciseId: string, history: WorkoutSession[]): number {
  let best = 0;
  for (const s of history) {
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.completed && set.weight > 0 && set.reps > 0) {
          const rm = epley1RM(set.weight, set.reps);
          if (rm > best) best = rm;
        }
      }
    }
  }
  return best;
}

export function isPR(weight: number, reps: number, exerciseId: string, history: WorkoutSession[]): boolean {
  const prev = getPR(exerciseId, history);
  return prev > 0 && epley1RM(weight, reps) > prev;
}
