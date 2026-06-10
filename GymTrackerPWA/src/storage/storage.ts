import { Exercise, MuscleGroup, WorkoutTemplate, WorkoutSession, AppSettings, WeekSchedule, PersonalRecord, UserProfile, BodyweightEntry } from '../types';
import { generateId } from '../utils/helpers';

const KEYS = {
  EXERCISES: 'gt_exercises',
  TEMPLATES: 'gt_templates',
  HISTORY: 'gt_history',
  ACTIVE: 'gt_active',
  SETTINGS: 'gt_settings',
  SCHEDULE: 'gt_schedule',
  PERSONAL_RECORDS: 'gt_prs',
  PROFILE: 'gt_profile',
  BODYWEIGHT: 'gt_bodyweight',
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

// ─── Week Schedule ────────────────────────────────────────────────────────────

export function getSchedule(): WeekSchedule {
  return get<WeekSchedule>(KEYS.SCHEDULE) ?? {};
}

export function saveSchedule(schedule: WeekSchedule): void {
  set(KEYS.SCHEDULE, schedule);
}

export function setScheduledDay(day: 0|1|2|3|4|5|6, templateId: string, templateName: string): void {
  const schedule = getSchedule();
  schedule[day] = { templateId, templateName };
  saveSchedule(schedule);
}

export function clearScheduledDay(day: 0|1|2|3|4|5|6): void {
  const schedule = getSchedule();
  delete schedule[day];
  saveSchedule(schedule);
}

// ─── Personal Records ─────────────────────────────────────────────────────────

export function getPRs(): PersonalRecord[] {
  return get<PersonalRecord[]>(KEYS.PERSONAL_RECORDS) ?? [];
}

export function savePRs(prs: PersonalRecord[]): void {
  set(KEYS.PERSONAL_RECORDS, prs);
}

export function deletePRs(ids: string[]): void {
  if (!ids.length) return;
  const idSet = new Set(ids);
  savePRs(getPRs().filter(p => !idSet.has(p.id)));
}

export function checkForNewPRs(
  exerciseId: string,
  exerciseName: string,
  weight: number,
  reps: number,
): PersonalRecord[] {
  if (!weight || !reps) return [];
  const existing = getPRs().filter(p => p.exerciseId === exerciseId);

  const bestWeight = existing
    .filter(p => p.prType === 'weight')
    .reduce((max, p) => Math.max(max, p.weight), 0);

  if (weight > bestWeight) {
    const pr: PersonalRecord = { id: generateId(), exerciseId, exerciseName, weight, reps, achievedAt: Date.now(), prType: 'weight' };
    savePRs([...getPRs(), pr]);
    return [pr];
  }

  // Reps PR: more reps than any previous completed set at this weight or heavier.
  // Only fires when prior sets exist at >= this weight (the weight PR covers the rest).
  let bestReps = 0;
  let hasPrior = false;
  for (const session of getHistory()) {
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.completed && set.weight >= weight && set.reps > 0) {
          hasPrior = true;
          if (set.reps > bestReps) bestReps = set.reps;
        }
      }
    }
  }
  // PRs recorded earlier in the current session aren't in history yet
  for (const p of existing) {
    if (p.weight >= weight) {
      hasPrior = true;
      if (p.reps > bestReps) bestReps = p.reps;
    }
  }

  if (hasPrior && reps > bestReps) {
    const pr: PersonalRecord = { id: generateId(), exerciseId, exerciseName, weight, reps, achievedAt: Date.now(), prType: 'reps' };
    savePRs([...getPRs(), pr]);
    return [pr];
  }
  return [];
}

