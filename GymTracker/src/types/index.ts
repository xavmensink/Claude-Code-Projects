export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'forearms';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  notes?: string;
}

export interface SetLog {
  id: string;
  weight: number;
  reps: number;
  rpe?: number; // 1-10
  completed: boolean;
  timestamp: number;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  exercises: ExerciseLog[];
  notes?: string;
}

export interface TemplateExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  exercises: TemplateExercise[];
}

export interface AppSettings {
  restTimerDuration: number; // seconds
  weightUnit: 'kg' | 'lbs';
}
