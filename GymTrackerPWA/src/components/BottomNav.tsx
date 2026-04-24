import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkout } from '../context/WorkoutContext';

const TABS = [
  { path: '/',          label: 'Home',      icon: '🏠' },
  { path: '/exercises', label: 'Exercises', icon: '📋' },
  { path: '/templates', label: 'Templates', icon: '📁' },
  { path: '/workout',   label: 'Workout',   icon: '🏋️' },
  { path: '/history',   label: 'History',   icon: '📊' },
  { path: '/volume',    label: 'Volume',    icon: '📈' },
  { path: '/settings',  label: 'Settings',  icon: '⚙️' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkout } = useWorkout();

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      height: 'var(--nav-height)',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--bg-tertiary)',
      display: 'flex',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(tab => {
        const active = location.pathname === tab.path;
        const hasAlert = tab.path === '/workout' && activeWorkout != null;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '6px 0',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: 9,
              fontWeight: active ? 700 : 400,
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
            }}>
              {tab.label}
            </span>
            {hasAlert && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: '50%',
                transform: 'translateX(8px)',
                width: 8,
                height: 8,
                borderRadius: 4,
                background: 'var(--accent)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
