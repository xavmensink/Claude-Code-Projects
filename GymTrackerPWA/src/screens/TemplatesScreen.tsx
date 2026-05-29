import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutTemplate, TemplateExercise, Exercise } from '../types';
import { getTemplates, upsertTemplate, deleteTemplate, getExercises } from '../storage/storage';
import { generateId } from '../utils/helpers';

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const navigate = useNavigate();

  const load = () => setTemplates(getTemplates());
  useEffect(load, []);

  const openNew = () => setEditing({ id: generateId(), name: '', exercises: [] });

  const handleDelete = (t: WorkoutTemplate) => {
    if (confirm(`Delete "${t.name}"?`)) { deleteTemplate(t.id); load(); }
  };

  if (editing) {
    return <TemplateEditor
      template={editing}
      onSave={t => { upsertTemplate(t); setEditing(null); load(); }}
      onClose={() => setEditing(null)}
    />;
  }

  return (
    <div>
      <div className="screen-header">
        <span className="screen-title">Templates</span>
        <button onClick={openNew} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 26, cursor: 'pointer' }}>+</button>
      </div>

      <div style={{ padding: 16 }}>
        {templates.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <div className="empty-title">No templates yet</div>
            <div className="empty-sub">Create one to speed up your workouts</div>
          </div>
        )}

        {templates.map(t => (
          <div key={t.id} className="card" style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div onClick={() => setEditing({ ...t, exercises: t.exercises.map(e => ({ ...e })) })} style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name || 'Unnamed'}</div>
                <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginTop: 2 }}>{t.exercises.length} exercises</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => navigate('/workout', { state: { template: t } })}
                  style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Start
                </button>
                <button onClick={() => handleDelete(t)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {t.exercises.slice(0, 3).map((ex, i) => (
                <span key={i} style={{ color: 'var(--text-secondary)', fontSize: 13 }}>· {ex.exerciseName} — {ex.targetSets}×{ex.targetReps}</span>
              ))}
              {t.exercises.length > 3 && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>+{t.exercises.length - 3} more</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({ template, onSave, onClose }: {
  template: WorkoutTemplate;
  onSave: (t: WorkoutTemplate) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [exercises, setExercises] = useState<TemplateExercise[]>(template.exercises);
  const [pickerFor, setPickerFor] = useState<'add' | number | null>(null);
  const [allEx, setAllEx] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');

  const openPicker = () => { setAllEx(getExercises()); setPickerFor('add'); };
  const openReplace = (i: number) => { setAllEx(getExercises()); setPickerFor(i); setSearch(''); };
  const closePicker = () => { setPickerFor(null); setSearch(''); };

  const handlePick = (ex: Exercise) => {
    if (typeof pickerFor === 'number') {
      setExercises(prev => prev.map((e, idx) =>
        idx === pickerFor ? { ...e, exerciseId: ex.id, exerciseName: ex.name } : e
      ));
    } else {
      setExercises(prev => [...prev, { exerciseId: ex.id, exerciseName: ex.name, targetSets: 3, targetReps: 10 }]);
    }
    closePicker();
  };

  const remove = (i: number) => setExercises(prev => prev.filter((_, idx) => idx !== i));

  const updateField = (i: number, field: 'targetSets' | 'targetReps', val: string) => {
    const n = parseInt(val) || 0;
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: n } : e));
  };

  return (
    <div>
      <div className="screen-header">
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer' }}>Cancel</button>
        <span className="screen-title">Template</span>
        <button onClick={() => onSave({ ...template, name, exercises })}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Save
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <input className="input" placeholder="Template name (e.g. Push Day)" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 16 }} />

        <div className="section-label">Exercises</div>
        {exercises.map((ex, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.exerciseName}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => openReplace(i)} title="Replace exercise"
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '3px 8px', fontWeight: 500 }}>
                  Replace
                </button>
                <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 18, cursor: 'pointer', paddingLeft: 4 }}>🗑</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {(['targetSets', 'targetReps'] as const).map(field => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{field === 'targetSets' ? 'Sets' : 'Reps'}</div>
                  <input
                    type="number"
                    className="input"
                    value={ex[field]}
                    onChange={e => updateField(i, field, e.target.value)}
                    style={{ width: 60, textAlign: 'center', padding: '8px 4px' }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button onClick={openPicker} style={{
          width: '100%', padding: 14, marginTop: 4, border: '1px dashed var(--accent)', borderRadius: 10,
          background: 'none', color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Exercise
        </button>
      </div>

      {pickerFor !== null && (
        <div className="modal-overlay" onClick={closePicker}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85dvh' }}>
            <div className="modal-title">{typeof pickerFor === 'number' ? 'Replace Exercise' : 'Add Exercise'}</div>
            <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
            <div style={{ overflowY: 'auto', maxHeight: '60dvh' }}>
              {allEx.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).map(ex => (
                <div key={ex.id} onClick={() => handlePick(ex)}
                  style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
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
