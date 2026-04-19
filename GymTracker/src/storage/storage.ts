import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise, WorkoutTemplate, WorkoutSession, AppSettings } from '../types';

const KEYS = {
  EXERCISES: 'exercises',
  TEMPLATES: 'templates',
  HISTORY: 'workoutHistory',
  ACTIVE_WORKOUT: 'activeWorkout',
  SETTINGS: 'settings',
};

// ─── Exercises ───────────────────────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  const raw = await AsyncStorage.getItem(KEYS.EXERCISES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.EXERCISES, JSON.stringify(exercises));
}

export async function addExercise(exercise: Exercise): Promise<void> {
  const exercises = await getExercises();
  exercises.push(exercise);
  await saveExercises(exercises);
}

export async function deleteExercise(id: string): Promise<void> {
  const exercises = await getExercises();
  await saveExercises(exercises.filter((e) => e.id !== id));
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const raw = await AsyncStorage.getItem(KEYS.TEMPLATES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveTemplates(templates: WorkoutTemplate[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
}

export async function upsertTemplate(template: WorkoutTemplate): Promise<void> {
  const templates = await getTemplates();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) templates[idx] = template;
  else templates.push(template);
  await saveTemplates(templates);
}

export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  await saveTemplates(templates.filter((t) => t.id !== id));
}

// ─── Workout History ──────────────────────────────────────────────────────────

export async function getWorkoutHistory(): Promise<WorkoutSession[]> {
  const raw = await AsyncStorage.getItem(KEYS.HISTORY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
  const history = await getWorkoutHistory();
  const idx = history.findIndex((s) => s.id === session.id);
  if (idx >= 0) history[idx] = session;
  else history.unshift(session);
  await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  const history = await getWorkoutHistory();
  await AsyncStorage.setItem(
    KEYS.HISTORY,
    JSON.stringify(history.filter((s) => s.id !== id))
  );
}

// ─── Active Workout ───────────────────────────────────────────────────────────

export async function getActiveWorkout(): Promise<WorkoutSession | null> {
  const raw = await AsyncStorage.getItem(KEYS.ACTIVE_WORKOUT);
  return raw ? JSON.parse(raw) : null;
}

export async function setActiveWorkout(session: WorkoutSession | null): Promise<void> {
  if (session) {
    await AsyncStorage.setItem(KEYS.ACTIVE_WORKOUT, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(KEYS.ACTIVE_WORKOUT);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  restTimerDuration: 120,
  weightUnit: 'kg',
};

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export async function seedExercisesIfEmpty(): Promise<void> {
  const existing = await getExercises();
  if (existing.length > 0) return;

  const seed: Exercise[] = [
    // Chest
    { id: 'e1', name: 'Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
    { id: 'e2', name: 'Incline Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
    { id: 'e3', name: 'Dumbbell Fly', muscleGroup: 'chest', equipment: 'dumbbell' },
    { id: 'e4', name: 'Cable Crossover', muscleGroup: 'chest', equipment: 'cable' },
    { id: 'e5', name: 'Push-up', muscleGroup: 'chest', equipment: 'bodyweight' },
    // Back
    { id: 'e6', name: 'Deadlift', muscleGroup: 'back', equipment: 'barbell' },
    { id: 'e7', name: 'Barbell Row', muscleGroup: 'back', equipment: 'barbell' },
    { id: 'e8', name: 'Pull-up', muscleGroup: 'back', equipment: 'bodyweight' },
    { id: 'e9', name: 'Lat Pulldown', muscleGroup: 'back', equipment: 'cable' },
    { id: 'e10', name: 'Seated Cable Row', muscleGroup: 'back', equipment: 'cable' },
    { id: 'e11', name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'dumbbell' },
    // Shoulders
    { id: 'e12', name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell' },
    { id: 'e13', name: 'Dumbbell Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell' },
    { id: 'e14', name: 'Face Pull', muscleGroup: 'shoulders', equipment: 'cable' },
    { id: 'e15', name: 'Arnold Press', muscleGroup: 'shoulders', equipment: 'dumbbell' },
    // Biceps
    { id: 'e16', name: 'Barbell Curl', muscleGroup: 'biceps', equipment: 'barbell' },
    { id: 'e17', name: 'Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell' },
    { id: 'e18', name: 'Hammer Curl', muscleGroup: 'biceps', equipment: 'dumbbell' },
    { id: 'e19', name: 'Cable Curl', muscleGroup: 'biceps', equipment: 'cable' },
    // Triceps
    { id: 'e20', name: 'Tricep Pushdown', muscleGroup: 'triceps', equipment: 'cable' },
    { id: 'e21', name: 'Skull Crusher', muscleGroup: 'triceps', equipment: 'barbell' },
    { id: 'e22', name: 'Overhead Tricep Extension', muscleGroup: 'triceps', equipment: 'dumbbell' },
    { id: 'e23', name: 'Dip', muscleGroup: 'triceps', equipment: 'bodyweight' },
    // Legs
    { id: 'e24', name: 'Squat', muscleGroup: 'quads', equipment: 'barbell' },
    { id: 'e25', name: 'Leg Press', muscleGroup: 'quads', equipment: 'machine' },
    { id: 'e26', name: 'Leg Extension', muscleGroup: 'quads', equipment: 'machine' },
    { id: 'e27', name: 'Romanian Deadlift', muscleGroup: 'hamstrings', equipment: 'barbell' },
    { id: 'e28', name: 'Leg Curl', muscleGroup: 'hamstrings', equipment: 'machine' },
    { id: 'e29', name: 'Hip Thrust', muscleGroup: 'glutes', equipment: 'barbell' },
    { id: 'e30', name: 'Calf Raise', muscleGroup: 'calves', equipment: 'machine' },
    { id: 'e31', name: 'Lunge', muscleGroup: 'quads', equipment: 'dumbbell' },
    // Abs
    { id: 'e32', name: 'Plank', muscleGroup: 'abs', equipment: 'bodyweight' },
    { id: 'e33', name: 'Cable Crunch', muscleGroup: 'abs', equipment: 'cable' },
    { id: 'e34', name: 'Hanging Leg Raise', muscleGroup: 'abs', equipment: 'bodyweight' },
    // Forearms
    { id: 'e35', name: 'Wrist Curl', muscleGroup: 'forearms', equipment: 'barbell' },
  ];

  await saveExercises(seed);
}
