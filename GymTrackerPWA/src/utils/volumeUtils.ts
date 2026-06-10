import { WorkoutSession } from '../types';
import { getExercises } from '../storage/storage';

export const VOLUME_GROUPS = [
  { label: 'Chest',     muscles: ['chest']                                   },
  { label: 'Back',      muscles: ['back']                                    },
  { label: 'Shoulders', muscles: ['shoulders']                               },
  { label: 'Biceps',    muscles: ['biceps']                                  },
  { label: 'Triceps',   muscles: ['triceps']                                 },
  { label: 'Legs',      muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Core',      muscles: ['abs']                                     },
  { label: 'Forearms',  muscles: ['forearms']                                },
] as const;

// Returns { start, end } timestamps for the Mon–Sun week at offsetWeeks from current
export function getWeekRange(offsetWeeks = 0): { start: number; end: number; label: string } {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun ... 6=Sat
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(today);
  mon.setDate(today.getDate() + daysToMon + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { start: mon.getTime(), end: sun.getTime(), label: `${fmt(mon)} – ${fmt(sun)}` };
}

// Returns a map of muscleGroup → completed set count for the given week offset.
// Primary muscle counts 1 set, each secondary muscle counts 0.5.
export function computeWeeklyVolume(
  history: WorkoutSession[],
  offsetWeeks = 0,
): Record<string, number> {
  const exercises = getExercises();
  const exMap = new Map(exercises.map(e => [e.id, e]));
  const { start, end } = getWeekRange(offsetWeeks);
  const counts: Record<string, number> = {};

  for (const session of history) {
    if (session.startTime < start || session.startTime > end) continue;
    for (const exLog of session.exercises) {
      const ex = exMap.get(exLog.exerciseId);
      if (!ex) continue;
      const done = exLog.sets.filter(s => s.completed).length;
      if (!done) continue;
      counts[ex.muscleGroup] = (counts[ex.muscleGroup] ?? 0) + done;
      for (const mg of ex.secondaryMuscleGroups ?? []) {
        counts[mg] = (counts[mg] ?? 0) + done * 0.5;
      }
    }
  }
  return counts;
}

// Display helper: 12 → "12", 12.5 → "12.5"
export function formatSets(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
