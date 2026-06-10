import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutTemplate, WorkoutSession, WeekSchedule } from '../types';
import { getTemplates, getHistory, getSchedule, setScheduledDay, clearScheduledDay, getSettings } from '../storage/storage';
import { formatDate, formatDuration, totalVolume } from '../utils/helpers';
import { useWorkout } from '../context/WorkoutContext';

// 0 = Sun … 6 = Sat, but we display Mon first
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// Display order: Mon(1) Tue(2) … Sun(0)
const DISPLAY_ORDER: (0|1|2|3|4|5|6)[] = [1,2,3,4,5,6,0];

function computeStreak(history: WorkoutSession[]): number {
  if (!history.length) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const dates = new Set(history.map(s => {
    const d = new Date(s.startTime); d.setHours(0,0,0,0); return d.getTime();
  }));
  let streak = 0;
  const cur = new Date(today);
  // Today not trained yet shouldn't break the streak — start from yesterday
  if (!dates.has(cur.getTime())) cur.setDate(cur.getDate() - 1);
  while (dates.has(cur.getTime())) { streak++; cur.setDate(cur.getDate() - 1); }
  return streak;
}

export default function HomeScreen() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [showScheduler, setShowScheduler] = useState<0|1|2|3|4|5|6 | null>(null);
  const [unit] = useState(() => getSettings().weightUnit);
  const navigate = useNavigate();
  const { activeWorkout } = useWorkout();

  const load = () => {
    setTemplates(getTemplates());
    setHistory(getHistory());
    setSchedule(getSchedule());
  };

  useEffect(load, []);

  const streak = computeStreak(history);
  const today = new Date();
  const todayDow = today.getDay() as 0|1|2|3|4|5|6;

  const workoutDays = new Set(history.map(s => {
    const d = new Date(s.startTime); d.setHours(0,0,0,0); return d.getTime();
  }));

  // Start of the current week (Monday at midnight)
  const todayMidnight = new Date(today); todayMidnight.setHours(0,0,0,0);
  const weekStart = new Date(todayMidnight);
  weekStart.setDate(todayMidnight.getDate() - (todayDow === 0 ? 6 : todayDow - 1));

  const assignTemplate = (day: 0|1|2|3|4|5|6, template: WorkoutTemplate) => {
    setScheduledDay(day, template.id, template.name);
    setSchedule(getSchedule());
    setShowScheduler(null);
  };

  const removeScheduled = (day: 0|1|2|3|4|5|6) => {
    clearScheduledDay(day);
    setSchedule(getSchedule());
  };

  const startScheduledWorkout = (template: WorkoutTemplate) => {
    navigate('/workout', { state: { template } });
  };

  // Find today's scheduled template object (if any)
  const todayScheduled = schedule[todayDow];
  const todayTemplate = todayScheduled
    ? templates.find(t => t.id === todayScheduled.templateId)
    : null;

  return (
    <div>
      {/* Greeting */}
      <div style={{ padding: '20px 16px 12px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Ready to train,</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: streak > 0 ? 6 : 0 }}>
          {today.toLocaleDateString('en-GB', { weekday: 'long' })}?
        </div>
        {streak > 0 && (
          <div style={{ color: 'var(--warning)', fontWeight: 600, fontSize: 14 }}>🔥 {streak} day streak</div>
        )}
      </div>

      {/* Today's workout CTA */}
      <div style={{ padding: '0 16px 16px' }}>
        {activeWorkout ? (
          <button className="btn-primary" onClick={() => navigate('/workout')} style={{ background: 'var(--success)' }}>
            ▶ Resume: {activeWorkout.name}
          </button>
        ) : todayTemplate ? (
          <button className="btn-primary" onClick={() => startScheduledWorkout(todayTemplate)}>
            ▶ Start Today's Workout — {todayTemplate.name}
          </button>
        ) : (
          <button className="btn-primary" onClick={() => navigate('/workout', { state: {} })}>
            🏋️ Start Empty Workout
          </button>
        )}
      </div>

      {/* ── Weekly Schedule ─────────────────────────────────────── */}
      <div style={{ margin: '0 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="section-label" style={{ margin: 0 }}>Weekly Schedule</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Tap a day to assign a workout</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DISPLAY_ORDER.map(dow => {
            const isToday = dow === todayDow;
            const scheduled = schedule[dow];

            // Exact date of this weekday in the current week (Mon=0 offset … Sun=6 offset)
            const daysFromMonday = dow === 0 ? 6 : dow - 1;
            const thisWeekDate = new Date(weekStart);
            thisWeekDate.setDate(weekStart.getDate() + daysFromMonday);
            // Only show done if the day has already passed (or is today) this week
            const didWorkout = thisWeekDate.getTime() <= todayMidnight.getTime()
              && workoutDays.has(thisWeekDate.getTime());

            return (
              <div key={dow} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                backgroundColor: isToday ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                borderRadius: 12,
                padding: '12px 14px',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
              }}>
                {/* Day label + done dot */}
                <div style={{ width: 44, flexShrink: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {DAY_LABELS[dow]}
                  </div>
                  {didWorkout && (
                    <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2 }}>✓ done</div>
                  )}
                </div>

                {/* Scheduled workout or add button */}
                {scheduled ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{scheduled.templateName}</div>
                    </div>
                    {isToday && todayTemplate && (
                      <button
                        onClick={() => startScheduledWorkout(todayTemplate)}
                        style={{
                          background: 'var(--accent)', border: 'none', color: '#fff',
                          borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}>
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => setShowScheduler(dow)}
                      style={{ background: 'var(--bg-primary)', border: 'none', color: 'var(--text-secondary)', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>
                      ✎
                    </button>
                    <button
                      onClick={() => removeScheduled(dow)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => templates.length > 0 ? setShowScheduler(dow) : navigate('/templates')}
                    style={{
                      flex: 1, background: 'none', border: '1px dashed var(--border)',
                      borderRadius: 8, padding: '8px 12px', color: 'var(--text-secondary)',
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    }}>
                    {templates.length > 0 ? '+ Assign workout' : '+ Create a template first'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent workouts */}
      {history.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
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
                  <span>📦 {Math.round(totalVolume(s))} {unit}</span>
                  <span>🏋️ {s.exercises.length} ex</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboarding */}
      {templates.length === 0 && history.length === 0 && (
        <div className="card" style={{ margin: '0 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>Welcome to GymTracker 💪</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8 }}>
            1. Go to <strong style={{ color: 'var(--accent)' }}>Templates</strong> to create a workout plan<br />
            2. Come back here and assign it to days of the week<br />
            3. Tap <strong style={{ color: 'var(--accent)' }}>Start</strong> on the day to begin your workout<br />
            4. Track sets, weight &amp; RPE — progressive overload kicks in automatically
          </div>
        </div>
      )}

      {/* Template picker modal for scheduling */}
      {showScheduler !== null && (
        <div className="modal-overlay" onClick={() => setShowScheduler(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Assign to {DAY_LABELS[showScheduler]}
            </div>
            {templates.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                No templates yet. Create one in the Templates tab first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => assignTemplate(showScheduler as 0|1|2|3|4|5|6, t)}
                    style={{
                      background: 'var(--bg-primary)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                    }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
                      {t.exercises.length} exercises · {t.exercises.reduce((s, e) => s + e.targetSets, 0)} sets total
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowScheduler(null)}
              style={{ width: '100%', marginTop: 16, padding: 12, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
