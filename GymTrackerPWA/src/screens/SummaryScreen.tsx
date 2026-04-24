import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkoutSession } from '../types';
import { getPRs, getExercises } from '../storage/storage';
import { formatDate, formatDuration, totalVolume } from '../utils/helpers';

const GROUP_COLOR: Record<string, string> = {
  chest: '#e94560', back: '#4CAF50', shoulders: '#2196F3',
  biceps: '#FF9800', triceps: '#9C27B0', quads: '#00BCD4',
  hamstrings: '#FF5722', glutes: '#E91E63', calves: '#607D8B',
  abs: '#FFC107', forearms: '#795548',
};

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px' }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 17, margin: '4px 0 2px' }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</div>
    </div>
  );
}

export default function SummaryScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = (location.state as { session?: WorkoutSession } | null)?.session ?? null;

  useEffect(() => { if (!session) navigate('/', { replace: true }); }, [session, navigate]);
  if (!session) return null;

  const durationSecs = Math.floor(((session.endTime ?? Date.now()) - session.startTime) / 1000);
  const dur   = formatDuration(durationSecs);
  const vol   = totalVolume(session);
  const sets  = session.exercises.reduce((t, ex) => t + ex.sets.filter(s => s.completed).length, 0);

  // PRs achieved during this session (matched by achievedAt timestamp)
  const sessionPRs = useMemo(() => {
    const t0 = session.startTime;
    const t1 = session.endTime ?? Date.now();
    return getPRs().filter(p => p.achievedAt >= t0 && p.achievedAt <= t1);
  }, [session]);

  // Unique muscle groups trained
  const exercises   = getExercises();
  const exMap       = new Map(exercises.map(e => [e.id, e]));
  const muscleGroups = [...new Set(
    session.exercises.map(ex => exMap.get(ex.exerciseId)?.muscleGroup).filter(Boolean) as string[]
  )];

  return (
    <div>
      <div className="screen-header">
        <span className="screen-title">Workout Complete</span>
      </div>

      <div style={{ padding: '16px 16px 100px' }}>
        {/* Celebration header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 52 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{session.name}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {formatDate(session.startTime)}&nbsp;·&nbsp;
            {new Date(session.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Key stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <StatCard icon="⏱" value={dur}                                     label="Duration"  />
          <StatCard icon="✅" value={String(sets)}                            label="Sets done" />
          <StatCard icon="📦" value={`${Math.round(vol).toLocaleString()} kg`} label="Volume"   />
        </div>

        {/* Muscle groups trained */}
        {muscleGroups.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Muscles Trained</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {muscleGroups.map(mg => (
                <span key={mg} style={{
                  background: (GROUP_COLOR[mg] ?? '#888') + '22',
                  border: `1px solid ${GROUP_COLOR[mg] ?? '#888'}66`,
                  color: GROUP_COLOR[mg] ?? '#888',
                  borderRadius: 8, padding: '4px 10px',
                  fontSize: 12, fontWeight: 600,
                }}>
                  {mg.charAt(0).toUpperCase() + mg.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PRs achieved */}
        {sessionPRs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Personal Records 🏆</div>
            {sessionPRs.map(pr => (
              <div key={pr.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.28)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 8,
              }}>
                <span style={{ fontSize: 24 }}>🏆</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{pr.exerciseName}</div>
                  <div style={{ color: '#FFD700', fontWeight: 800, fontSize: 16 }}>
                    {pr.weight} kg × {pr.reps} reps
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>
                    New heaviest weight for this exercise 🔥
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Exercise breakdown */}
        <div style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Exercises</div>
          {session.exercises.map((ex, i) => {
            const done = ex.sets.filter(s => s.completed);
            if (!done.length) return null;
            return (
              <div key={i} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{ex.exerciseName}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {done.map((set, si) => {
                    const isPR = sessionPRs.some(p => p.exerciseId === ex.exerciseId && p.weight === set.weight && p.reps === set.reps);
                    return (
                      <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', width: 20 }}>#{si + 1}</span>
                        <span style={{ fontWeight: 600 }}>{set.weight} kg × {set.reps}</span>
                        {set.rpe != null && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>RPE {set.rpe}</span>
                        )}
                        {isPR && <span style={{ fontSize: 13 }}>🏆</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <button className="btn-primary" onClick={() => navigate('/')}>
          Back to Home
        </button>
        <button
          onClick={() => navigate('/history')}
          style={{
            width: '100%', marginTop: 10, padding: 14,
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 12, color: 'var(--text-secondary)',
            fontSize: 15, cursor: 'pointer',
          }}
        >
          View History
        </button>
      </div>
    </div>
  );
}
