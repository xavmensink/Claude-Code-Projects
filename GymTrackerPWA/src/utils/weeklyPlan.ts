import {
  Exercise, WorkoutSession, WorkoutTemplate, WeeklyPlan,
  PlannedWorkout, PlannedExercise, PlannedSet, SetLog,
} from '../types';
import { generateId } from './helpers';

export const PLAN_TYPE = 'gymtracker-weekly-plan';
export const EXPORT_TYPE = 'gymtracker-weekly-export';
export const PLAN_VERSION = 1;

export interface ParseContext {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  history: WorkoutSession[];
  unit: 'kg' | 'lbs';
}

export interface ParseResult {
  plan: WeeklyPlan | null;
  errors: string[];
  warnings: string[];
  stats: { workouts: number; exercises: number; sets: number };
}

// ── JSON extraction ──────────────────────────────────────────────────────────

// Smart quotes sneak in when text is copied through some apps
const straighten = (t: string) => t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

function tryParse(t: string): unknown | undefined {
  try { return JSON.parse(t); } catch { /* fall through */ }
  try { return JSON.parse(straighten(t)); } catch { return undefined; }
}

// Accepts raw JSON, a fenced ```json block, or a whole chat reply that
// contains the JSON somewhere inside it.
export function extractJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const direct = tryParse(trimmed);
  if (direct && typeof direct === 'object') return direct;

  const fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(trimmed)) !== null) {
    const parsed = tryParse(m[1].trim());
    if (parsed && typeof parsed === 'object') return parsed;
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const parsed = tryParse(trimmed.slice(first, last + 1));
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN);

function lastLoggedTopWeight(history: WorkoutSession[], exerciseId: string, exerciseName: string): number {
  const name = norm(exerciseName);
  const sessions = history
    .filter(s => s.exercises.some(e => e.exerciseId === exerciseId || norm(e.exerciseName) === name))
    .sort((a, b) => b.startTime - a.startTime);
  for (const s of sessions) {
    const log = s.exercises.find(e => e.exerciseId === exerciseId || norm(e.exerciseName) === name);
    const weights = (log?.sets ?? []).filter(x => x.completed && x.weight > 0 && x.reps > 0).map(x => x.weight);
    if (weights.length) return Math.max(...weights);
  }
  return 0;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function parsePlanText(text: string, ctx: ParseContext): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats = { workouts: 0, exercises: 0, sets: 0 };
  const fail = (msg: string): ParseResult => ({ plan: null, errors: [...errors, msg], warnings, stats });

  const root = extractJson(text);
  if (!isObj(root)) {
    return fail("Couldn't find any JSON in what you pasted. Paste Claude's full reply or just the JSON block.");
  }
  if (root.type === EXPORT_TYPE) {
    return fail("That's the weekly export file, not Claude's plan. Import the plan Claude sends back.");
  }
  if (root.type !== PLAN_TYPE) {
    return fail(`This isn't a GymTracker plan (expected "type": "${PLAN_TYPE}").`);
  }
  if (root.version !== undefined && root.version !== PLAN_VERSION) {
    return fail(`Unsupported plan version ${String(root.version)} (this app reads version ${PLAN_VERSION}).`);
  }
  if (root.units !== undefined && root.units !== ctx.unit) {
    return fail(`The plan is in ${String(root.units)} but the app is set to ${ctx.unit}. Ask Claude to redo it in ${ctx.unit}.`);
  }
  if (!Array.isArray(root.workouts) || root.workouts.length === 0) {
    return fail('The plan has no workouts.');
  }

  const exById = new Map(ctx.exercises.map(e => [e.id, e]));
  const exByName = new Map(ctx.exercises.map(e => [norm(e.name), e]));
  const tmplById = new Map(ctx.templates.map(t => [t.id, t]));
  const tmplByName = new Map(ctx.templates.map(t => [norm(t.name), t]));

  const workouts: PlannedWorkout[] = [];

  root.workouts.forEach((rw, wi) => {
    if (!isObj(rw)) { warnings.push(`Workout #${wi + 1} is malformed — skipped.`); return; }

    const tid = typeof rw.templateId === 'string' ? rw.templateId : undefined;
    const rawName = typeof rw.name === 'string' ? rw.name.trim() : '';
    const template = (tid && tmplById.get(tid)) || (rawName ? tmplByName.get(norm(rawName)) : undefined);
    const name = rawName || template?.name || `Workout ${wi + 1}`;
    if (!template) {
      warnings.push(`"${name}" doesn't match any of your templates — you can still start it from the Coach screen.`);
    }

    if (!Array.isArray(rw.exercises)) { warnings.push(`"${name}" has no exercises — skipped.`); return; }

    const exercises: PlannedExercise[] = [];
    rw.exercises.forEach((re, ei) => {
      if (!isObj(re)) { warnings.push(`${name}: exercise #${ei + 1} is malformed — skipped.`); return; }

      const id = typeof re.exerciseId === 'string' ? re.exerciseId : '';
      const label = typeof re.name === 'string' ? re.name : typeof re.exerciseName === 'string' ? re.exerciseName : id;
      const def = exById.get(id) ?? exByName.get(norm(label));
      if (!def) { warnings.push(`${name}: "${label || 'unnamed'}" isn't an exercise in your app — skipped.`); return; }

      // Prefer the template's own name for this exercise so history matches
      const tmplName = template?.exercises.find(te => te.exerciseId === def.id)?.exerciseName;
      const exerciseName = tmplName ?? def.name;

      if (!Array.isArray(re.sets) || re.sets.length === 0) {
        warnings.push(`${name}: ${exerciseName} has no sets — skipped.`); return;
      }

      const sets: PlannedSet[] = [];
      re.sets.slice(0, 15).forEach((rs, si) => {
        if (!isObj(rs)) { warnings.push(`${name}: ${exerciseName} set ${si + 1} is malformed — skipped.`); return; }
        const weight = num(rs.weight);
        const reps = Math.round(num(rs.reps));
        if (!Number.isFinite(weight) || weight < 0 || weight > 2000) {
          warnings.push(`${name}: ${exerciseName} set ${si + 1} has an invalid weight — skipped.`); return;
        }
        if (!Number.isFinite(reps) || reps < 1 || reps > 100) {
          warnings.push(`${name}: ${exerciseName} set ${si + 1} has invalid reps — skipped.`); return;
        }
        const set: PlannedSet = { weight: Math.round(weight * 100) / 100, reps };
        const rpe = num(rs.rpe);
        if (Number.isFinite(rpe) && rpe >= 1 && rpe <= 10) set.rpe = rpe;
        sets.push(set);
      });
      if (re.sets.length > 15) warnings.push(`${name}: ${exerciseName} had more than 15 sets — extra sets ignored.`);
      if (sets.length === 0) { warnings.push(`${name}: ${exerciseName} has no valid sets — skipped.`); return; }

      if (def.equipment !== 'bodyweight' && sets.every(s => s.weight === 0)) {
        warnings.push(`${exerciseName}: planned weight is 0 — you'll need to enter the weight yourself.`);
      }

      // Sanity check against what you actually lifted last time
      const lastTop = lastLoggedTopWeight(ctx.history, def.id, exerciseName);
      const planTop = Math.max(...sets.map(s => s.weight));
      if (lastTop > 0 && planTop > lastTop * 1.2) {
        const pct = Math.round((planTop / lastTop - 1) * 100);
        warnings.push(`${exerciseName}: planned ${planTop}${ctx.unit} is +${pct}% on your last top weight (${lastTop}${ctx.unit}) — double-check.`);
      }

      const planned: PlannedExercise = { exerciseId: def.id, exerciseName, sets };
      if (typeof re.note === 'string' && re.note.trim()) planned.note = re.note.trim().slice(0, 300);
      exercises.push(planned);
      stats.exercises += 1;
      stats.sets += sets.length;
    });

    if (exercises.length === 0) { warnings.push(`"${name}" had no usable exercises — skipped.`); return; }
    workouts.push({ templateId: template?.id, name, exercises });
    stats.workouts += 1;
  });

  if (workouts.length === 0) return fail('None of the workouts in the plan could be used.');

  const plan: WeeklyPlan = {
    importedAt: Date.now(),
    workouts,
  };
  if (typeof root.weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(root.weekStart)) plan.weekStart = root.weekStart;
  if (typeof root.summary === 'string' && root.summary.trim()) plan.summary = root.summary.trim().slice(0, 1500);

  return { plan, errors, warnings, stats };
}

