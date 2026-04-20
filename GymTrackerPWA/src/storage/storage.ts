import { Exercise, WorkoutTemplate, WorkoutSession, AppSettings } from '../types';

const KEYS = {
  EXERCISES: 'gt_exercises',
  TEMPLATES: 'gt_templates',
  HISTORY: 'gt_history',
  ACTIVE: 'gt_active',
  SETTINGS: 'gt_settings',
};

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function set<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export function getExercises(): Exercise[] {
  return get<Exercise[]>(KEYS.EXERCISES) ?? [];
}

export function saveExercises(exercises: Exercise[]): void {
  set(KEYS.EXERCISES, exercises);
}

export function addExercise(exercise: Exercise): void {
  saveExercises([...getExercises(), exercise]);
}

export function deleteExercise(id: string): void {
  saveExercises(getExercises().filter(e => e.id !== id));
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function getTemplates(): WorkoutTemplate[] {
  return get<WorkoutTemplate[]>(KEYS.TEMPLATES) ?? [];
}

export function upsertTemplate(template: WorkoutTemplate): void {
  const list = getTemplates();
  const idx = list.findIndex(t => t.id === template.id);
  if (idx >= 0) list[idx] = template; else list.push(template);
  set(KEYS.TEMPLATES, list);
}

export function deleteTemplate(id: string): void {
  set(KEYS.TEMPLATES, getTemplates().filter(t => t.id !== id));
}

// ─── History ──────────────────────────────────────────────────────────────────

export function getHistory(): WorkoutSession[] {
  return get<WorkoutSession[]>(KEYS.HISTORY) ?? [];
}

export function saveSession(session: WorkoutSession): void {
  const history = getHistory();
  const idx = history.findIndex(s => s.id === session.id);
  if (idx >= 0) history[idx] = session; else history.unshift(session);
  set(KEYS.HISTORY, history);
}

export function deleteSession(id: string): void {
  set(KEYS.HISTORY, getHistory().filter(s => s.id !== id));
}

// ─── Active Workout ───────────────────────────────────────────────────────────

export function getActiveWorkout(): WorkoutSession | null {
  return get<WorkoutSession>(KEYS.ACTIVE);
}

export function setActiveWorkout(session: WorkoutSession | null): void {
  if (session) set(KEYS.ACTIVE, session);
  else localStorage.removeItem(KEYS.ACTIVE);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULTS: AppSettings = { restTimerDuration: 120, weightUnit: 'kg' };

export function getSettings(): AppSettings {
  return { ...DEFAULTS, ...(get<Partial<AppSettings>>(KEYS.SETTINGS) ?? {}) };
}

export function saveSettings(s: AppSettings): void {
  set(KEYS.SETTINGS, s);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export function seedIfEmpty(): void {
  if (getExercises().length > 0) return;
  const seed: Exercise[] = [
    { id: 'e1',  name: 'Bench Press',             muscleGroup: 'chest',      equipment: 'barbell'    },
    { id: 'e2',  name: 'Incline Bench Press',      muscleGroup: 'chest',      equipment: 'barbell'    },
    { id: 'e3',  name: 'Dumbbell Fly',             muscleGroup: 'chest',      equipment: 'dumbbell'   },
    { id: 'e4',  name: 'Cable Crossover',          muscleGroup: 'chest',      equipment: 'cable'      },
    { id: 'e5',  name: 'Push-up',                  muscleGroup: 'chest',      equipment: 'bodyweight' },
    { id: 'e6',  name: 'Deadlift',                 muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e7',  name: 'Barbell Row',              muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e8',  name: 'Pull-up',                  muscleGroup: 'back',       equipment: 'bodyweight' },
    { id: 'e9',  name: 'Lat Pulldown',             muscleGroup: 'back',       equipment: 'cable'      },
    { id: 'e10', name: 'Seated Cable Row',         muscleGroup: 'back',       equipment: 'cable'      },
    { id: 'e11', name: 'Dumbbell Row',             muscleGroup: 'back',       equipment: 'dumbbell'   },
    { id: 'e12', name: 'Overhead Press',           muscleGroup: 'shoulders',  equipment: 'barbell'    },
    { id: 'e13', name: 'Lateral Raise',            muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e14', name: 'Face Pull',                muscleGroup: 'shoulders',  equipment: 'cable'      },
    { id: 'e15', name: 'Arnold Press',             muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e16', name: 'Barbell Curl',             muscleGroup: 'biceps',     equipment: 'barbell'    },
    { id: 'e17', name: 'Dumbbell Curl',            muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e18', name: 'Hammer Curl',              muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e19', name: 'Cable Curl',               muscleGroup: 'biceps',     equipment: 'cable'      },
    { id: 'e20', name: 'Tricep Pushdown',          muscleGroup: 'triceps',    equipment: 'cable'      },
    { id: 'e21', name: 'Skull Crusher',            muscleGroup: 'triceps',    equipment: 'barbell'    },
    { id: 'e22', name: 'Overhead Tricep Extension',muscleGroup: 'triceps',    equipment: 'dumbbell'   },
    { id: 'e23', name: 'Dip',                      muscleGroup: 'triceps',    equipment: 'bodyweight' },
    { id: 'e24', name: 'Squat',                    muscleGroup: 'quads',      equipment: 'barbell'    },
    { id: 'e25', name: 'Leg Press',                muscleGroup: 'quads',      equipment: 'machine'    },
    { id: 'e26', name: 'Leg Extension',            muscleGroup: 'quads',      equipment: 'machine'    },
    { id: 'e27', name: 'Lunge',                    muscleGroup: 'quads',      equipment: 'dumbbell'   },
    { id: 'e28', name: 'Romanian Deadlift',        muscleGroup: 'hamstrings', equipment: 'barbell'    },
    { id: 'e29', name: 'Leg Curl',                 muscleGroup: 'hamstrings', equipment: 'machine'    },
    { id: 'e30', name: 'Hip Thrust',               muscleGroup: 'glutes',     equipment: 'barbell'    },
    { id: 'e31', name: 'Calf Raise',               muscleGroup: 'calves',     equipment: 'machine'    },
    { id: 'e32', name: 'Plank',                    muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e33', name: 'Cable Crunch',             muscleGroup: 'abs',        equipment: 'cable'      },
    { id: 'e34', name: 'Hanging Leg Raise',        muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e35', name: 'Wrist Curl',               muscleGroup: 'forearms',   equipment: 'barbell'    },
  ];
  saveExercises(seed);
}