export function getExercisePRSummary(exerciseId: string): { weightPR: PersonalRecord | null } {
  const prs = getPRs().filter(p => p.exerciseId === exerciseId && p.prType === 'weight');
  const weightPR = prs.sort((a, b) => b.weight - a.weight)[0] ?? null;
  return { weightPR };
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export function getProfile(): UserProfile | null {
  return get<UserProfile>(KEYS.PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  set(KEYS.PROFILE, profile);
}

// ─── Bodyweight Log ───────────────────────────────────────────────────────────

export function getBodyweightLog(): BodyweightEntry[] {
  return get<BodyweightEntry[]>(KEYS.BODYWEIGHT) ?? [];
}

// One entry per calendar day — logging again the same day replaces it
export function logBodyweight(weightKg: number): void {
  const log = getBodyweightLog();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const idx = log.findIndex(e => {
    const d = new Date(e.date); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });
  const entry: BodyweightEntry = { date: Date.now(), weightKg };
  if (idx >= 0) log[idx] = entry; else log.push(entry);
  set(KEYS.BODYWEIGHT, log);
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────

export function exportAllData(): void {
  const payload = {
    version: 4,
    exportedAt: Date.now(),
    exercises:  getExercises(),
    templates:  getTemplates(),
    history:    getHistory(),
    settings:   getSettings(),
    schedule:   getSchedule(),
    prs:        getPRs(),
    profile:    getProfile(),
    bodyweight: getBodyweightLog(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gymtracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importAllData(jsonText: string): void {
  const d = JSON.parse(jsonText);
  if (d.exercises && Array.isArray(d.exercises))  saveExercises(d.exercises);
  if (d.templates && Array.isArray(d.templates))  set(KEYS.TEMPLATES,        d.templates);
  if (d.history   && Array.isArray(d.history))    set(KEYS.HISTORY,          d.history);
  if (d.settings  && typeof d.settings === 'object') set(KEYS.SETTINGS,      d.settings);
  if (d.schedule  && typeof d.schedule === 'object') set(KEYS.SCHEDULE,      d.schedule);
  if (d.prs       && Array.isArray(d.prs))        set(KEYS.PERSONAL_RECORDS, d.prs);
  if (d.profile   && typeof d.profile === 'object') set(KEYS.PROFILE,        d.profile);
  if (d.bodyweight && Array.isArray(d.bodyweight)) set(KEYS.BODYWEIGHT,      d.bodyweight);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export function seedIfEmpty(): void {
  if (getExercises().length > 0) return;
  const seed: Exercise[] = [
    // ── Chest ──────────────────────────────────────────────────────────────────
    { id: 'e1',  name: 'Bench Press',                muscleGroup: 'chest',      equipment: 'barbell'    },
    { id: 'e2',  name: 'Incline Bench Press',         muscleGroup: 'chest',      equipment: 'barbell'    },
    { id: 'e3',  name: 'Decline Bench Press',         muscleGroup: 'chest',      equipment: 'barbell'    },
    { id: 'e4',  name: 'Dumbbell Bench Press',        muscleGroup: 'chest',      equipment: 'dumbbell'   },
    { id: 'e5',  name: 'Incline Dumbbell Press',      muscleGroup: 'chest',      equipment: 'dumbbell'   },
    { id: 'e6',  name: 'Dumbbell Fly',                muscleGroup: 'chest',      equipment: 'dumbbell'   },
    { id: 'e7',  name: 'Incline Dumbbell Fly',        muscleGroup: 'chest',      equipment: 'dumbbell'   },
    { id: 'e8',  name: 'Cable Crossover',             muscleGroup: 'chest',      equipment: 'cable'      },
    { id: 'e9',  name: 'Low Cable Fly',               muscleGroup: 'chest',      equipment: 'cable'      },
    { id: 'e10', name: 'High Cable Fly',              muscleGroup: 'chest',      equipment: 'cable'      },
    { id: 'e11', name: 'Pec Deck',                    muscleGroup: 'chest',      equipment: 'machine'    },
    { id: 'e12', name: 'Push-up',                     muscleGroup: 'chest',      equipment: 'bodyweight' },
    { id: 'e13', name: 'Chest Dip',                   muscleGroup: 'chest',      equipment: 'bodyweight' },
    // ── Back ───────────────────────────────────────────────────────────────────
    { id: 'e14', name: 'Deadlift',                    muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e15', name: 'Sumo Deadlift',               muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e16', name: 'Rack Pull',                   muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e17', name: 'Barbell Row',                 muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e18', name: 'T-Bar Row',                   muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e19', name: 'Meadows Row',                 muscleGroup: 'back',       equipment: 'barbell'    },
    { id: 'e20', name: 'Dumbbell Row',                muscleGroup: 'back',       equipment: 'dumbbell'   },
    { id: 'e21', name: 'Pull-up',                     muscleGroup: 'back',       equipment: 'bodyweight' },
    { id: 'e22', name: 'Chin-up',                     muscleGroup: 'back',       equipment: 'bodyweight' },
    { id: 'e23', name: 'Lat Pulldown',                muscleGroup: 'back',       equipment: 'cable'      },
    { id: 'e24', name: 'Seated Cable Row',            muscleGroup: 'back',       equipment: 'cable'      },
    { id: 'e25', name: 'Single Arm Cable Row',        muscleGroup: 'back',       equipment: 'cable'      },
    { id: 'e26', name: 'Straight Arm Pulldown',       muscleGroup: 'back',       equipment: 'cable'      },
    { id: 'e27', name: 'Chest-Supported Row',         muscleGroup: 'back',       equipment: 'machine'    },
    // ── Shoulders ──────────────────────────────────────────────────────────────
    { id: 'e28', name: 'Overhead Press',              muscleGroup: 'shoulders',  equipment: 'barbell'    },
    { id: 'e29', name: 'Seated Dumbbell Press',       muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e30', name: 'Arnold Press',                muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e31', name: 'Lateral Raise',               muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e32', name: 'Front Raise',                 muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e33', name: 'Rear Delt Fly',               muscleGroup: 'shoulders',  equipment: 'dumbbell'   },
    { id: 'e34', name: 'Upright Row',                 muscleGroup: 'shoulders',  equipment: 'barbell'    },
    { id: 'e35', name: 'Cable Lateral Raise',         muscleGroup: 'shoulders',  equipment: 'cable'      },
    { id: 'e36', name: 'Face Pull',                   muscleGroup: 'shoulders',  equipment: 'cable'      },
    { id: 'e37', name: 'Rear Delt Cable Fly',         muscleGroup: 'shoulders',  equipment: 'cable'      },
    { id: 'e38', name: 'Machine Shoulder Press',      muscleGroup: 'shoulders',  equipment: 'machine'    },
    { id: 'e39', name: 'Machine Lateral Raise',       muscleGroup: 'shoulders',  equipment: 'machine'    },
    // ── Biceps ─────────────────────────────────────────────────────────────────
    { id: 'e40', name: 'Barbell Curl',                muscleGroup: 'biceps',     equipment: 'barbell'    },
    { id: 'e41', name: 'EZ-Bar Curl',                 muscleGroup: 'biceps',     equipment: 'barbell'    },
    { id: 'e42', name: 'Preacher Curl',               muscleGroup: 'biceps',     equipment: 'barbell'    },
    { id: 'e43', name: 'Dumbbell Curl',               muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e44', name: 'Hammer Curl',                 muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e45', name: 'Incline Dumbbell Curl',       muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e46', name: 'Concentration Curl',          muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e47', name: 'Spider Curl',                 muscleGroup: 'biceps',     equipment: 'dumbbell'   },
    { id: 'e48', name: 'Cable Curl',                  muscleGroup: 'biceps',     equipment: 'cable'      },
    { id: 'e49', name: 'Cable Rope Curl',             muscleGroup: 'biceps',     equipment: 'cable'      },
    // ── Triceps ────────────────────────────────────────────────────────────────
    { id: 'e50', name: 'Close Grip Bench Press',      muscleGroup: 'triceps',    equipment: 'barbell'    },
    { id: 'e51', name: 'Skull Crusher',               muscleGroup: 'triceps',    equipment: 'barbell'    },
    { id: 'e52', name: 'Overhead Tricep Extension',   muscleGroup: 'triceps',    equipment: 'dumbbell'   },
    { id: 'e53', name: 'Tricep Kickback',             muscleGroup: 'triceps',    equipment: 'dumbbell'   },
    { id: 'e54', name: 'Tricep Pushdown',             muscleGroup: 'triceps',    equipment: 'cable'      },
    { id: 'e55', name: 'Rope Pushdown',               muscleGroup: 'triceps',    equipment: 'cable'      },
    { id: 'e56', name: 'Single Arm Pushdown',         muscleGroup: 'triceps',    equipment: 'cable'      },
    { id: 'e57', name: 'Overhead Cable Extension',    muscleGroup: 'triceps',    equipment: 'cable'      },
    { id: 'e58', name: 'Tricep Dip',                  muscleGroup: 'triceps',    equipment: 'bodyweight' },
    { id: 'e59', name: 'Diamond Push-up',             muscleGroup: 'triceps',    equipment: 'bodyweight' },
    // ── Quads ──────────────────────────────────────────────────────────────────
    { id: 'e60', name: 'Squat',                       muscleGroup: 'quads',      equipment: 'barbell'    },
    { id: 'e61', name: 'Front Squat',                 muscleGroup: 'quads',      equipment: 'barbell'    },
    { id: 'e62', name: 'Hack Squat',                  muscleGroup: 'quads',      equipment: 'machine'    },
    { id: 'e63', name: 'Leg Press',                   muscleGroup: 'quads',      equipment: 'machine'    },
    { id: 'e64', name: 'Leg Extension',               muscleGroup: 'quads',      equipment: 'machine'    },
    { id: 'e65', name: 'Goblet Squat',                muscleGroup: 'quads',      equipment: 'dumbbell'   },
    { id: 'e66', name: 'Dumbbell Lunge',              muscleGroup: 'quads',      equipment: 'dumbbell'   },
    { id: 'e67', name: 'Bulgarian Split Squat',       muscleGroup: 'quads',      equipment: 'dumbbell'   },
    { id: 'e68', name: 'Step Up',                     muscleGroup: 'quads',      equipment: 'dumbbell'   },
    { id: 'e69', name: 'Walking Lunge',               muscleGroup: 'quads',      equipment: 'bodyweight' },
    // ── Hamstrings ─────────────────────────────────────────────────────────────
    { id: 'e70', name: 'Romanian Deadlift',           muscleGroup: 'hamstrings', equipment: 'barbell'    },
    { id: 'e71', name: 'Stiff Leg Deadlift',          muscleGroup: 'hamstrings', equipment: 'barbell'    },
    { id: 'e72', name: 'Lying Leg Curl',              muscleGroup: 'hamstrings', equipment: 'machine'    },
    { id: 'e73', name: 'Seated Leg Curl',             muscleGroup: 'hamstrings', equipment: 'machine'    },
    { id: 'e74', name: 'Nordic Curl',                 muscleGroup: 'hamstrings', equipment: 'bodyweight' },
    { id: 'e75', name: 'Glute Ham Raise',             muscleGroup: 'hamstrings', equipment: 'bodyweight' },
    // ── Glutes ─────────────────────────────────────────────────────────────────
    { id: 'e76', name: 'Hip Thrust',                  muscleGroup: 'glutes',     equipment: 'barbell'    },
    { id: 'e77', name: 'Glute Bridge',                muscleGroup: 'glutes',     equipment: 'bodyweight' },
    { id: 'e78', name: 'Cable Kickback',              muscleGroup: 'glutes',     equipment: 'cable'      },
    { id: 'e79', name: 'Abduction Machine',           muscleGroup: 'glutes',     equipment: 'machine'    },
    { id: 'e80', name: 'Sumo Squat',                  muscleGroup: 'glutes',     equipment: 'dumbbell'   },
    { id: 'e81', name: 'Donkey Kicks',                muscleGroup: 'glutes',     equipment: 'bodyweight' },
    // ── Calves ─────────────────────────────────────────────────────────────────
    { id: 'e82', name: 'Standing Calf Raise',         muscleGroup: 'calves',     equipment: 'machine'    },
    { id: 'e83', name: 'Seated Calf Raise',           muscleGroup: 'calves',     equipment: 'machine'    },
    { id: 'e84', name: 'Donkey Calf Raise',           muscleGroup: 'calves',     equipment: 'machine'    },
    { id: 'e85', name: 'Single Leg Calf Raise',       muscleGroup: 'calves',     equipment: 'bodyweight' },
    { id: 'e86', name: 'Leg Press Calf Raise',        muscleGroup: 'calves',     equipment: 'machine'    },
    // ── Abs ────────────────────────────────────────────────────────────────────
    { id: 'e87', name: 'Plank',                       muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e88', name: 'Crunch',                      muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e89', name: 'Sit-up',                      muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e90', name: 'Hanging Leg Raise',           muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e91', name: 'Leg Raise',                   muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e92', name: 'Bicycle Crunch',              muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e93', name: 'Russian Twist',               muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e94', name: 'Ab Wheel Rollout',            muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e95', name: 'Dead Bug',                    muscleGroup: 'abs',        equipment: 'bodyweight' },
    { id: 'e96', name: 'Cable Crunch',                muscleGroup: 'abs',        equipment: 'cable'      },
    { id: 'e97', name: 'Decline Crunch',              muscleGroup: 'abs',        equipment: 'bodyweight' },
    // ── Forearms ───────────────────────────────────────────────────────────────
    { id: 'e98', name: 'Wrist Curl',                  muscleGroup: 'forearms',   equipment: 'barbell'    },
    { id: 'e99', name: 'Reverse Wrist Curl',          muscleGroup: 'forearms',   equipment: 'barbell'    },
    { id: 'e100',name: 'Reverse Curl',                muscleGroup: 'forearms',   equipment: 'barbell'    },
    { id: 'e101',name: 'Farmer\'s Walk',              muscleGroup: 'forearms',   equipment: 'dumbbell'   },
    { id: 'e102',name: 'Plate Pinch',                 muscleGroup: 'forearms',   equipment: 'dumbbell'   },
  ];
  saveExercises(seed);
}

// Adds secondaryMuscleGroups to existing exercises and appends any new seed exercises.
export function migrateExercises(): void {
  const current = getExercises();

  // ── A) Secondary muscle group lookup by exercise ID ───────────────────────
  const secondaryMap: Record<string, MuscleGroup[]> = {
    e1:   ['triceps','shoulders'],
    e2:   ['triceps','shoulders'],
    e3:   ['triceps'],
    e4:   ['triceps','shoulders'],
    e5:   ['triceps','shoulders'],
    e6:   [],
    e7:   [],
    e8:   [],
    e9:   [],
    e10:  [],
    e11:  [],
    e12:  ['triceps','shoulders'],
    e13:  ['triceps'],
    e14:  ['hamstrings','glutes','forearms'],
    e15:  ['glutes','hamstrings','quads'],
    e16:  ['forearms'],
    e17:  ['biceps','forearms'],
    e18:  ['biceps'],
    e19:  ['biceps'],
    e20:  ['biceps'],
    e21:  ['biceps'],
    e22:  ['biceps'],
    e23:  ['biceps'],
    e24:  ['biceps'],
    e25:  ['biceps'],
    e26:  [],
    e27:  ['biceps'],
    e28:  ['triceps'],
    e29:  ['triceps'],
    e30:  ['triceps'],
    e31:  [],
    e32:  [],
    e33:  [],
    e34:  ['biceps','forearms'],
    e35:  [],
    e36:  ['back'],
    e37:  [],
    e38:  ['triceps'],
    e39:  [],
    e40:  ['forearms'],
    e41:  ['forearms'],
    e42:  [],
    e43:  ['forearms'],
    e44:  ['forearms'],
    e45:  [],
    e46:  [],
    e47:  [],
    e48:  ['forearms'],
    e49:  ['forearms'],
    e50:  ['chest','shoulders'],
    e51:  [],
    e52:  [],
    e53:  [],
    e54:  [],
    e55:  [],
    e56:  [],
    e57:  [],
    e58:  ['chest','shoulders'],
    e59:  ['chest'],
    e60:  ['glutes','hamstrings'],
    e61:  ['glutes'],
    e62:  ['glutes'],
    e63:  ['glutes','hamstrings'],
    e64:  [],
    e65:  ['glutes'],
    e66:  ['glutes','hamstrings'],
    e67:  ['glutes','hamstrings'],
    e68:  ['glutes'],
    e69:  ['glutes','hamstrings'],
    e70:  ['glutes','back'],
    e71:  ['glutes','back'],
    e72:  [],
    e73:  [],
    e74:  ['glutes'],
    e75:  ['glutes'],
    e76:  ['hamstrings'],
    e77:  ['hamstrings'],
    e78:  [],
    e79:  [],
    e80:  ['quads','hamstrings'],
    e81:  [],
    e82:  [],
    e83:  [],
    e84:  [],
    e85:  [],
    e86:  [],
    e87:  [],
    e88:  [],
    e89:  [],
    e90:  ['forearms'],
    e91:  [],
    e92:  [],
    e93:  [],
    e94:  ['shoulders','back'],
    e95:  [],
    e96:  [],
    e97:  [],
    e98:  [],
    e99:  [],
    e100: ['biceps'],
    e101: ['back','shoulders'],
    e102: [],
  };

  // ── B) New exercises to append ────────────────────────────────────────────
  const newExercises: Exercise[] = [
    // Chest
    { id: 'e103', name: 'Machine Chest Press',        muscleGroup: 'chest',      equipment: 'machine',    secondaryMuscleGroups: ['triceps','shoulders'] },
    { id: 'e104', name: 'Landmine Press',              muscleGroup: 'chest',      equipment: 'barbell',    secondaryMuscleGroups: ['shoulders','triceps'] },
    { id: 'e105', name: 'Smith Machine Bench',         muscleGroup: 'chest',      equipment: 'machine',    secondaryMuscleGroups: ['triceps','shoulders'] },
    { id: 'e106', name: 'Chest Squeeze Press',         muscleGroup: 'chest',      equipment: 'dumbbell',   secondaryMuscleGroups: ['triceps'] },
    // Back
    { id: 'e107', name: 'Pendlay Row',                 muscleGroup: 'back',       equipment: 'barbell',    secondaryMuscleGroups: ['biceps'] },
    { id: 'e108', name: 'Inverted Row',                muscleGroup: 'back',       equipment: 'bodyweight', secondaryMuscleGroups: ['biceps'] },
    { id: 'e109', name: 'Seal Row',                    muscleGroup: 'back',       equipment: 'dumbbell',   secondaryMuscleGroups: ['biceps'] },
    { id: 'e110', name: 'Machine Row',                 muscleGroup: 'back',       equipment: 'machine',    secondaryMuscleGroups: ['biceps'] },
    { id: 'e111', name: 'Wide Grip Pulldown',          muscleGroup: 'back',       equipment: 'cable',      secondaryMuscleGroups: ['biceps'] },
    { id: 'e112', name: 'Close Grip Pulldown',         muscleGroup: 'back',       equipment: 'cable',      secondaryMuscleGroups: ['biceps'] },
    { id: 'e113', name: 'Good Morning',                muscleGroup: 'back',       equipment: 'barbell',    secondaryMuscleGroups: ['hamstrings','glutes'] },
    { id: 'e114', name: 'Single Arm Pulldown',         muscleGroup: 'back',       equipment: 'cable',      secondaryMuscleGroups: ['biceps'] },
    { id: 'e115', name: 'Banded Pull Apart',           muscleGroup: 'back',       equipment: 'bodyweight', secondaryMuscleGroups: [] },
    // Shoulders
    { id: 'e116', name: 'Push Press',                  muscleGroup: 'shoulders',  equipment: 'barbell',    secondaryMuscleGroups: ['triceps','quads'] },
    { id: 'e117', name: 'Cable Front Raise',            muscleGroup: 'shoulders',  equipment: 'cable',      secondaryMuscleGroups: [] },
    { id: 'e118', name: 'Machine Rear Delt Fly',        muscleGroup: 'shoulders',  equipment: 'machine',    secondaryMuscleGroups: [] },
    { id: 'e119', name: 'Dumbbell Shrug',               muscleGroup: 'shoulders',  equipment: 'dumbbell',   secondaryMuscleGroups: ['back'] },
    { id: 'e120', name: 'Barbell Shrug',                muscleGroup: 'shoulders',  equipment: 'barbell',    secondaryMuscleGroups: ['back'] },
    { id: 'e121', name: 'Plate Front Raise',            muscleGroup: 'shoulders',  equipment: 'dumbbell',   secondaryMuscleGroups: [] },
    // Biceps
    { id: 'e122', name: 'EZ-Bar Preacher Curl',         muscleGroup: 'biceps',     equipment: 'barbell',    secondaryMuscleGroups: [] },
    { id: 'e123', name: 'Machine Curl',                 muscleGroup: 'biceps',     equipment: 'machine',    secondaryMuscleGroups: [] },
    { id: 'e124', name: 'Bayesian Curl',                muscleGroup: 'biceps',     equipment: 'cable',      secondaryMuscleGroups: [] },
    { id: 'e125', name: 'Zottman Curl',                 muscleGroup: 'biceps',     equipment: 'dumbbell',   secondaryMuscleGroups: ['forearms'] },
    { id: 'e126', name: 'Cross Body Hammer Curl',       muscleGroup: 'biceps',     equipment: 'dumbbell',   secondaryMuscleGroups: ['forearms'] },
    // Triceps
    { id: 'e127', name: 'JM Press',                     muscleGroup: 'triceps',    equipment: 'barbell',    secondaryMuscleGroups: ['shoulders'] },
    { id: 'e128', name: 'Tate Press',                   muscleGroup: 'triceps',    equipment: 'dumbbell',   secondaryMuscleGroups: [] },
    { id: 'e129', name: 'EZ-Bar Overhead Extension',    muscleGroup: 'triceps',    equipment: 'barbell',    secondaryMuscleGroups: [] },
    { id: 'e130', name: 'Machine Tricep Extension',     muscleGroup: 'triceps',    equipment: 'machine',    secondaryMuscleGroups: [] },
    { id: 'e131', name: 'Reverse Grip Pushdown',        muscleGroup: 'triceps',    equipment: 'cable',      secondaryMuscleGroups: [] },
    // Quads
    { id: 'e132', name: 'Sissy Squat',                  muscleGroup: 'quads',      equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e133', name: 'Reverse Lunge',                muscleGroup: 'quads',      equipment: 'bodyweight', secondaryMuscleGroups: ['glutes'] },
    { id: 'e134', name: 'Belt Squat',                   muscleGroup: 'quads',      equipment: 'machine',    secondaryMuscleGroups: ['glutes'] },
    { id: 'e135', name: 'Cyclist Squat',                muscleGroup: 'quads',      equipment: 'barbell',    secondaryMuscleGroups: [] },
    { id: 'e136', name: 'Smith Machine Squat',          muscleGroup: 'quads',      equipment: 'machine',    secondaryMuscleGroups: ['glutes','hamstrings'] },
    { id: 'e137', name: 'Barbell Lunge',                muscleGroup: 'quads',      equipment: 'barbell',    secondaryMuscleGroups: ['glutes','hamstrings'] },
    { id: 'e138', name: 'Wall Sit',                     muscleGroup: 'quads',      equipment: 'bodyweight', secondaryMuscleGroups: [] },
    // Hamstrings
    { id: 'e139', name: 'Single Leg RDL',               muscleGroup: 'hamstrings', equipment: 'dumbbell',   secondaryMuscleGroups: ['glutes'] },
    { id: 'e140', name: 'Cable RDL',                    muscleGroup: 'hamstrings', equipment: 'cable',      secondaryMuscleGroups: ['glutes'] },
    { id: 'e141', name: 'Dumbbell RDL',                 muscleGroup: 'hamstrings', equipment: 'dumbbell',   secondaryMuscleGroups: ['glutes'] },
    { id: 'e142', name: 'Swiss Ball Leg Curl',           muscleGroup: 'hamstrings', equipment: 'bodyweight', secondaryMuscleGroups: ['glutes'] },
    { id: 'e143', name: 'Cable Hamstring Curl',          muscleGroup: 'hamstrings', equipment: 'cable',      secondaryMuscleGroups: [] },
    // Glutes
    { id: 'e144', name: 'Single Leg Hip Thrust',        muscleGroup: 'glutes',     equipment: 'bodyweight', secondaryMuscleGroups: ['hamstrings'] },
    { id: 'e145', name: 'Frog Pump',                    muscleGroup: 'glutes',     equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e146', name: 'Kneeling Squat',               muscleGroup: 'glutes',     equipment: 'barbell',    secondaryMuscleGroups: ['hamstrings'] },
    { id: 'e147', name: 'X-Band Walk',                  muscleGroup: 'glutes',     equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e148', name: 'Clamshell',                    muscleGroup: 'glutes',     equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e149', name: 'Smith Machine Hip Thrust',     muscleGroup: 'glutes',     equipment: 'machine',    secondaryMuscleGroups: ['hamstrings'] },
    { id: 'e150', name: 'Dumbbell Hip Thrust',          muscleGroup: 'glutes',     equipment: 'dumbbell',   secondaryMuscleGroups: ['hamstrings'] },
    // Calves
    { id: 'e151', name: 'Smith Machine Calf Raise',     muscleGroup: 'calves',     equipment: 'machine',    secondaryMuscleGroups: [] },
    { id: 'e152', name: 'Cable Calf Raise',             muscleGroup: 'calves',     equipment: 'cable',      secondaryMuscleGroups: [] },
    // Abs
    { id: 'e153', name: 'Dragon Flag',                  muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e154', name: 'Hollow Body Hold',             muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e155', name: 'V-Up',                         muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e156', name: 'Oblique Crunch',               muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e157', name: 'Side Plank',                   muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e158', name: 'Pallof Press',                 muscleGroup: 'abs',        equipment: 'cable',      secondaryMuscleGroups: [] },
    { id: 'e159', name: 'Landmine Twist',               muscleGroup: 'abs',        equipment: 'barbell',    secondaryMuscleGroups: ['shoulders'] },
    { id: 'e160', name: 'Toe Touch',                    muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e161', name: 'Flutter Kicks',                muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e162', name: 'Mountain Climber',             muscleGroup: 'abs',        equipment: 'bodyweight', secondaryMuscleGroups: ['shoulders'] },
    // Forearms
    { id: 'e163', name: 'Wrist Roller',                 muscleGroup: 'forearms',   equipment: 'bodyweight', secondaryMuscleGroups: [] },
    { id: 'e164', name: 'Behind-Back Wrist Curl',       muscleGroup: 'forearms',   equipment: 'barbell',    secondaryMuscleGroups: [] },
    { id: 'e165', name: 'Towel Pull-up',                muscleGroup: 'forearms',   equipment: 'bodyweight', secondaryMuscleGroups: ['back','biceps'] },
  ];

  // ── Apply secondaryMuscleGroups to existing exercises where missing ────────
  let changed = false;
  const updated = current.map(e => {
    if (e.secondaryMuscleGroups !== undefined) return e;
    if (!(e.id in secondaryMap)) return e;
    changed = true;
    return { ...e, secondaryMuscleGroups: secondaryMap[e.id] };
  });

  // ── Append new exercises not yet present ──────────────────────────────────
  const existingIds = new Set(updated.map(e => e.id));
  const toAdd = newExercises.filter(e => !existingIds.has(e.id));
  if (toAdd.length > 0) changed = true;

  if (!changed) return;
  saveExercises([...updated, ...toAdd]);
}

// ─── Jeff Nippard Fundamentals Templates ─────────────────────────────────────

export function seedJeffNippardTemplates(): void {
  const FLAG = 'gt_seeded_jn_fundamentals_v1';
  if (localStorage.getItem(FLAG)) return;

  const templates: WorkoutTemplate[] = [
    {
      id: 'jn_lower1',
      name: 'Lower Body #1',
      description: "Jeff Nippard — Fundamentals Program",
      exercises: [
        { exerciseId: 'e60', exerciseName: 'Squat',                  targetSets: 3, targetReps: 6  },
        { exerciseId: 'e70', exerciseName: 'Romanian Deadlift',       targetSets: 3, targetReps: 10 },
        { exerciseId: 'e76', exerciseName: 'Hip Thrust',              targetSets: 3, targetReps: 12 },
        { exerciseId: 'e64', exerciseName: 'Leg Extension',           targetSets: 3, targetReps: 12 },
        { exerciseId: 'e72', exerciseName: 'Lying Leg Curl',          targetSets: 3, targetReps: 12 },
        { exerciseId: 'e79', exerciseName: 'Abduction Machine',       targetSets: 3, targetReps: 6  },
        { exerciseId: 'e88', exerciseName: 'Crunch',                  targetSets: 3, targetReps: 12 },
      ],
    },
    {
      id: 'jn_upper1',
      name: 'Upper Body #1',
      description: "Jeff Nippard — Fundamentals Program",
      exercises: [
        { exerciseId: 'e1',  exerciseName: 'Barbell Bench Press',      targetSets: 3, targetReps: 5  },
        { exerciseId: 'e23', exerciseName: 'Lat Pulldown',             targetSets: 3, targetReps: 10 },
        { exerciseId: 'e28', exerciseName: 'Military Press',           targetSets: 3, targetReps: 10 },
        { exerciseId: 'e27', exerciseName: 'Chest-Supported T-Bar Row',targetSets: 3, targetReps: 12 },
        { exerciseId: 'e8',  exerciseName: 'Cable Fly',                targetSets: 3, targetReps: 12 },
        { exerciseId: 'e43', exerciseName: 'Dumbbell Curl (Supinated)',targetSets: 3, targetReps: 10 },
        { exerciseId: 'e56', exerciseName: 'Single-Arm Rope Tricep Ext',targetSets: 3, targetReps: 12 },
      ],
    },
    {
      id: 'jn_lower2',
      name: 'Lower Body #2',
      description: "Jeff Nippard — Fundamentals Program",
      exercises: [
        { exerciseId: 'e14', exerciseName: 'Deadlift',                targetSets: 3, targetReps: 8  },
        { exerciseId: 'e66', exerciseName: 'DB Walking Lunge',         targetSets: 3, targetReps: 10 },
        { exerciseId: 'e64', exerciseName: 'Single-Leg Leg Extension', targetSets: 3, targetReps: 15 },
        { exerciseId: 'e72', exerciseName: 'Single-Leg Leg Curl',      targetSets: 3, targetReps: 15 },
        { exerciseId: 'e79', exerciseName: 'Abduction Machine',        targetSets: 3, targetReps: 15 },
        { exerciseId: 'e82', exerciseName: 'Standing Calf Raise',      targetSets: 3, targetReps: 12 },
        { exerciseId: 'e87', exerciseName: 'Plank (20 sec)',           targetSets: 3, targetReps: 20 },
      ],
    },
    {
      id: 'jn_upper2',
      name: 'Upper Body #2',
      description: "Jeff Nippard — Fundamentals Program",
      exercises: [
        { exerciseId: 'e5',  exerciseName: 'Dumbbell Incline Press',         targetSets: 3, targetReps: 8  },
        { exerciseId: 'e23', exerciseName: 'Reverse Grip Lat Pulldown',      targetSets: 3, targetReps: 8  },
        { exerciseId: 'e58', exerciseName: 'Assisted Dip',                   targetSets: 3, targetReps: 10 },
        { exerciseId: 'e17', exerciseName: 'Barbell Bent Over Row',          targetSets: 3, targetReps: 12 },
        { exerciseId: 'e31', exerciseName: 'Dumbbell Lateral Raise',         targetSets: 3, targetReps: 15 },
        { exerciseId: 'e36', exerciseName: 'Seated Face Pull',               targetSets: 3, targetReps: 15 },
        { exerciseId: 'e44', exerciseName: 'Hammer Curl',                    targetSets: 3, targetReps: 8  },
      ],
    },
  ];

  const existing = getTemplates();
  // Don't add if already present (in case of partial state)
  const existingIds = new Set(existing.map(t => t.id));
  const toAdd = templates.filter(t => !existingIds.has(t.id));
  set(KEYS.TEMPLATES, [...existing, ...toAdd]);
  localStorage.setItem(FLAG, '1');
}
