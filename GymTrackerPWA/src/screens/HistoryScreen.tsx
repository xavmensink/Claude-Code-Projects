import { useState, useEffect, useMemo } from 'react';
import { WorkoutSession } from '../types';
import { getHistory, deleteSession, getPRs } from '../storage/storage';
import { formatDate, formatDuration, totalVolume } from '../utils/helpers';
import { isPR } from '../utils/progressiveOverload';

function prCountForSession(s: WorkoutSession, allPRs: ReturnType<typeof getPRs>): number {
  const t0 = s.startTime;
  const t1 = s.endTime ?? Date.now();
  return allPRs.filter(p => p.achievedAt >= t0 && p.achievedAt <= t1).length;
}

function sessionDurationSecs(s: WorkoutSession): number {
  return s.endTime ? s.endTime - s.startTime : 0;
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  const load = () => setHistory(getHistory());
  useEffect(load, []);

  const allPRs = useMemo(() => getPRs(), [history]);

  // Best-session stats (only computed when history is non-empty)
  const bestStats = useMemo(() => {
    if (!history.length) return null;
    const finished = history.filter(s => s.endTime);
    const longest = finished.length
      ? finished.reduce((b, s) => sessionDurationSecs(s) > sessionDurationSecs(b) ? s : b)
      : null;
    const mostVolume = history.reduce((b, s) => totalVolume(s) > totalVolume(b) ? s : b);
    const mostPRs = history.reduce((b, s) => prCountForSession(s, allPRs) > prCountForSession(b, allPRs) ? s : b);
    const mostPRsCount = prCountForSession(mostPRs, allPRs);
    return { longest, mostVolume, mostPRs: mostPRsCount > 0 ? mostPRs : null, mostPRsCount };
  }, [history, allPRs]);

  const handleDelete = (s: WorkoutSession) => {
    if (confirm('Delete this workout from history?')) { deleteSession(s.id); setSelected(null); load(); }
  };

  if (selected) {
    const dur = selected.endTime ? formatDuration(Math.floor((selected.endTime - selected.startTime) / 1000)) : '—';
    const vol = totalVolume(selected);
    const prevHistory = history.filter(s => s.startTime < selected.startTime);

    return (
      <div>
        <div className="screen-header">
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 17, cursor: 'pointer' }}>‹ History</button>
          <button onClick={() => handleDelete(selected)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, cursor: 'pointer' }}>Delete</button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{selected.name}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>{formatDate(selected.startTime)}</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              ['⏱', dur,                                          'Duration'  ],
              ['📦', Math.round(vol).toLocaleString() + ' kg',    'Volume'    ],
              ['🏋️', String(selected.exercises.length),           'Exercises' ],
            ].map(([icon, val, label]) => (
              <div key={label} className="card" style={{ flex: 1, textAlign: 'center', padding: 12 }}>
                <div style={{ fontSize: 18 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{val}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>

          {selected.exercises.map((ex, i) => {
            const completedSets = ex.sets.filter(s => s.completed);
            return (
              <div key={i} className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{ex.exerciseName}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 28px', gap: 4, marginBottom: 6 }}>
                  {['Set','Weight','Reps','RPE','PR'].map(h => (
                    <div key={h} style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{h}</div>
                  ))}
                </div>
                {completedSets.map((set, si) => {
                  const ispr = isPR(set.weight, set.reps, ex.exerciseId, prevHistory);
                  return (
                    <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr 28px', gap: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{si + 1}</div>
                      <div style={{ textAlign: 'center', fontSize: 13 }}>{set.weight} kg</div>
                      <div style={{ textAlign: 'center', fontSize: 13 }}>{set.reps}</div>
                      <div style={{ textAlign: 'center', fontSize: 13, color: set.rpe ? (set.rpe <= 6 ? 'var(--success)' : set.rpe <= 8 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-muted)' }}>
                        {set.rpe ?? '—'}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 13 }}>{ispr ? '🏆' : ''}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header"><span className="screen-title">History</span></div>
      <div style={{ padding: 16 }}>
        {history.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">No workouts yet</div>
            <div className="empty-sub">Complete a workout to see your history</div>
          </div>
        )}

        {/* Best-session stats */}
        {bestStats && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>All-Time Bests</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {bestStats.longest && (
                <BestCard
                  icon="⏱"
                  label="Longest"
                  value={formatDuration(Math.floor(sessionDurationSecs(bestStats.longest) / 1000))}
                  sub={formatDate(bestStats.longest.startTime)}
                  onClick={() => setSelected(bestStats.longest!)}
                />
              )}
              <BestCard
                icon="📦"
                label="Most Volume"
                value={`${Math.round(totalVolume(bestStats.mostVolume)).toLocaleString()} kg`}
                sub={formatDate(bestStats.mostVolume.startTime)}
                onClick={() => setSelected(bestStats.mostVolume)}
              />
              {bestStats.mostPRs && (
                <BestCard
                  icon="🏆"
                  label="Most PRs"
                  value={`${bestStats.mostPRsCount} PR${bestStats.mostPRsCount !== 1 ? 's' : ''}`}
                  sub={formatDate(bestStats.mostPRs.startTime)}
                  onClick={() => setSelected(bestStats.mostPRs!)}
                />
              )}
            </div>
          </div>
        )}

        {/* Session list */}
        {history.map(s => {
          const dur     = s.endTime ? formatDuration(Math.floor((s.endTime - s.startTime) / 1000)) : null;
          const vol     = Math.round(totalVolume(s));
          const prCount = prCountForSession(s, allPRs);
          return (
            <div key={s.id} className="card" onClick={() => setSelected(s)} style={{ cursor: 'pointer', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(s.startTime)}</span>
              </div>

              <div style={{ display: 'flex', gap: 14, color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
                {dur && <span>⏱ {dur}</span>}
                <span>📦 {vol.toLocaleString()} kg</span>
                <span>🏋️ {s.exercises.length} ex</span>
                {prCount > 0 && (
                  <span style={{ color: '#FFD700', fontWeight: 600 }}>🏆 {prCount}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.exercises.slice(0, 4).map((ex, i) => (
                  <span key={i} style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>
                    {ex.exerciseName}
                  </span>
                ))}
                {s.exercises.length > 4 && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>+{s.exercises.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BestCard({ icon, label, value, sub, onClick }: { icon: string; label: string; value: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
    </button>
  );
}
