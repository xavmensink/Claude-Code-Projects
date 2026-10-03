import { SetLog, WorkoutSession, Equipment } from '../types';
import {
  getExercises, getTemplates, getHistory, getSchedule, getSettings,
  getProfile, getBodyweightLog, getPlan,
} from '../storage/storage';
import { computeWeeklyVolume } from './volumeUtils';
import { EQUIPMENT_INFO } from './equipment';
import { EXPORT_TYPE, PLAN_TYPE, PLAN_VERSION } from './weeklyPlan';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KG_TO_LBS = 2.20462;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const round1 = (n: number) => Math.round(n * 10) / 10;

// "60x6@8" — weight x reps, optional RPE. Weight 0 on a bodyweight lift means bodyweight only.
function fmtSet(s: SetLog): string {
  return `${s.weight}x${s.reps}${s.rpe != null ? `@${s.rpe}` : ''}`;
}

const doneSets = (sets: SetLog[]) => sets.filter(s => s.completed && s.reps > 0);
const epley = (s: SetLog) => s.weight * (1 + s.reps / 30);

function nextMonday(from: Date): Date {
  const d = startOfDay(from);
  const add = ((8 - d.getDay()) % 7) || 7; // strictly after today
  d.setDate(d.getDate() + add);
  return d;
}

export interface WeeklyExportSummary { sessions: number; sets: number; windowLabel: string }

