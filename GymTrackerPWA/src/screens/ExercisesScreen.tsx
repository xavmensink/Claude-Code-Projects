import { useState, useEffect, useMemo } from 'react';
import { Exercise, MuscleGroup, Equipment } from '../types';
import { getExercises, addExercise, deleteExercise, getExercisePRSummary, getSettings, getHistory } from '../storage/storage';
import { generateId, formatDate } from '../utils/helpers';

const GROUPS: MuscleGroup[] = ['chest','back','shoulders','biceps','triceps','quads','hamstrings','glutes','calves','abs','forearms'];
const EQUIP: Equipment[] = ['barbell','dumbbell','cable','machine','bodyweight'];
const EQUIP_ICON: Record<Equipment, string> = { barbell:'🏋️', dumbbell:'💪', cable:'🔗', machine:'⚙️', bodyweight:'🤸' };
export const GROUP_COLOR: Record<MuscleGroup, string> = {
  chest:'#e94560', back:'#4CAF50', shoulders:'#2196F3', biceps:'#FF9800', triceps:'#9C27B0',
  quads:'#00BCD4', hamstrings:'#FF5722', glutes:'#E91E63', calves:'#607D8B', abs:'#FFC107', forearms:'#795548',
};

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Best estimated 1RM (Epley) per session for an exercise, oldest first
function compute1RMHistory(exerciseId: string): { date: number; oneRM: number }[] {
  const points: { date: number; oneRM: number }[] = [];
  for (const session of getHistory()) {
    let best = 0;
    for (const ex of session.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.completed && set.weight > 0 && set.reps > 0) {
          const rm = set.weight * (1 + set.reps / 30);
          if (rm > best) best = rm;
        }
      }
    }
    if (best > 0) points.push({ date: session.startTime, oneRM: best });
  }
  return points.sort((a, b) => a.date - b.date);
}

