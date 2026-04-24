import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkoutSession, ExerciseLog, SetLog, WorkoutTemplate, Exercise } from '../types';
import { getHistory, saveSession, getSettings, getExercises } from '../storage/storage';
import { useWorkout } from '../context/WorkoutContext';
import { getSuggestedWeight } from '../utils/progressiveOverload';
import { generateId, formatDuration } from '../utils/helpers';

function rpeColor(rpe: number) {
  if (rpe <= 6) return 'var(--success)';
  if (rpe <= 8) return 'var(--warning)';
  return 'var(--danger)';
}

export default function WorkoutScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkout, setWorkout, startRestTimer } = useWorkout();
  const [session, setSession] = useState<WorkoutSession | null>(activeWorkout);
  const [elapsed, setElapsed] = useState(0);
  const [history] = useState(() => getHistory());
  const [unit] = useState(() => getSettings().weightUnit);
  const [showPicker, setShowPicker] = useState(false);
  const [allEx] = useState<Exercise[]>(() => getExercises());
  const [pickerSearch, setPickerSearch] = useState('');
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
    const nowDone = !session.exercises[exIdx].sets[setIdx].completed;
    update({ ...session, exercises: session.exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, completed: nowDone, timestamp: Date.now() }) }) });
    if (nowDone) startRestTimer();
  };

  const removeExercise = (exIdx: number) => {
    if (!session || !confirm('Remove this exercise?')) return;
    update({ ...session, exercises: session.exercises.filter((_, i) => i !== exIdx) });
  };

  const addExercise = (ex: Exercise) => {
    if (!session) return;
    const newEx: ExerciseLog = { exerciseId: ex.id, exerciseName: ex.name, sets: [{ id: generateId(), weight: 0, reps: 10, completed: false, timestamp: Date.now() }] };
    update({ ...session, exercises: [...session.exercises, newEx] });
    setShowPicker(false); setPickerSearch('');
  };

  const finish = () => {
    if (!session || !confirm('Finish and save this workout?')) return;
    const done = { ...session, endTime: Date.now() };
    saveSession(done); setWorkout(null); setSession(null);
    navigate('/history');
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
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDuration(elapsed)}</div>
        </div>
        <button onClick={finish} style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Finish
        </button>
      </div>

      <div style={{ padding: '8px 12px 100px' }}>
        {session.exercises.map((ex, exIdx) => {
          const suggestion = getSuggestedWeight(ex.exerciseId, ex.sets[0]?.reps ?? 10, history, unit);
          return (
            <div key={exIdx} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.exerciseName}</div>
                <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 44px 38px', gap: 4, marginBottom: 4 }}>
                {['SET','PREV',unit.toUpperCase(),'REPS','RPE','✓'].map(h => (
                  <div key={h} style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{h}</div>
                ))}
              </div>

              {ex.sets.map((set, setIdx) => {
                const prev = history[0]?.exercises.find(e => e.exerciseId === ex.exerciseId)?.sets[setIdx];
                const prevText = prev?.completed ? `${prev.weight}×${prev.reps}` : '—';
                return (
                  <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 44px 38px', gap: 4, marginBottom: 6, opacity: set.completed ? 0.55 : 1 }}>
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
                      placeholder={suggestion ? String(suggestion.weight) : '0'}
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
                    <button onClick={() => toggleDone(exIdx, setIdx)}
                      style={{
                        width: 34, height: 34, borderRadius: 8, border: `2px solid ${set.completed ? 'var(--success)' : 'var(--border)'}`,
                        background: set.completed ? 'var(--success)' : 'transparent',
                        color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {set.completed ? '✓' : ''}
                    </button>
                  </div>
                );
              })}

              {suggestion && (
                <div style={{ fontSize: 12, marginTop: 4, color: suggestion.direction === 'increase' ? 'var(--success)' : suggestion.direction === 'decrease' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {suggestion.direction === 'increase' ? '↑' : suggestion.direction === 'decrease' ? '↓' : '→'} Suggested: {suggestion.weight}{unit}
                </div>
              )}

              <button onClick={() => addSet(exIdx)} style={{
                width: '100%', marginTop: 10, padding: '8px', border: '1px dashed var(--border)',
                borderRadius: 8, background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
              }}>
                + Add Set
              </button>
            </div>
          );
        })}

        <button onClick={() => setShowPicker(true)} style={{
          width: '100%', padding: 14, border: '1px dashed var(--accent)', borderRadius: 12,
          background: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Exercise
        </button>
      </div>

      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85dvh' }}>
            <div className="modal-title">Add Exercise</div>
            <input className="input" placeholder="Search..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
            <div style={{ overflowY: 'auto', maxHeight: '60dvh' }}>
              {allEx.filter(e => e.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(ex => (
                <div key={ex.id} onClick={() => addExercise(ex)} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 500 }}>{ex.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{ex.muscleGroup} · {ex.equipment}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
