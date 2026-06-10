export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'forearms';

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  secondaryMuscleGroups?: MuscleGroup[];
}

export interface SetLog {
  id: string;
  weight: number;
  reps: number;
  rpe?: number;
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

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  achievedAt: number;
  prType: 'weight' | 'reps';
}

export interface AppSettings {
  restTimerDuration: number;
  weightUnit: 'kg' | 'lbs';
}

export interface UserProfile {
  sex: 'male' | 'female';
  age: number;
  bodyweightKg: number;
}

export interface BodyweightEntry {
  date: number;
  weightKg: number;
}

export interface ScheduledDay {
  templateId: string;
  templateName: string;
}

// Keys 0–6 map to Sun–Sat (JS Date.getDay())
export type WeekSchedule = Partial<Record<0|1|2|3|4|5|6, ScheduledDay>>;
