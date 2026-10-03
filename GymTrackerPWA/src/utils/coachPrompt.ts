const FENCE = '`'.repeat(3);

export const COACH_PROMPT = `You are my evidence-based strength and hypertrophy coach. I track training in an app called GymTracker. I'm giving you my weekly export (JSON, type "gymtracker-weekly-export"). Analyse my last 7 days and write my next week's workouts: the exact weight and reps for every set.

## 1. Review the week first
- Adherence: compare "schedule" with "thisWeek.sessions" — which scheduled workouts happened, which exercises were skipped ("skippedExercises"), and sets completed vs "setsPlanned".
- Prescribed vs achieved: if "previousPlan" exists, check each set I was prescribed against what I actually did (thisWeek). Did I hit the weight, the reps, and the target RPE?
- Trends: use "recentHistory" (previous sessions per exercise) and "allTimeBestSet" to see whether each lift is progressing, stalling or regressing.
- Effort: look at RPE. If RPE is missing, assume I was working at about RPE 8.
- Volume: "weeklyVolumeSets" counts hard sets per muscle (secondary muscles count 0.5). A good range is roughly 10–20 sets per muscle per week. Flag anything far outside it.
- Data quality: "dataQuality" lists completed sets logged with weight 0 on weighted exercises — that weight was almost certainly not entered. Treat those sessions as unknown and be conservative for that exercise.

## 2. Progression rules
- Use double progression. Each exercise has a target rep range around its "targetReps" (about ±2 reps). Progress reps first while RPE stays at 8 or below; once I reach the top of the range with room to spare, add weight and drop reps back to the bottom of the range.
- Reps should NOT stay the same every week. Vary reps within the range, use a top set plus back-off sets on main compound lifts, and let reps differ between sets where it makes sense.
- All sets hit at RPE 7 or lower: increase the weight, or add 1–2 reps if the weight can't go up.
- Hit the reps at RPE 8: keep the weight and add 1–2 reps on some sets.
- RPE 9–10 or missed reps: hold the weight. If I missed the target by more than 2 reps on several sets, or stalled two weeks in a row, drop the weight 5–10%.
- Stalled or regressing across several lifts, or RPE creeping up: plan a deload (about 60% of the sets and roughly 10% less weight) and say so in the summary.
- An exercise with no history: start conservatively around RPE 6–7, estimating from my related lifts and my strength profile. Say so in its note.
- Aim for roughly RPE 7–8 on most sets, with the last set of an exercise allowed up to RPE 9.
- Keep my exercises and their order. You may change the number of sets by 1 where volume is clearly too low or too high, and explain why in that exercise's note. Do not invent exercises: only use exerciseIds that appear in "program" or "recentHistory".

## 3. Weights must be loadable
- Use the units in "units" (kg or lbs) for everything.
- Follow "weightConventions": barbell = total weight including the bar, in multiples of 2.5 kg (5 lbs). Dumbbell = the weight of ONE dumbbell, in steps of 1–2 kg (2.5–5 lbs). Cable and machine = stack weight, in the step size you see in my history. Bodyweight exercises: weight 0 means bodyweight only; progress by reps, or by added weight.
- Small, realistic jumps only. Never raise a lift more than about 5–10% in a week.

## 4. Reply format — follow exactly
1. First write a SHORT summary: at most 10 lines covering how the week went, what you changed and why, and any concerns or assumptions (such as the weight 0 issue). Don't ask me questions — make the safest assumption and state it.
2. Then give the plan as ONE JSON code block (${FENCE}json … ${FENCE}) and nothing after it.

The JSON must be valid (double quotes, no comments, no trailing commas) and use exactly this shape:

${FENCE}json
{
  "type": "gymtracker-weekly-plan",
  "version": 1,
  "units": "kg",
  "weekStart": "YYYY-MM-DD",
  "summary": "One or two sentences on the week's focus",
  "workouts": [
    {
      "templateId": "copied exactly from program[].templateId",
      "name": "copied exactly from program[].name",
      "exercises": [
        {
          "exerciseId": "copied exactly from the export",
          "name": "exercise name",
          "sets": [
            { "weight": 60, "reps": 6, "rpe": 7 },
            { "weight": 60, "reps": 6, "rpe": 8 }
          ],
          "note": "Short reason or cue for this prescription"
        }
      ]
    }
  ]
}
${FENCE}

Rules for the JSON:
- "units" must equal the export's "units". "weekStart" = the export's "suggestedNextWeekStart" unless I tell you otherwise.
- One workout for each entry in "schedule", in weekday order. If "schedule" is empty, include every template once.
- Every set has numeric "weight" (0 or more) and whole-number "reps" (1 or more). "rpe" is optional (1–10). Numbers only — no units or text inside number fields. Maximum 15 sets per exercise.
- List the sets individually, so each set can have its own weight and reps.

Here is my weekly export:`;

