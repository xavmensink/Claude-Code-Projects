import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutTemplate, WorkoutSession } from '../types';
import { getTemplates, getHistory } from '../storage/storage';
import { formatDate, formatDuration, totalVolume } from '../utils/helpers';
import { useWorkout } from '../context/WorkoutContext';

function computeStreak(history: WorkoutSession[]): number {
  if (!history.length) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dates = new Set(history.map(s => { const d = new Date(s.startTime); d.setHours(0,0,0,0); return d.getTime(); }));
  let streak = 0;
  const cur = new Date(today);
  while (dates.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 1); }
  return streak;
}

export default function HomeScreen() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const navigate = useNavigate();
  const { activeWorkout } = useWorkout();

  useEffect(() => {
    setTemplates(getTemplates());
    setHistory(getHistory());
  }, []);

  const streak = computeStreak(history);
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const today = new Date();
  const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const todayDow = (today.getDay() + 6) % 7;
  const workoutDays = new Set(history.map(s => { const d = new Date(s.startTime); d.setHours(0,0,0,0); return d.getTime(); }));
  const weekDots = weekDays.map((label, i) => {
    const d = new Date(today); d.setDate(today.getDate() - todayDow + i); d.setHours(0,0,0,0);
    return { label, done: workoutDays.has(d.getTime()), isToday: i === todayDow };
  });

  return (
    <div>
      <div style={{ padding: '24px 16px 12px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Ready to train,</div>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: streak > 0 ? 8 : 0 }}>{dayName}?</div>
        {streak > 0 && <div style={{ color: 'var(--warning)', fontWeight: 600, fontSize: 15 }}>🔥 {streak} day streak</div>}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {activeWorkout ? (
          <button className="btn-primary" onClick={() => navigate('/workout')} style={{ background: 'var(--success)' }}>
            ▶ Resume Active Workout: {activeWorkout.name}
          </button>
        ) : (
          <button className="btn-primary" onClick={() => navigate('/workout')}>
            🏋️ Start Empty Workout
          </button>
        )}
      </div>

      {/* Weekly chart */}
      <div style={{ margin: '0 16px 16px' }} className="card">
        <div className="section-label">This Week</div>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {weekDots.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 16,
                background: d.done ? 'var(--accent)' : 'var(--bg-primary)',
                border: `2px solid ${d.isToday ? 'var(--accent)' : d.done ? 'var(--accent)' : 'var(--border)'}`,
              }} />
              <span style={{ fontSize: 11, color: d.isToday ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: d.isToday ? 700 : 400 }}>
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick-start templates */}
      {templates.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ padding: '0 16px 8px' }}>Quick Start</div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
            {templates.map(t => (
              <div
                key={t.id}
                className="card"
                onClick={() => navigate('/workout', { state: { template: t } })}
                style={{ minWidth: 170, cursor: 'pointer', marginBottom: 0, flexShrink: 0 }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.name}</div>
                <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t.exercises.length} exercises</div>
                {t.exercises.slice(0, 3).map((ex, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>· {ex.exerciseName}</div>
                ))}
                {t.exercises.length > 3 && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>+{t.exercises.length - 3} more</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent workouts */}
      {history.length > 0 && (
        <div style={{ padding: '0 16px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Recent Workouts</div>
          {history.slice(0, 3).map(s => {
            const dur = s.endTime ? formatDuration(Math.floor((s.endTime - s.startTime) / 1000)) : '—';
            return (
              <div key={s.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(s.startTime)}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, color: 'var(--text-secondary)', fontSize: 13 }}>
                  <span>⏱ {dur}</span>
                  <span>📦 {Math.round(totalVolume(s))} kg</span>
                  <span>🏋️ {s.exercises.length} ex</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {templates.length === 0 && history.length === 0 && (
        <div className="card" style={{ margin: '0 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>Welcome to GymTracker 💪</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
            1. Go to <strong style={{ color: 'var(--accent)' }}>Templates</strong> to create a workout plan{'\n'}
            2. Tap <strong style={{ color: 'var(--accent)' }}>Start Empty Workout</strong> to log now{'\n'}
            3. Track sets, weight &amp; RPE in real time{'\n'}
            4. Progressive overload suggestions appear automatically
          </div>
        </div>
      )}
    </div>
  );
}