export function buildWeeklyExport(now: Date = new Date()) {
  const settings = getSettings();
  const unit = settings.weightUnit;
  const toUnit = (kg: number) => round1(unit === 'lbs' ? kg * KG_TO_LBS : kg);

  const exercises = getExercises();
  const exById = new Map(exercises.map(e => [e.id, e]));
  const exByName = new Map(exercises.map(e => [e.name.trim().toLowerCase(), e]));
  const templates = getTemplates();
  const history = getHistory();
  const profile = getProfile();
  const schedule = getSchedule();
  const lastPlan = getPlan();

  const windowStart = startOfDay(now);
  windowStart.setDate(windowStart.getDate() - 6); // today + previous 6 days = 7 days
  const inWindow = (s: WorkoutSession) => s.startTime >= windowStart.getTime() && s.startTime <= now.getTime();

  const equipmentOf = (id: string, name: string): Equipment | undefined =>
    (exById.get(id) ?? exByName.get(name.trim().toLowerCase()))?.equipment;

  // ── This week's sessions ────────────────────────────────────────────────
  const dataQuality: string[] = [];
  const sessions = history
    .filter(inWindow)
    .sort((a, b) => a.startTime - b.startTime)
    .map(s => {
      const skipped: string[] = [];
      const exs = s.exercises.flatMap(ex => {
        const done = doneSets(ex.sets);
        if (done.length === 0) { skipped.push(ex.exerciseName); return []; }
        const equipment = equipmentOf(ex.exerciseId, ex.exerciseName);
        if (equipment && equipment !== 'bodyweight' && done.some(x => x.weight === 0)) {
          dataQuality.push(
            `${ex.exerciseName} (${ymd(new Date(s.startTime))}): ${done.filter(x => x.weight === 0).length} completed set(s) logged with weight 0 — the weight was probably not entered, so treat that data as unknown.`,
          );
        }
        return [{
          exerciseId: ex.exerciseId,
          name: ex.exerciseName,
          equipment,
          setsPlanned: ex.sets.length,
          sets: done.map(fmtSet),
        }];
      });
      return {
        date: ymd(new Date(s.startTime)),
        weekday: DAY_NAMES[new Date(s.startTime).getDay()],
        templateId: s.templateId,
        name: s.name,
        durationMin: s.endTime ? Math.round((s.endTime - s.startTime) / 60000) : undefined,
        exercises: exs,
        skippedExercises: skipped.length ? skipped : undefined,
      };
    });

  const doneTemplateIds = new Set(sessions.map(s => s.templateId).filter(Boolean) as string[]);
  const scheduled = Object.entries(schedule).map(([dow, day]) => ({
    weekday: DAY_NAMES[Number(dow)],
    templateId: day!.templateId,
    name: day!.templateName,
    doneInLast7Days: doneTemplateIds.has(day!.templateId),
  }));

  // ── Program (templates) ────────────────────────────────────────────────
  const program = templates.map(t => ({
    templateId: t.id,
    name: t.name,
    exercises: t.exercises.map(te => {
      const def = exById.get(te.exerciseId);
      return {
        exerciseId: te.exerciseId,
        name: te.exerciseName,
        equipment: def?.equipment,
        primaryMuscle: def?.muscleGroup,
        secondaryMuscles: def?.secondaryMuscleGroups?.length ? def.secondaryMuscleGroups : undefined,
        targetSets: te.targetSets,
        targetReps: te.targetReps,
      };
    }),
  }));

  // ── Recent history per relevant exercise (sessions before the window) ──
  const relevantIds = new Set<string>();
  templates.forEach(t => t.exercises.forEach(e => relevantIds.add(e.exerciseId)));
  sessions.forEach(s => s.exercises.forEach(e => relevantIds.add(e.exerciseId)));
  lastPlan?.workouts.forEach(w => w.exercises.forEach(e => relevantIds.add(e.exerciseId)));

  const tenWeeksAgo = now.getTime() - 70 * 86400000;
  const recentHistory = [...relevantIds].flatMap(id => {
    const def = exById.get(id);
    const name = def?.name ?? id;
    const nameKey = name.trim().toLowerCase();
    const matches = (e: { exerciseId: string; exerciseName: string }) =>
      e.exerciseId === id || e.exerciseName.trim().toLowerCase() === nameKey;

    const past = history
      .filter(s => !inWindow(s) && s.startTime >= tenWeeksAgo && s.exercises.some(matches))
      .sort((a, b) => b.startTime - a.startTime);

    const priorSessions = past.flatMap(s => {
      const log = s.exercises.find(matches)!;
      const done = doneSets(log.sets);
      return done.length ? [{ date: ymd(new Date(s.startTime)), sets: done.map(fmtSet) }] : [];
    }).slice(0, 5);

    // All-time best estimated 1RM set (weighted sets only)
    let best: SetLog | null = null;
    for (const s of history) {
      for (const e of s.exercises.filter(matches)) {
        for (const set of doneSets(e.sets)) {
          if (set.weight > 0 && (!best || epley(set) > epley(best))) best = set;
        }
      }
    }
    if (priorSessions.length === 0 && !best) return [];

    return [{
      exerciseId: id,
      name,
      equipment: def?.equipment,
      priorSessions,
      allTimeBestSet: best ? { set: fmtSet(best), estimated1RM: round1(epley(best)) } : undefined,
    }];
  });

  // ── Previous plan, so Claude can compare prescribed vs achieved ────────
  const previousPlan = lastPlan ? {
    weekStart: lastPlan.weekStart,
    summary: lastPlan.summary,
    workouts: lastPlan.workouts.map(w => ({
      templateId: w.templateId,
      name: w.name,
      exercises: w.exercises.map(e => ({
        exerciseId: e.exerciseId,
        name: e.exerciseName,
        sets: e.sets.map(s => `${s.weight}x${s.reps}${s.rpe != null ? `@${s.rpe}` : ''}`),
        note: e.note,
      })),
    })),
  } : undefined;

  const today = ymd(now);
  const nextMon = ymd(nextMonday(now));

  const payload = {
    type: EXPORT_TYPE,
    version: 1,
    exportedAt: now.toISOString(),
    today,
    suggestedNextWeekStart: nextMon,
    window: { from: ymd(windowStart), to: today, days: 7 },
    units: unit,
    weightConventions: Object.fromEntries(
      (Object.keys(EQUIPMENT_INFO) as Equipment[]).map(k => [k, EQUIPMENT_INFO[k].hint]),
    ),
    setFormat: '"WEIGHTxREPS" or "WEIGHTxREPS@RPE", e.g. "60x6@8". Only completed sets are listed.',
    athlete: profile ? {
      sex: profile.sex,
      age: profile.age,
      bodyweight: toUnit(profile.bodyweightKg),
      recentBodyweightLog: getBodyweightLog().slice(-8).map(b => ({ date: ymd(new Date(b.date)), weight: toUnit(b.weightKg) })),
    } : undefined,
    program,
    schedule: scheduled,
    thisWeek: { sessions },
    recentHistory,
    weeklyVolumeSets: {
      note: 'Calendar weeks (Mon–Sun). Primary muscle = 1 set, secondary muscle = 0.5 set.',
      thisWeek: computeWeeklyVolume(history, 0),
      lastWeek: computeWeeklyVolume(history, -1),
    },
    previousPlan,
    dataQuality: dataQuality.length ? dataQuality : undefined,
    planFormat: {
      type: PLAN_TYPE,
      version: PLAN_VERSION,
      units: unit,
      weekStart: nextMon,
      summary: 'Short overview of the week and the main changes',
      workouts: [{
        templateId: program[0]?.templateId ?? 'template-id',
        name: program[0]?.name ?? 'Workout name',
        exercises: [{
          exerciseId: program[0]?.exercises[0]?.exerciseId ?? 'exercise-id',
          name: program[0]?.exercises[0]?.name ?? 'Exercise name',
          sets: [{ weight: 60, reps: 6, rpe: 7 }, { weight: 60, reps: 6, rpe: 8 }],
          note: 'Why this prescription',
        }],
      }],
    },
  };

  const summary: WeeklyExportSummary = {
    sessions: sessions.length,
    sets: sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
    windowLabel: `${ymd(windowStart)} → ${today}`,
  };

  return { payload, summary };
}

export function weeklyExportFilename(now = new Date()): string {
  return `gymtracker-week-${ymd(now)}.json`;
}
