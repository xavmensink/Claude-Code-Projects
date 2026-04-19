import { WorkoutSession, SetLog } from '../types';

interface Suggestion {
  weight: number;
  direction: 'increase' | 'maintain' | 'decrease' | 'none';
}

function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function getBestSet(sets: SetLog[]): SetLog | null {
  const completed = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (!completed.length) return null;
  return completed.reduce((best, s) =>
    epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps) ? s : best
  );
}

export function getSuggestedWeight(
  exerciseId: string,
  targetReps: number,
  history: WorkoutSession[],
  weightUnit: 'kg' | 'lbs' = 'kg'
): Suggestion | null {
  const increment = weightUnit === 'kg' ? 2.5 : 5;

  const relevantSessions = history
    .filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId))
    .slice(0, 5);

  if (!relevantSessions.length) return null;

  const lastSession = relevantSessions[0];
  const lastExercise = lastSession.exercises.find((e) => e.exerciseId === exerciseId);
  if (!lastExercise) return null;

  const best = getBestSet(lastExercise.sets);
  if (!best) return null;

  const avgRpe =
    lastExercise.sets
      .filter((s) => s.completed && s.rpe != null)
      .reduce((sum, s) => sum + (s.rpe ?? 0), 0) /
    (lastExercise.sets.filter((s) => s.completed && s.rpe != null).length || 1);

  const hitTargetReps = best.reps >= targetReps;

  if (hitTargetReps && (avgRpe <= 7 || isNaN(avgRpe))) {
    return { weight: best.weight + increment, direction: 'increase' };
  } else if (hitTargetReps && avgRpe <= 9) {
    return { weight: best.weight, direction: 'maintain' };
  } else {
    return {
      weight: Math.max(0, Math.round((best.weight * 0.95) / increment) * increment),
      direction: 'decrease',
    };
  }
}

export function getPersonalRecord(
  exerciseId: string,
  history: WorkoutSession[]
): number {
  let best1RM = 0;
  for (const session of history) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    for (const set of ex.sets) {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        const rm = epley1RM(set.weight, set.reps);
        if (rm > best1RM) best1RM = rm;
      }
    }
  }
  return best1RM;
}

export function isPersonalRecord(
  weight: number,
  reps: number,
  exerciseId: string,
  history: WorkoutSession[]
): boolean {
  const current1RM = epley1RM(weight, reps);
  const previous = getPersonalRecord(exerciseId, history);
  return current1RM > previous && previous > 0;
}