function ProgressChart({ points, unit, color }: { points: { date: number; oneRM: number }[]; unit: string; color: string }) {
  const W = 320, H = 120, padX = 6, padY = 14;
  const values = points.map(p => p.oneRM);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) => points.length === 1
    ? W / 2
    : padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = (v: number) => H - padY - ((v - min) / range) * (H - padY * 2);

  const path = points.map((p, i) => `${x(i)},${y(p.oneRM)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const diff = last.oneRM - first.oneRM;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color }}>
          {Math.round(last.oneRM)} {unit}
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>est. 1RM</span>
        </span>
        {points.length > 1 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {diff >= 0 ? '↑' : '↓'} {Math.abs(Math.round(diff))} {unit} since {formatDate(first.date)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <polyline
          points={path}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.oneRM)} r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? color : 'var(--bg-secondary)'}
            stroke={color} strokeWidth={1.5} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        <span>{formatDate(first.date)}</span>
        <span>{points.length} session{points.length !== 1 ? 's' : ''}</span>
        <span>{formatDate(last.date)}</span>
      </div>
    </div>
  );
}

function MuscleTag({ group, small }: { group: MuscleGroup; small?: boolean }) {
  return (
    <span style={{
      background: GROUP_COLOR[group] + '22',
      border: `1px solid ${GROUP_COLOR[group]}55`,
      borderRadius: 6, padding: small ? '2px 6px' : '3px 8px',
      color: GROUP_COLOR[group], fontSize: small ? 10 : 11, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {cap(group)}
    </span>
  );
}

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [equip, setEquip] = useState<Equipment>('barbell');
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);
  const [unit] = useState(() => getSettings().weightUnit);

  const load = () => setExercises(getExercises());
  useEffect(load, []);

  // Filter matches primary OR any secondary muscle group
  const filtered = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filter || e.muscleGroup === filter ||
      (e.secondaryMuscleGroups ?? []).includes(filter);
    return matchesSearch && matchesFilter;
  });

  const toggleSecondary = (g: MuscleGroup) => {
    setSecondaryMuscles(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    addExercise({
      id: generateId(),
      name: name.trim(),
      muscleGroup: muscle,
      secondaryMuscleGroups: secondaryMuscles.filter(g => g !== muscle),
      equipment: equip,
    });
    setName(''); setSecondaryMuscles([]); setShowAdd(false); load();
  };

  const handleDelete = (ex: Exercise) => {
    if (confirm(`Delete "${ex.name}"?`)) { deleteExercise(ex.id); load(); }
  };

  const prSummary = selectedEx ? getExercisePRSummary(selectedEx.id) : null;
  const progressPoints = useMemo(
    () => selectedEx ? compute1RMHistory(selectedEx.id) : [],
    [selectedEx],
  );

  return (
    <div>
      <div className="screen-header">
        <span className="screen-title">Exercises</span>
        <button onClick={() => setShowAdd(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>+</button>
      </div>

      <div style={{ padding: 16 }}>
        <input className="input" placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />

        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button className={`chip ${!filter ? 'active' : ''}`} onClick={() => setFilter(null)}>All</button>
          {GROUPS.map(g => (
            <button key={g} className={`chip ${filter === g ? 'active' : ''}`}
              onClick={() => setFilter(filter === g ? null : g)}
              style={filter === g ? { borderColor: GROUP_COLOR[g], color: GROUP_COLOR[g], background: GROUP_COLOR[g] + '22' } : {}}
            >
              {cap(g)}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-title">No exercises found</div></div>}

        {filtered.map(ex => (
          <div key={ex.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onClick={() => setSelectedEx(ex)}
            onContextMenu={e => { e.preventDefault(); handleDelete(ex); }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 5 }}>{ex.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <MuscleTag group={ex.muscleGroup} />
                {(ex.secondaryMuscleGroups ?? []).map(g => (
                  <MuscleTag key={g} group={g} small />
                ))}
                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 2 }}>
                  {EQUIP_ICON[ex.equipment]}
                </span>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(ex); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Exercise detail modal */}
      {selectedEx && (
        <div className="modal-overlay" onClick={() => setSelectedEx(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div className="modal-title" style={{ marginBottom: 6 }}>{selectedEx.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <MuscleTag group={selectedEx.muscleGroup} />
                  {(selectedEx.secondaryMuscleGroups ?? []).map(g => (
                    <MuscleTag key={g} group={g} small />
                  ))}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 4 }}>
                    {EQUIP_ICON[selectedEx.equipment]} {selectedEx.equipment}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedEx(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            {progressPoints.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Progress</div>
                <ProgressChart
                  points={progressPoints}
                  unit={unit}
                  color={GROUP_COLOR[selectedEx.muscleGroup]}
                />
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Personal Records</div>
              {!prSummary?.weightPR ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '12px 0', textAlign: 'center' }}>
                  No PR yet — log a set to start tracking!
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ fontSize: 28 }}>🏆</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#FFD700', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Best Weight</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>
                      {prSummary.weightPR.weight} {unit}
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,215,0,0.7)', marginLeft: 6 }}>
                        × {prSummary.weightPR.reps} reps
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatDate(prSummary.weightPR.achievedAt)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => handleDelete(selectedEx)}
              style={{
                width: '100%', marginTop: 20, padding: 12, background: 'none',
                border: '1px solid rgba(233,69,96,0.3)', borderRadius: 10,
                color: 'var(--danger)', cursor: 'pointer', fontSize: 14,
              }}>
              Delete Exercise
            </button>
          </div>
        </div>
      )}

      {/* Add Exercise modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Exercise</div>
            <input className="input" placeholder="Exercise name" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 16 }} autoFocus />

            <div className="section-label">Primary Muscle</div>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {GROUPS.map(g => (
                <button key={g} className={`chip ${muscle === g ? 'active' : ''}`}
                  onClick={() => { setMuscle(g); setSecondaryMuscles(prev => prev.filter(x => x !== g)); }}
                  style={muscle === g ? { borderColor: GROUP_COLOR[g], color: GROUP_COLOR[g], background: GROUP_COLOR[g] + '22' } : {}}
                >
                  {cap(g)}
                </button>
              ))}
            </div>

            <div className="section-label">Secondary Muscles <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></div>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {GROUPS.filter(g => g !== muscle).map(g => (
                <button key={g} className={`chip ${secondaryMuscles.includes(g) ? 'active' : ''}`}
                  onClick={() => toggleSecondary(g)}
                  style={secondaryMuscles.includes(g) ? { borderColor: GROUP_COLOR[g], color: GROUP_COLOR[g], background: GROUP_COLOR[g] + '22' } : {}}
                >
                  {cap(g)}
                </button>
              ))}
            </div>

            <div className="section-label">Equipment</div>
            <div className="chip-row" style={{ marginBottom: 24 }}>
              {EQUIP.map(eq => (
                <button key={eq} className={`chip ${equip === eq ? 'active' : ''}`} onClick={() => setEquip(eq)}>
                  {EQUIP_ICON[eq]} {eq}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setShowAdd(false); setSecondaryMuscles([]); }}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleAdd}>Add Exercise</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
