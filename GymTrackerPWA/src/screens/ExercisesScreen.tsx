import { useState, useEffect } from 'react';
import { Exercise, MuscleGroup, Equipment } from '../types';
import { getExercises, addExercise, deleteExercise } from '../storage/storage';
import { generateId } from '../utils/helpers';

const GROUPS: MuscleGroup[] = ['chest','back','shoulders','biceps','triceps','quads','hamstrings','glutes','calves','abs','forearms'];
const EQUIP: Equipment[] = ['barbell','dumbbell','cable','machine','bodyweight'];
const EQUIP_ICON: Record<Equipment, string> = { barbell:'🏋️', dumbbell:'💪', cable:'🔗', machine:'⚙️', bodyweight:'🤸' };
const GROUP_COLOR: Record<MuscleGroup, string> = {
  chest:'#e94560', back:'#4CAF50', shoulders:'#2196F3', biceps:'#FF9800', triceps:'#9C27B0',
  quads:'#00BCD4', hamstrings:'#FF5722', glutes:'#E91E63', calves:'#607D8B', abs:'#FFC107', forearms:'#795548',
};

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [equip, setEquip] = useState<Equipment>('barbell');

  const load = () => setExercises(getExercises());
  useEffect(load, []);

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) && (!filter || e.muscleGroup === filter)
  );

  const handleAdd = () => {
    if (!name.trim()) return;
    addExercise({ id: generateId(), name: name.trim(), muscleGroup: muscle, equipment: equip });
    setName(''); setShowAdd(false); load();
  };

  const handleDelete = (ex: Exercise) => {
    if (confirm(`Delete "${ex.name}"?`)) { deleteExercise(ex.id); load(); }
  };

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
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-title">No exercises found</div></div>}

        {filtered.map(ex => (
          <div key={ex.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            onContextMenu={e => { e.preventDefault(); handleDelete(ex); }}>
            <div style={{
              background: GROUP_COLOR[ex.muscleGroup] + '22',
              border: `1px solid ${GROUP_COLOR[ex.muscleGroup]}66`,
              borderRadius: 8, padding: '4px 8px',
            }}>
              <div style={{ color: GROUP_COLOR[ex.muscleGroup], fontSize: 10, fontWeight: 700 }}>
                {ex.muscleGroup.charAt(0).toUpperCase() + ex.muscleGroup.slice(1)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{EQUIP_ICON[ex.equipment]} {ex.equipment}</div>
            </div>
            <button onClick={() => handleDelete(ex)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Exercise</div>
            <input className="input" placeholder="Exercise name" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 16 }} autoFocus />

            <div className="section-label">Muscle Group</div>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {GROUPS.map(g => (
                <button key={g} className={`chip ${muscle === g ? 'active' : ''}`}
                  onClick={() => setMuscle(g)}
                  style={muscle === g ? { borderColor: GROUP_COLOR[g], color: GROUP_COLOR[g], background: GROUP_COLOR[g] + '22' } : {}}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
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
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleAdd}>Add Exercise</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
