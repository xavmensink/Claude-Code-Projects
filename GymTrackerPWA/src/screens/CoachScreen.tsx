import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlannedWorkout, WeeklyPlan } from '../types';
import { getPlan, savePlan, clearPlan, getExercises, getTemplates, getHistory, getSettings } from '../storage/storage';
import { useWorkout } from '../context/WorkoutContext';
import { buildWeeklyExport, weeklyExportFilename } from '../utils/weeklyExport';
import { parsePlanText, ParseResult, isPlanFresh, formatPlannedSets, plannedRpeLabel } from '../utils/weeklyPlan';
import { COACH_PROMPT, COACH_SETUP_PROMPT } from '../utils/coachPrompt';
import { copyText, downloadText } from '../utils/helpers';

const stepTitle = { fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--accent)' } as const;
const mutedText = { color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 } as const;
const outlineBtn = {
  width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 10,
  background: 'none', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
} as const;

export default function CoachScreen() {
  const navigate = useNavigate();
  const { activeWorkout } = useWorkout();
  const [unit] = useState(() => getSettings().weightUnit);
  const [plan, setPlan] = useState<WeeklyPlan | null>(getPlan);
  const [text, setText] = useState('');
  const [review, setReview] = useState<ParseResult | null>(null);
  const [flash, setFlash] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Rebuilt each time the screen opens so it always reflects the latest workouts
  const exportData = useMemo(() => buildWeeklyExport(), []);
  const exportJson = useMemo(() => JSON.stringify(exportData.payload), [exportData]);

  const say = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };

  const copyExport = async () => say(await copyText(exportJson) ? '✓ Export copied — paste it into Claude' : '✗ Copy failed — use Download instead');
  const copySetupPrompt = async () => say(await copyText(COACH_SETUP_PROMPT) ? '✓ Setup prompt copied — paste it into Claude, then attach your backup' : '✗ Copy failed');
  const copyPrompt = async () => say(await copyText(COACH_PROMPT) ? '✓ Prompt copied — paste it into Claude first' : '✗ Copy failed');
  const download = () => { downloadText(weeklyExportFilename(), exportJson); say('✓ Export file downloaded'); };

  const runReview = (raw: string) => {
    setReview(parsePlanText(raw, {
      exercises: getExercises(), templates: getTemplates(), history: getHistory(), unit,
    }));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const t = String(reader.result ?? ''); setText(t); runReview(t); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyPlan = () => {
    if (!review?.plan) return;
    savePlan(review.plan);
    setPlan(review.plan);
    setReview(null);
    setText('');
    say('✓ Plan imported — start a workout to use it');
  };

  const removePlan = () => {
    if (!confirm('Remove the imported plan? Workouts will go back to the automatic estimates.')) return;
    clearPlan();
    setPlan(null);
  };

  const startWorkout = (w: PlannedWorkout) => navigate('/workout', { state: { planWorkout: w } });

  const fresh = plan ? isPlanFresh(plan) : false;

  return (
    <div>
      <div className="screen-header"><span className="screen-title">Weekly Coach</span></div>

      <div style={{ padding: '12px 16px 100px' }}>
        {flash && (
          <div style={{
            position: 'sticky', top: 8, zIndex: 20, marginBottom: 10, padding: '10px 14px', borderRadius: 10,
            background: 'var(--bg-tertiary)', border: '1px solid var(--accent)', fontSize: 13, fontWeight: 600,
          }}>{flash}</div>
        )}

        <div style={{ ...mutedText, marginBottom: 14 }}>
          Once a week, send Claude your results and get next week's exact weights and reps back. Claude can vary reps and loads set by set, which the built-in estimate can't.
        </div>

        {/* ── One-time setup ── */}
        {!plan && (
          <div className="card" style={{ marginBottom: 16, border: '1px solid var(--accent)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>First time? Start here</div>
            <div style={{ ...mutedText, marginBottom: 10 }}>
              Build your first plan from your whole history: (1) Settings → Export Backup and save the file. (2) Copy the setup prompt below, paste it into a new Claude chat and attach the backup file. (3) Copy Claude's reply into step 3 here. After that, use the weekly steps.
            </div>
            <button className="btn-primary" onClick={copySetupPrompt}>📋 Copy one-time setup prompt</button>
            <details>
              <summary style={{ color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: '8px 0 0' }}>Show setup prompt</summary>
              <pre style={{
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.5,
                color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', borderRadius: 8, padding: 10, margin: '6px 0 0', maxHeight: 260, overflowY: 'auto',
              }}>{COACH_SETUP_PROMPT}</pre>
            </details>
          </div>
        )}

        {/* ── Step 1: Export ── */}
        <div className="section-label">1 · Export your week</div>
        <div className="card">
          <div style={{ ...mutedText, marginBottom: 12 }}>
            Last 7 days ({exportData.summary.windowLabel}): <strong style={{ color: 'var(--text-primary)' }}>
              {exportData.summary.sessions} workout{exportData.summary.sessions !== 1 ? 's' : ''}, {exportData.summary.sets} sets
            </strong>, plus your program, recent history and volume.
            {exportData.summary.sessions === 0 && (
              <div style={{ color: 'var(--warning)', marginTop: 6 }}>
                No completed workouts in the last 7 days — Claude will only have your older history to go on.
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={copyExport} style={{ marginBottom: 8 }}>📋 Copy export</button>
          <button onClick={download} style={outlineBtn}>⬇ Download export file</button>
        </div>

        {/* ── Step 2: Prompt ── */}
        <div className="section-label" style={{ marginTop: 20 }}>2 · Ask Claude</div>
        <div className="card">
          <div style={{ ...mutedText, marginBottom: 12 }}>
            In a new Claude chat: paste the coaching prompt, then paste the export (or attach the downloaded file) and send. Add anything extra after it, like an injury or a goal.
          </div>
          <button className="btn-primary" onClick={copyPrompt} style={{ marginBottom: 8 }}>📋 Copy coaching prompt</button>
          <details>
            <summary style={{ color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>Show prompt</summary>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.5,
              color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)', borderRadius: 8, padding: 10, margin: '6px 0 0', maxHeight: 260, overflowY: 'auto',
            }}>{COACH_PROMPT}</pre>
          </details>
        </div>

        {/* ── Step 3: Import ── */}
        <div className="section-label" style={{ marginTop: 20 }}>3 · Import Claude's plan</div>
        <div className="card">
          <div style={{ ...mutedText, marginBottom: 10 }}>
            Copy Claude's whole reply (or just the JSON block) and paste it here, or choose a saved file.
          </div>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setReview(null); }}
            placeholder="Paste Claude's reply here…"
            rows={5}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 10, boxSizing: 'border-box',
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)',
              color: 'var(--text)', fontSize: 13, fontFamily: 'monospace', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ flex: 2, opacity: text.trim() ? 1 : 0.5 }}
              disabled={!text.trim()} onClick={() => runReview(text)}>
              Review plan
            </button>
            <button style={{ ...outlineBtn, flex: 1 }} onClick={() => fileRef.current?.click()}>Choose file</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" style={{ display: 'none' }} onChange={handleFile} />

          {review && (
            <div style={{ marginTop: 14 }}>
              {review.errors.map((e, i) => (
                <div key={i} style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>✗ {e}</div>
              ))}
              {review.plan && (
                <>
                  <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    ✓ Valid plan: {review.stats.workouts} workouts, {review.stats.exercises} exercises, {review.stats.sets} sets
                  </div>
                  {review.plan.summary && (
                    <div style={{ ...mutedText, marginBottom: 8, fontStyle: 'italic' }}>"{review.plan.summary}"</div>
                  )}
                  {review.warnings.length > 0 && (
                    <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                      <div style={{ color: 'var(--warning)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                        {review.warnings.length} thing{review.warnings.length !== 1 ? 's' : ''} to check
                      </div>
                      {review.warnings.map((w, i) => (
                        <div key={i} style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, marginBottom: 3 }}>• {w}</div>
                      ))}
                    </div>
                  )}
                  <button className="btn-primary" onClick={applyPlan}>
                    {plan ? 'Replace current plan with this' : 'Use this plan'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Current plan ── */}
        {plan && (
          <>
            <div className="section-label" style={{ marginTop: 20 }}>Current plan</div>
            <div style={{ ...mutedText, marginBottom: 8 }}>
              {plan.weekStart ? `Week of ${plan.weekStart}` : 'Imported'} · {new Date(plan.importedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {!fresh && (
                <span style={{ color: 'var(--warning)' }}> · over 2 weeks old — workouts no longer use it automatically</span>
              )}
            </div>
            {plan.summary && <div style={{ ...mutedText, fontStyle: 'italic', marginBottom: 10 }}>"{plan.summary}"</div>}

            {plan.workouts.map((w, wi) => (
              <div key={wi} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{w.name}</div>
                  {activeWorkout ? (
                    <button onClick={() => navigate('/workout')}
                      style={{ background: 'var(--success)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Resume current
                    </button>
                  ) : (
                    <button onClick={() => startWorkout(w)}
                      style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Start
                    </button>
                  )}
                </div>
                {w.exercises.map((e, ei) => (
                  <div key={ei} style={{ padding: '6px 0', borderTop: ei === 0 ? 'none' : '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.exerciseName}</div>
                    <div style={{ fontSize: 12, color: 'var(--accent)' }}>
                      {formatPlannedSets(e.sets)} {unit}{plannedRpeLabel(e.sets) ? ` · ${plannedRpeLabel(e.sets)}` : ''}
                    </div>
                    {e.note && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{e.note}</div>}
                  </div>
                ))}
              </div>
            ))}

            <button onClick={removePlan} style={{ ...outlineBtn, color: 'var(--danger)', borderColor: 'rgba(233,69,96,0.3)', marginTop: 4 }}>
              Remove plan
            </button>
          </>
        )}
      </div>
    </div>
  );
}
