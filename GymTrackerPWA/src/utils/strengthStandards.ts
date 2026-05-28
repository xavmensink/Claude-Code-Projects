import { WorkoutSession, UserProfile } from '../types';

export type StrengthTier = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

export interface StrengthProfile {
  tier: StrengthTier;
  factor: number;           // multiplier vs intermediate (1.0 = intermediate)
  assessedExercises: number;
}

// Intermediate 1RM as a fraction of bodyweight for a male aged 25–34.
// Dumbbell values are per-hand weight (as users typically log).
// Bodyweight-only exercises are omitted (0 means skip).
const STANDARD_MALE: Record<string, number> = {
  // Chest
  e1:  1.25, e2:  1.05, e3:  1.30, e4:  0.55, e5:  0.47,
  e6:  0.25, e7:  0.22, e8:  0.28, e9:  0.22, e10: 0.22,
  e11: 0.75, e13: 0.25,
  e103:1.15, e104:0.55, e105:1.15, e106:0.50,
  // Back
  e14: 2.00, e15: 1.85, e16: 2.25, e17: 1.10, e18: 1.00,
  e19: 0.55, e20: 0.55, e21: 0.20, e22: 0.25, e23: 0.90,
  e24: 0.90, e25: 0.50, e26: 0.55, e27: 0.90,
  e107:1.05, e109:0.52, e110:0.90, e111:0.85, e112:0.95,
  e113:0.90, e114:0.50,
  // Shoulders
  e28: 0.81, e29: 0.35, e30: 0.32, e31: 0.15, e32: 0.17,
  e33: 0.13, e34: 0.90, e35: 0.15, e36: 0.50, e37: 0.25,
  e38: 0.80, e39: 0.25,
  e116:0.85, e117:0.18, e118:0.40, e119:0.55, e120:0.90, e121:0.20,
  // Biceps
  e40: 0.44, e41: 0.42, e42: 0.40, e43: 0.20, e44: 0.22,
  e45: 0.18, e46: 0.17, e47: 0.18, e48: 0.40, e49: 0.35,
  e122:0.38, e123:0.38, e124:0.35, e125:0.20, e126:0.20,
  // Triceps
  e50: 1.10, e51: 0.56, e52: 0.27, e53: 0.15, e54: 0.44,
  e55: 0.40, e56: 0.22, e57: 0.42, e58: 0.30,
  e127:0.90, e128:0.28, e129:0.50, e130:0.45, e131:0.38,
  // Quads
  e60: 1.50, e61: 1.20, e62: 1.75, e63: 2.50, e64: 0.62,
  e65: 0.50, e66: 0.40, e67: 0.35, e68: 0.35,
  e134:1.50, e135:1.60, e136:1.55, e137:0.75,
  // Hamstrings
  e70: 1.37, e71: 1.30, e72: 0.50, e73: 0.55,
  e139:0.45, e140:0.90, e141:0.55, e143:0.45,
  // Glutes
  e76: 1.75, e78: 0.30, e79: 0.75, e80: 0.55,
  e146:0.90, e149:1.60, e150:0.65,
  // Calves
  e82: 1.12, e83: 0.75, e84: 0.90, e86: 2.50,
  e151:1.00, e152:0.55,
  // Abs
  e90: 0.25, e96: 0.60, e158:0.35,
  // Forearms
  e98: 0.25, e99: 0.20, e100:0.35, e101:0.60, e102:0.15,
};

/**
 * Returns a multiplier applied to the intermediate standard to adjust for age.
 */
export function getAgeFactor(age: number): number {
  if (age < 25)  return 0.95;
  if (age < 35)  return 1.00;
  if (age < 45)  return 0.93;
  if (age < 55)  return 0.84;
  if (age < 65)  return 0.74;
  return 0.65;
}

/**
 * Returns the expected intermediate 1RM (kg) for the given exercise and user
 * profile, or null if the exercise is not in the database.
 */
export function getIntermediateStandard(
  exerciseId: string,
  profile: UserProfile,
): number | null {
  const multiplier = STANDARD_MALE[exerciseId];
  if (multiplier === undefined || multiplier === 0) return null;

  const sexFactor = profile.sex === 'female' ? 0.60 : 1.0;
  const ageFactor = getAgeFactor(profile.age);

  return profile.bodyweightKg * multiplier * sexFactor * ageFactor;
}

/**
 * Analyses a user's workout history to determine their overall strength tier
 * relative to the intermediate standard.
 *
 * Returns null if there is not enough data to make an assessment.
 */
export function computeStrengthProfile(
  history: WorkoutSession[],
  profile: UserProfile,
): StrengthProfile | null {
  const ratios: number[] = [];
  const assessedIds = new Set<string>();

  for (const session of history) {
    for (const exerciseLog of session.exercises) {
      const { exerciseId, sets } = exerciseLog;
      const standard = getIntermediateStandard(exerciseId, profile);
      if (standard === null || standard === 0) continue;

      for (const set of sets) {
        if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;

        // Epley formula for estimated 1RM
        const estimated1RM = set.weight * (1 + set.reps / 30);
        const ratio = estimated1RM / standard;

        if (ratio > 0) {
          ratios.push(ratio);
          assessedIds.add(exerciseId);
        }
      }
    }
  }

  if (ratios.length === 0) return null;

  // Sort and take the median
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const medianFactor =
    ratios.length % 2 === 1
      ? ratios[mid]
      : (ratios[mid - 1] + ratios[mid]) / 2;

  let tier: StrengthTier;
  if (medianFactor >= 1.75)      tier = 'elite';
  else if (medianFactor >= 1.25) tier = 'advanced';
  else if (medianFactor >= 0.75) tier = 'intermediate';
  else if (medianFactor >= 0.45) tier = 'novice';
  else                           tier = 'beginner';

  return {
    tier,
    factor: medianFactor,
    assessedExercises: assessedIds.size,
  };
}

/**
 * Suggests a starting weight for an exercise the user has never tracked,
 * based on their inferred strength profile and the exercise's intermediate
 * standard.
 *
 * @param exerciseId  ID of the exercise to suggest a weight for.
 * @param profile     User's demographic profile.
 * @param history     All past workout sessions (used to build strength profile).
 * @param targetReps  The rep target for the working set (default: 10).
 * @returns Suggested working weight in kg, rounded to the nearest 2.5 kg,
 *          or null if there is insufficient data.
 */
export function getProfileSuggestion(
  exerciseId: string,
  profile: UserProfile,
  history: WorkoutSession[],
  targetReps?: number,
): number | null {
  const strengthProfile = computeStrengthProfile(history, profile);
  if (strengthProfile === null) return null;

  const standard = getIntermediateStandard(exerciseId, profile);
  if (standard === null) return null;

  const estimated1RM = standard * strengthProfile.factor;
  const reps = targetReps ?? 10;
  const workingWeight = estimated1RM / (1 + reps / 30);

  const rounded = Math.round(workingWeight / 2.5) * 2.5;
  return Math.max(2.5, rounded);
}
