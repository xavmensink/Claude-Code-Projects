import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkoutSession, ExerciseLog, SetLog, WorkoutTemplate, Exercise, PersonalRecord } from '../types';
import { getHistory, saveSession, getSettings, getExercises, checkForNewPRs, deletePRs, getProfile } from '../storage/storage';
import { useWorkout } from '../context/WorkoutContext';
import { getSuggestedWeight } from '../utils/progressiveOverload';
import { getProfileSuggestion } from '../utils/strengthStandards';
import { generateId, formatStopwatch } from '../utils/helpers';
import PRCelebration from '../components/PRCelebration';

function rpeColor(rpe: number) {
  if (rpe <= 6) return 'var(--success)';
  if (rpe <= 8) return 'var(--warning)';
  return 'var(--danger)';
}

const PLATES_KG  = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATES_LBS = [45, 35, 25, 10, 5, 2.5];
const BARS_KG    = [20, 15, 10];
const BARS_LBS   = [45, 35, 15];

const PLATE_COLOR: Record<number, string> = {
  25: '#e94560', 20: '#2196F3', 15: '#FFC107', 10: '#4CAF50',
  45: '#2196F3', 35: '#FFC107',
  5: '#fff', 2.5: '#888', 1.25: '#aaa',
};

function PlateCalcModal({ initialWeight, unit, onClose }: {
  initialWeight: number;
  unit: 'kg' | 'lbs';
  onClose: () => void;
}) {
  const bars   = unit === 'kg' ? BARS_KG : BARS_LBS;
  const plates = unit === 'kg' ? PLATES_KG : PLATES_LBS;
  const [target, setTarget] = useState(String(initialWeight > 0 ? initialWeight : bars[0]));
  const [bar, setBar] = useState(bars[0]);

  const targetNum = parseFloat(target) || 0;
  const perSide = (targetNum - bar) / 2;

  // Greedy plate breakdown
  const breakdown: { plate: number; count: number }[] = [];
  let remaining = perSide;
  for (const p of plates) {
    const count = Math.floor((remaining + 1e-9) / p);
    if (count > 0) { breakdown.push({ plate: p, count }); remaining -= count * p; }
  }
  const leftover = Math.round(remaining * 100) / 100;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Plate Calculator</div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Target weight ({unit})</div>
        <input type="number" className="input" value={target} onChange={e => setTarget(e.target.value)}
          style={{ marginBottom: 14, textAlign: 'center', fontSize: 18, fontWeight: 700 }} />

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Bar weight</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {bars.map(b => (
            <button key={b} onClick={() => setBar(b)} style={{
              flex: 1, padding: 10, borderRadius: 8, cursor: 'pointer', fontSize: 14,
              border: `1px solid ${bar === b ? 'var(--accent)' : 'var(--border)'}`,
              background: bar === b ? 'var(--accent-dim)' : 'none',
              color: bar === b ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: bar === b ? 700 : 400,
            }}>{b} {unit}</button>
          ))}
        </div>

        {perSide < 0 ? (
          <div style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 14, padding: '12px 0' }}>
            Target is lighter than the bar.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Per side ({perSide.toLocaleString()} {unit}):
            </div>
            {breakdown.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: 14, padding: '8px 0' }}>
                Empty bar — no plates needed.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, justifyContent: 'center', padding: '6px 0 12px' }}>
                {breakdown.flatMap(({ plate, count }) =>
                  Array.from({ length: count }, (_, i) => (
                    <div key={`${plate}-${i}`} style={{
                      width: Math.max(22, Math.min(40, plate * 1.4)),
                      height: Math.max(44, Math.min(86, plate * 3)),
                      borderRadius: 6,
                      background: (PLATE_COLOR[plate] ?? '#666') + 'cc',
                      border: '1px solid rgba(255,255,255,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800,
                      color: plate === 5 ? '#222' : '#fff',
                    }}>
                      {plate}
                    </div>
                  ))
                )}
              </div>
            )}
            {leftover > 0 && (
              <div style={{ color: 'var(--warning)', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
                ⚠ {leftover} {unit}/side can't be made with standard plates
                (closest: {(targetNum - leftover * 2).toLocaleString()} {unit})
              </div>
            )}
          </>
        )}

        <button className="btn-primary" onClick={onClose} style={{ marginTop: 8 }}>Done</button>
      </div>
    </div>
  );
}