// ── Lookup helpers used by the workout screen ────────────────────────────────

export function planWorkoutFor(plan: WeeklyPlan | null, templateId?: string, name?: string): PlannedWorkout | null {
  if (!plan) return null;
  if (templateId) {
    const byId = plan.workouts.find(w => w.templateId === templateId);
    if (byId) return byId;
  }
  if (name) {
    const byName = plan.workouts.find(w => norm(w.name) === norm(name));
    if (byName) return byName;
  }
  return null;
}

// Finds the planned prescription for an exercise: first in the workout being
// done, then anywhere else in the plan (e.g. an exercise added mid-session).
export function planExerciseFor(
  plan: WeeklyPlan | null,
  exerciseId: string,
  exerciseName: string,
  templateId?: string,
  sessionName?: string,
): PlannedExercise | null {
  if (!plan) return null;
  const match = (e: PlannedExercise) => e.exerciseId === exerciseId || norm(e.exerciseName) === norm(exerciseName);
  const own = planWorkoutFor(plan, templateId, sessionName);
  const inOwn = own?.exercises.find(match);
  if (inOwn) return inOwn;
  for (const w of plan.workouts) {
    const found = w.exercises.find(match);
    if (found) return found;
  }
  return null;
}

export function plannedSetsToLogs(sets: PlannedSet[]): SetLog[] {
  return sets.map(s => ({
    id: generateId(), weight: s.weight, reps: s.reps, completed: false, timestamp: Date.now(),
  }));
}

// "60×6 ×3 · 57.5×8" — consecutive identical sets collapse into a count
export function formatPlannedSets(sets: PlannedSet[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < sets.length) {
    let j = i;
    while (j + 1 < sets.length && sets[j + 1].weight === sets[i].weight && sets[j + 1].reps === sets[i].reps) j++;
    const count = j - i + 1;
    parts.push(`${sets[i].weight}×${sets[i].reps}${count > 1 ? ` ×${count}` : ''}`);
    i = j + 1;
  }
  return parts.join(' · ');
}

// A plan counts as current for two weeks after its start date (or import date)
export function isPlanFresh(plan: WeeklyPlan, now = Date.now()): boolean {
  const ref = plan.weekStart ? new Date(`${plan.weekStart}T00:00:00`).getTime() : plan.importedAt;
  return now - ref <= 14 * 86400000;
}

// "RPE 7" or "RPE 7–8" from a planned exercise's per-set targets
export function plannedRpeLabel(sets: PlannedSet[]): string {
  const r = sets.map(s => s.rpe).filter((x): x is number => x != null);
  if (!r.length) return '';
  const lo = Math.min(...r), hi = Math.max(...r);
  return lo === hi ? `RPE ${lo}` : `RPE ${lo}–${hi}`;
}