// One-time prompt: seeds the first plan (Fundamentals Day 1–5) from the full
// backup file, in the same plan format the weekly flow uses.
export const COACH_SETUP_PROMPT = `You are my evidence-based strength coach. This is a ONE-TIME SETUP. I'm attaching my full GymTracker backup (JSON) containing my entire workout history. Use it to work out my starting weights for THIS WEEK of the Jeff Nippard Fundamentals 5-day body-part split (Week 1, "4-week strength base"). After this I'll progress week by week using the app's weekly coaching flow.

## What's in the backup file
- "version": backup version. If it is below 5, the dumbbell weights in "history" are the COMBINED weight of both dumbbells — halve them for any exercise whose equipment is "dumbbell". From version 5 on, dumbbell weights are already per single dumbbell.
- "exportedAt": when the file was exported, in milliseconds since 1970. Treat that date as today.
- "settings.weightUnit": "kg" or "lbs". Use it for every weight you output. ("profile.bodyweightKg" is always in kg.)
- "profile": my sex, age and bodyweight. "bodyweight": my bodyweight log.
- "exercises": id, name, muscleGroup, equipment. What a logged weight means: barbell = total including the bar; dumbbell = ONE dumbbell; cable and machine = stack weight; bodyweight = added weight (0 = bodyweight only). For "Plank", reps means seconds.
- "templates": I want ONLY the five with ids jn5_day1, jn5_day2, jn5_day3, jn5_day4, jn5_day5. Each exercise has exerciseId, exerciseName, targetSets and targetReps. Ignore all other templates.
- "history": all my past sessions, newest first. Each has startTime (milliseconds) and exercises[] with exerciseId, exerciseName and sets[] (weight, reps, rpe, completed). Only sets with completed = true count. Match a lift by exerciseId first, then by name — the same lift can appear under a slightly different name.
- "prs": my personal records.

## Programme RPE targets (Week 1, apply to every set of the exercise)
Day 1 — Chest & Triceps: Barbell Bench Press 3×6 @7 · Dumbbell Incline Press 3×8 @8 · Cable Fly 3×12 @8 · Assisted Dip 3×10 @7 · Dumbbell Skull Crusher 3×12 @8
Day 2 — Legs & Abs: Back Squat 3×6 @7 · Romanian Deadlift 3×8 @7 · Barbell Hip Thrust 3×12 @8 · Leg Extension 3×12 @8 · Leg Curl 3×12 @8 · Standing Calf Raise 2×8 @7 · Crunch 2×12 @7
Day 3 — Back & Biceps: Reverse Grip Lat Pulldown 3×8 @8 · Cable Seated Row 3×10 @8 · Chest-Supported T-Bar Row 3×12 @8 · Seated Face Pull 3×15 @8 · Dumbbell Supinated Curl 3×12 @8
Day 4 — Legs & Abs: Deadlift 3×5 @7 · Dumbbell Walking Lunge 3×10 @8 · Single-Leg Leg Extension 2×15 @8 · Single-Leg Lying Leg Curl 2×15 @8 · Machine Seated Hip Abduction 3×15 @7 · Standing Calf Raise 2×12 @8 · Plank 3×20 seconds @8
Day 5 — Shoulders & Arms: Military Press 3×6 @7 · Dumbbell Lateral Raise 3×12 @8 · Cable Reverse Fly 3×15 @8 · Single-Arm Rope Tricep Extension 2×12 @8 · Single-Arm Cable Curl 2×12 @8
(If a template's sets or reps in the file differ from this list, follow the file.)

## How to work out each exercise's weight
1. Gather my completed sets with weight > 0 and reps > 0 for that exercise. IGNORE completed sets logged with weight 0 on weighted exercises: in my data that means the weight was never entered. It is missing data, not bodyweight.
2. For each set, estimate the 1RM: weight × (1 + (reps + 10 − RPE) / 30). If the RPE wasn't logged, assume RPE 8. Judge my CURRENT ability from roughly the last 8 weeks of sessions, weighting recent sessions more and ignoring one-off flukes.
3. Target weight = estimated 1RM ÷ (1 + (targetReps + 10 − targetRPE) / 30).
4. Be conservative, because this is a first ramp-up week: go 3–5% lighter than the maths if RPE data was missing. If I haven't trained the lift for 6+ weeks, go 5–10% lighter; for 3+ months, 10–15% lighter.
5. Exercises with no usable weight data: estimate from my related lifts and my profile — for example hip thrust and Romanian deadlift from squat and deadlift, machine and cable lifts from the barbell or dumbbell equivalent, accessories from typical intermediate strength standards scaled to my bodyweight, age and sex. Aim for about RPE 6–7 and mark the exercise LOW confidence.
6. Round to weights I can actually load: barbell in multiples of 2.5 kg (5 lbs) total; dumbbells in 1–2 kg (2.5–5 lbs) steps per dumbbell; cable and machine to the step size I've used in my history, or 2.5 kg if unknown. Bodyweight exercises (Assisted Dip, Plank, Crunch): weight 0 unless my history shows added weight.
7. Keep targetSets and targetReps from the template — this week the reps are the programme's, and the weights are what you're calibrating. Use the same weight for every set of an exercise. Only change reps (by at most 1–2) if my history clearly shows I can't hit the programme reps at the estimated weight, and lower the weight first.

## Reply format — follow exactly
1. First write a SHORT summary (at most 15 lines): how many sessions of history you used, the weight you chose for each main lift with a one-line reason, and which exercises are LOW confidence (no usable data) so I can adjust them in the gym. Don't ask me questions — make the safest assumption and say so.
2. Then give the plan as ONE JSON code block (${FENCE}json … ${FENCE}) and nothing after it.

The JSON must be valid (double quotes, no comments, no trailing commas) and use exactly this shape:

${FENCE}json
{
  "type": "gymtracker-weekly-plan",
  "version": 1,
  "units": "kg",
  "weekStart": "YYYY-MM-DD",
  "summary": "One or two sentences about this week",
  "workouts": [
    {
      "templateId": "jn5_day1",
      "name": "Day 1 — Chest & Triceps",
      "exercises": [
        {
          "exerciseId": "copied exactly from the template in the file",
          "name": "exercise name",
          "sets": [
            { "weight": 55, "reps": 6, "rpe": 7 },
            { "weight": 55, "reps": 6, "rpe": 7 },
            { "weight": 55, "reps": 6, "rpe": 7 }
          ],
          "note": "Basis for this weight, e.g. 'HIGH: 3x6 @ 52.5 RPE 8 on 2 Oct, est. 1RM 66' or 'LOW: no weights logged, estimated from squat — adjust in the gym'"
        }
      ]
    }
  ]
}
${FENCE}

Rules for the JSON:
- "units" must equal settings.weightUnit. "weekStart" = the Monday of the week containing the exportedAt date, as YYYY-MM-DD.
- Include exactly five workouts, in order: jn5_day1 to jn5_day5. Use each template's id and name exactly as they appear in the file, and list the exercises in the template's order using its exerciseIds.
- Every set has a numeric "weight" (0 or more), whole-number "reps" (1 or more) and an "rpe". Numbers only — no units or text inside number fields. List every set individually.
- Start every note with HIGH, MEDIUM or LOW confidence, then the reason.

Here is my backup file:`;