export default function WorkoutScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkout, setWorkout, startRestTimer } = useWorkout();
  const [session, setSession] = useState<WorkoutSession | null>(activeWorkout);
  const [elapsed, setElapsed] = useState(0);
  const [history] = useState(() => getHistory());
  const [unit] = useState(() => getSettings().weightUnit);
  const [profile] = useState(() => getProfile());
  const [showPicker, setShowPicker] = useState(false);
  const [allEx] = useState<Exercise[]>(() => getExercises());
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerFor, setPickerFor] = useState<'add' | number | null>(null);
  const [pendingPRs, setPendingPRs] = useState<PersonalRecord[]>([]);
  const [prSetIds, setPrSetIds] = useState<Set<string>>(new Set());
  const [plateCalc, setPlateCalc] = useState<number | null>(null); // initial weight, null = closed
  const prIdsBySet = useRef<Map<string, string[]>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start from template if navigated with state
  useEffect(() => {
    const tmpl = (location.state as { template?: WorkoutTemplate } | null)?.template;
    if (tmpl && !activeWorkout) {
      const s: WorkoutSession = {
        id: generateId(), templateId: tmpl.id, name: tmpl.name, startTime: Date.now(),
        exercises: tmpl.exercises.map(te => ({
          exerciseId: te.exerciseId, exerciseName: te.exerciseName,
          sets: Array.from({ length: te.targetSets }, () => ({
            id: generateId(), weight: 0, reps: te.targetReps, completed: false, timestamp: Date.now(),
          })),
        })),
      };
      setWorkout(s); setSession(s);
    } else if (!tmpl && !activeWorkout && location.state !== null) {
      startEmpty();
    }
  }, []);

  useEffect(() => { setSession(activeWorkout); }, [activeWorkout]);

  useEffect(() => {
    if (session) {
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - session.startTime) / 1000)), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [session?.id]);

  const startEmpty = () => {
    const s: WorkoutSession = { id: generateId(), name: 'Quick Workout', startTime: Date.now(), exercises: [] };
    setWorkout(s); setSession(s);
  };

  const update = (s: WorkoutSession) => { setSession(s); setWorkout(s); };

  const addSet = (exIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { id: generateId(), weight: last?.weight ?? 0, reps: last?.reps ?? 10, completed: false, timestamp: Date.now() }] };
    });
    update({ ...session, exercises });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    if (!session) return;
    update({ ...session, exercises: session.exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }) });
  };

  const updateSetField = (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'rpe', val: string) => {
    if (!session) return;
    const num = parseFloat(val) || 0;
    update({ ...session, exercises: session.exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: num }) }) });
  };

  const toggleDone = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const set = session.exercises[exIdx].sets[setIdx];
    const nowDone = !set.completed;
    update({ ...session, exercises: session.exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, completed: nowDone, timestamp: Date.now() }) }) });
    if (nowDone) {
      startRestTimer();
      const ex = session.exercises[exIdx];
      const newPRs = checkForNewPRs(ex.exerciseId, ex.exerciseName, set.weight, set.reps);
      if (newPRs.length > 0) {
        prIdsBySet.current.set(set.id, newPRs.map(p => p.id));
        setPrSetIds(prev => new Set([...prev, set.id]));
        setPendingPRs(newPRs);
      }
    } else {
      // Un-ticking a set that triggered a PR removes that PR again
      const prIds = prIdsBySet.current.get(set.id);
      if (prIds) {
        deletePRs(prIds);
        prIdsBySet.current.delete(set.id);
        setPrSetIds(prev => { const next = new Set(prev); next.delete(set.id); return next; });
      }
    }
  };

  const removeExercise = (exIdx: number) => {
    if (!session || !confirm('Remove this exercise?')) return;
    update({ ...session, exercises: session.exercises.filter((_, i) => i !== exIdx) });
  };

  const addExercise = (ex: Exercise) => {
    if (!session) return;
    const newEx: ExerciseLog = { exerciseId: ex.id, exerciseName: ex.name, sets: [{ id: generateId(), weight: 0, reps: 10, completed: false, timestamp: Date.now() }] };
    update({ ...session, exercises: [...session.exercises, newEx] });
    setShowPicker(false); setPickerFor(null); setPickerSearch('');
  };

  const replaceExercise = (exIdx: number, newEx: Exercise) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      return {
        exerciseId: newEx.id,
        exerciseName: newEx.name,
        sets: ex.sets.map(s => ({ ...s, id: generateId(), weight: 0, completed: false, rpe: undefined })),
      };
    });
    update({ ...session, exercises });
    setPickerFor(null); setPickerSearch('');
  };

  const openReplacePicker = (exIdx: number) => {
    setPickerFor(exIdx);
    setPickerSearch('');
    setShowPicker(false);
  };

  const handlePickerSelect = (ex: Exercise) => {
    if (typeof pickerFor === 'number') replaceExercise(pickerFor, ex);
    else addExercise(ex);
  };

  const finish = () => {
    if (!session || !confirm('Finish and save this workout?')) return;
    const done = { ...session, endTime: Date.now() };
    saveSession(done); setWorkout(null); setSession(null);
    navigate('/workout/summary', { state: { session: done } });
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80dvh', padding: 32, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🏋️</div>
        <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}>Ready to Train?</div>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: 14 }}>Start an empty workout or tap a template from Home.</div>
        <button className="btn-primary" onClick={startEmpty} style={{ marginTop: 8 }}>Start Empty Workout</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="screen-header" style={{ position: 'sticky', top: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{session.name}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 }}>{formatStopwatch(elapsed)}</div>
        </div>
        <button onClick={finish} style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Finish
        </button>
      </div>

      <div style={{ padding: '8px 12px 100px' }}>
        {session.exercises.map((ex, exIdx) => {
          const targetReps = ex.sets[0]?.reps ?? 10;
          const suggestion = getSuggestedWeight(ex.exerciseId, targetReps, history, unit);
          const profileSuggKg = !suggestion && profile
            ? getProfileSuggestion(ex.exerciseId, profile, history, targetReps)
            : null;
          const profileWeight = profileSuggKg !== null
            ? (unit === 'lbs' ? Math.round(profileSuggKg * 2.20462 / 5) * 5 : profileSuggKg)
            : null;
          // Most recent session that actually contains this exercise (not just history[0])
          const lastLog = history
            .find(h => h.exercises.some(e => e.exerciseId === ex.exerciseId))
            ?.exercises.find(e => e.exerciseId === ex.exerciseId);
          const isBarbell = allEx.find(a => a.id === ex.exerciseId)?.equipment === 'barbell';
          const calcWeight = ex.sets.find(s => !s.completed && s.weight > 0)?.weight
            ?? ex.sets.find(s => s.weight > 0)?.weight
            ?? suggestion?.weight ?? profileWeight ?? 0;
          return (
            <div key={exIdx} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.exerciseName}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {isBarbell && (
                    <button onClick={() => setPlateCalc(calcWeight)} title="Plate calculator"
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '3px 8px', fontWeight: 500 }}>
                      Plates
                    </button>
                  )}
                  <button onClick={() => openReplacePicker(exIdx)} title="Replace exercise"
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '3px 8px', fontWeight: 500 }}>
                    Replace
                  </button>
                  <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, paddingLeft: 4 }}>✕</button>
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 44px 38px', gap: 4, marginBottom: 4 }}>
                {['SET','PREV',unit.toUpperCase(),'REPS','RPE','✓'].map(h => (
                  <div key={h} style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{h}</div>
                ))}
              </div>

              {ex.sets.map((set, setIdx) => {
                const prev = lastLog?.sets[setIdx];
                const prevText = prev?.completed ? `${prev.weight}×${prev.reps}` : '—';
                return (
                  <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 44px 38px', gap: 4, marginBottom: 6, opacity: set.completed && !prSetIds.has(set.id) ? 0.55 : 1 }}>
                    {/* Set number — tap to delete */}
                    <button
                      onClick={() => removeSet(exIdx, setIdx)}
                      title="Delete set"
                      style={{
                        width: 28, height: 34, borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'none', color: 'var(--text-secondary)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {setIdx + 1}
                    </button>
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{prevText}</div>
                    <input type="number" className="input"
                      value={set.weight > 0 ? set.weight : ''}
                      onChange={e => updateSetField(exIdx, setIdx, 'weight', e.target.value)}
                      placeholder={suggestion ? String(suggestion.weight) : profileWeight !== null ? String(profileWeight) : '0'}
                      disabled={set.completed}
                      style={{ textAlign: 'center', padding: '8px 4px', fontSize: 14 }}
                    />
                    <input type="number" className="input"
                      value={set.reps > 0 ? set.reps : ''}
                      onChange={e => updateSetField(exIdx, setIdx, 'reps', e.target.value)}
                      placeholder="0"
                      disabled={set.completed}
                      style={{ textAlign: 'center', padding: '8px 4px', fontSize: 14 }}
                    />
                    <input type="number" className="input"
                      value={set.rpe ?? ''}
                      onChange={e => updateSetField(exIdx, setIdx, 'rpe', e.target.value)}
                      placeholder="—"
                      disabled={set.completed}
                      min="1" max="10"
                      style={{ textAlign: 'center', padding: '8px 2px', fontSize: 14, color: set.rpe ? rpeColor(set.rpe) : undefined }}
                    />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={() => toggleDone(exIdx, setIdx)}
                        style={{
                          width: 34, height: 34, borderRadius: 8,
                          border: `2px solid ${prSetIds.has(set.id) ? '#FFD700' : set.completed ? 'var(--success)' : 'var(--border)'}`,
                          background: prSetIds.has(set.id) ? '#FFD700' : set.completed ? 'var(--success)' : 'transparent',
                          color: prSetIds.has(set.id) ? '#000' : '#fff',
                          cursor: 'pointer', fontSize: prSetIds.has(set.id) ? 12 : 16,
                          fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        {prSetIds.has(set.id) ? 'PR' : set.completed ? '✓' : ''}
                      </button>
                    </div>
                  </div>
                );
              })}

              {suggestion ? (
                <div style={{ fontSize: 12, marginTop: 4, color: suggestion.direction === 'increase' ? 'var(--success)' : suggestion.direction === 'decrease' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {suggestion.direction === 'increase' ? '↑' : suggestion.direction === 'decrease' ? '↓' : '→'} Suggested: {suggestion.weight}{unit}
                </div>
              ) : profileWeight !== null ? (
                <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>
                  ≈ Profile estimate: {profileWeight}{unit}
                </div>
              ) : null}

              <button onClick={() => addSet(exIdx)} style={{
                width: '100%', marginTop: 10, padding: '8px', border: '1px dashed var(--border)',
                borderRadius: 8, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
              }}>
                + Add Set
              </button>
            </div>
          );
        })}

        <button onClick={() => { setShowPicker(true); setPickerFor('add'); }} style={{
          width: '100%', padding: 14, border: '1px dashed var(--accent)', borderRadius: 12,
          background: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Exercise
        </button>
      </div>

      {(showPicker || typeof pickerFor === 'number') && (
        <div className="modal-overlay" onClick={() => { setShowPicker(false); setPickerFor(null); setPickerSearch(''); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85dvh' }}>
            <div className="modal-title">{typeof pickerFor === 'number' ? 'Replace Exercise' : 'Add Exercise'}</div>
            <input className="input" placeholder="Search..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
            <div style={{ overflowY: 'auto', maxHeight: '60dvh' }}>
              {allEx.filter(e => e.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(ex => (
                <div key={ex.id} onClick={() => handlePickerSelect(ex)} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 500 }}>{ex.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{ex.muscleGroup} · {ex.equipment}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {plateCalc !== null && (
        <PlateCalcModal
          initialWeight={plateCalc}
          unit={unit}
          onClose={() => setPlateCalc(null)}
        />
      )}

      {pendingPRs.length > 0 && (
        <PRCelebration
          prs={pendingPRs}
          unit={unit}
          onDone={() => setPendingPRs([])}
        />
      )}
    </div>
  );
}
