import { useState } from 'react';
import { WorkoutSession } from '../types';
import { getHistory } from '../storage/storage';
import { VOLUME_GROUPS, getWeekRange, computeWeeklyVolume } from '../utils/volumeUtils';

const MIN_EFFECTIVE = 10;
const MAX_ADAPTIVE  = 20;
const BAR_MAX       = 25; // scale the bar ends here

function volumeColor(sets: number): string {
  if (sets === 0)               return 'var(--border)';
  if (sets < MIN_EFFECTIVE)     return '#e94560';
  if (sets <= MAX_ADAPTIVE)     return '#4CAF50';
  return '#FF9800';
}

function VolumeBar({ sets }: { sets: number }) {
  const fillPct  = Math.min((sets / BAR_MAX) * 100, 100);
  const zoneLeft = (MIN_EFFECTIVE / BAR_MAX) * 100;
  const zoneW    = ((MAX_ADAPTIVE - MIN_EFFECTIVE) / BAR_MAX) * 100;
  const color    = volumeColor(sets);

  return (
    <div>
      {/* Track */}
      <div style={{ position: 'relative', height: 12, borderRadius: 6, background: 'var(--bg-primary)', overflow: 'hidden' }}>
        {/* Effective volume zone shading */}
        <div style={{
          position: 'absolute',
          left: `${zoneLeft}%`, width: `${zoneW}%`,
          top: 0, bottom: 0,
          background: 'rgba(76,175,80,0.12)',
          borderLeft: '1.5px solid rgba(76,175,80,0.5)',
          borderRight: '1.5px solid rgba(255,152,0,0.5)',
        }} />
        {/* Fill */}
        <div style={{
          position: 'absolute',
          left: 0, width: `${fillPct}%`,
          top: 0, bottom: 0,
          borderRadius: 6,
          background: color,
          transition: 'width 0.55s cubic-bezier(0.4,0,0.2,1)',
          minWidth: sets > 0 ? 6 : 0,
        }} />
        {/* Zone boundary overlay so lines are always visible over fill */}
        <div style={{
          position: 'absolute',
          left: `${zoneLeft}%`, width: `${zoneW}%`,
          top: 0, bottom: 0,
          borderLeft: '1.5px solid rgba(76,175,80,0.55)',
          borderRight: '1.5px solid rgba(255,152,0,0.55)',
          pointerEvents: 'none',
        }} />
      </div>
      {/* Scale labels under bar */}
      <div style={{ position: 'relative', height: 14 }}>
        <span style={{
          position: 'absolute',
          left: `${zoneLeft}%`, transform: 'translateX(-50%)',
          fontSize: 9, color: 'rgba(76,175,80,0.7)', fontWeight: 600,
        }}>10</span>
        <span style={{
          position: 'absolute',
          left: `${zoneLeft + zoneW}%`, transform: 'translateX(-50%)',
          fontSize: 9, color: 'rgba(255,152,0,0.7)', fontWeight: 600,
        }}>20</span>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: '#e94560', label: '< 10 sets' },
    { color: '#4CAF50', label: '10 – 20' },
    { color: '#FF9800', label: '> 20 sets' },
  ];
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function VolumeScreen() {
  const [history] = useState<WorkoutSession[]>(() => getHistory());

  const thisWeek = computeWeeklyVolume(history, 0);
  const prevWeek = computeWeeklyVolume(history, -1);
  const { label: weekLabel } = getWeekRange(0);

  const totalThis = Object.values(thisWeek).reduce((a, b) => a + b, 0);
  const totalPrev = Object.values(prevWeek).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="screen-header">
        <span className="screen-title">Volume</span>
      </div>

      <div style={{ padding: '12px 16px 100px' }}>
        {/* Week label */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', letterSpacing: 0.4 }}>
            CURRENT WEEK
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {weekLabel}
          </div>
        </div>

        {/* Total sets banner */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 32,
          background: 'var(--bg-secondary)', borderRadius: 14,
          padding: '12px 20px', margin: '12px 0 16px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>{totalThis}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sets this week</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-secondary)' }}>{totalPrev}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last week</div>
          </div>
        </div>

        <Legend />

        {/* Muscle group cards */}
        {VOLUME_GROUPS.map(group => {
          const sets     = group.muscles.reduce((s, m) => s + (thisWeek[m] ?? 0), 0);
          const prev     = group.muscles.reduce((s, m) => s + (prevWeek[m] ?? 0), 0);
          const diff     = sets - prev;
          const color    = volumeColor(sets);

          let arrowIcon  = '→';
          let arrowColor = 'var(--text-muted)';
          if (diff > 0)  { arrowIcon = `↑${diff}`; arrowColor = 'var(--success)'; }
          if (diff < 0)  { arrowIcon = `↓${Math.abs(diff)}`; arrowColor = 'var(--danger)'; }

          const statusText =
            sets === 0               ? 'Not trained'        :
            sets < MIN_EFFECTIVE     ? 'Below minimum'      :
            sets <= MAX_ADAPTIVE     ? 'Effective range ✓'  :
                                       'Above max adaptive' ;

          return (
            <div key={group.label} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{group.label}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: sets === 0 ? 'var(--text-muted)' : color, fontWeight: 500 }}>
                    {statusText}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: sets === 0 ? 'var(--text-muted)' : color }}>
                    {sets}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>sets</span>
                  {(sets > 0 || prev > 0) && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: arrowColor, marginLeft: 2 }}>
                      {arrowIcon}
                    </span>
                  )}
                </div>
              </div>

              <VolumeBar sets={sets} />

              {prev > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  Last week: {prev} sets
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>MEV</strong> (Min. Effective Volume) = 10 sets/week &nbsp;·&nbsp;
            <strong style={{ color: 'var(--text-secondary)' }}>MAV</strong> (Max. Adaptive Volume) = 20 sets/week
            <br />Resets each Monday based on session dates.
          </div>
        </div>
      </div>
    </div>
  );
}
