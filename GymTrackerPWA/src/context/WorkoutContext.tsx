import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { WorkoutSession } from '../types';
import { getActiveWorkout, setActiveWorkout, getSettings } from '../storage/storage';
import { playBeep, vibrate } from '../utils/helpers';

const TIMER_END_KEY   = 'gt_timer_end';
const TIMER_TOTAL_KEY = 'gt_timer_total';

interface TimerState {
  isRunning: boolean;
  secondsLeft: number;
  totalSeconds: number;
}

interface Ctx {
  activeWorkout: WorkoutSession | null;
  setWorkout: (s: WorkoutSession | null) => void;
  timer: TimerState;
  startRestTimer: (seconds?: number) => void;
  extendTimer: (seconds: number) => void;
  dismissTimer: () => void;
}

const WorkoutContext = createContext<Ctx | null>(null);

// Post a message to the active service worker (fire-and-forget)
async function postToSW(msg: object) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    reg?.active?.postMessage(msg);
  } catch { /* SW not available */ }
}

// Ask the Cloudflare push server to deliver a push after `delayMs`
async function scheduleServerPush(delayMs: number) {
  const serverUrl = localStorage.getItem('gt_push_server');
  const subJson   = localStorage.getItem('gt_push_sub');
  if (!serverUrl || !subJson) return;
  try {
    await fetch(`${serverUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: JSON.parse(subJson), delay: delayMs }),
    });
  } catch { /* network unavailable, SW fallback will cover it */ }
}

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkoutLocal] = useState<WorkoutSession | null>(getActiveWorkout);
  const [timer, setTimer] = useState<TimerState>({ isRunning: false, secondsLeft: 0, totalSeconds: 120 });
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertFiredRef  = useRef(false);
  const defaultDuration = useRef(getSettings().restTimerDuration);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const fireAlert = useCallback(() => {
    if (alertFiredRef.current) return;
    alertFiredRef.current = true;
    playBeep();
    vibrate([200, 100, 200, 100, 200]);
    // Use service-worker notification so it shows even when the page is hidden
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification('Rest Over! 💪', {
          body: 'Time to hit your next set!',
          icon: '/Claude-Code-Projects/icon-192.png',
          ...({ vibrate: [200, 100, 200, 100, 200] } as object),
          tag: 'rest-timer',
          renotify: true,
        } as NotificationOptions);
      }).catch(() => {
        // Fallback for browsers without SW notification support
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Rest Over! 💪', { body: 'Time to hit your next set!' });
        }
      });
    }
  }, []);

  const syncFromStorage = useCallback(() => {
    const stored = localStorage.getItem(TIMER_END_KEY);
    if (!stored) return;
    const endTime   = parseInt(stored, 10);
    const totalSecs = parseInt(localStorage.getItem(TIMER_TOTAL_KEY) ?? '120', 10);
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

    if (remaining === 0) {
      stopInterval();
      localStorage.removeItem(TIMER_END_KEY);
      localStorage.removeItem(TIMER_TOTAL_KEY);
      fireAlert();
      setTimer({ isRunning: false, secondsLeft: 0, totalSeconds: totalSecs });
    } else {
      setTimer({ isRunning: true, secondsLeft: remaining, totalSeconds: totalSecs });
    }
  }, [stopInterval, fireAlert]);

  const startRestTimer = useCallback((seconds?: number) => {
    const duration = seconds ?? defaultDuration.current;
    stopInterval();
    alertFiredRef.current = false;

    const endTime = Date.now() + duration * 1000;
    localStorage.setItem(TIMER_END_KEY,   String(endTime));
    localStorage.setItem(TIMER_TOTAL_KEY, String(duration));
    setTimer({ isRunning: true, secondsLeft: duration, totalSeconds: duration });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    intervalRef.current = setInterval(syncFromStorage, 1000);

    // SW-based backup: schedules a notification inside the service worker.
    // Works while the SW is alive (app briefly backgrounded).
    postToSW({ type: 'SCHEDULE_NOTIFICATION', delay: duration * 1000 });

    // Server-based push: works even when the app is fully closed.
    scheduleServerPush(duration * 1000);
  }, [stopInterval, syncFromStorage]);

  const extendTimer = useCallback((seconds: number) => {
    alertFiredRef.current = false;
    const stored = localStorage.getItem(TIMER_END_KEY);
    const base   = stored ? Math.max(parseInt(stored, 10), Date.now()) : Date.now();
    const newEnd = base + seconds * 1000;
    const total  = parseInt(localStorage.getItem(TIMER_TOTAL_KEY) ?? '120', 10);
    localStorage.setItem(TIMER_END_KEY, String(newEnd));
    const remaining = Math.max(0, Math.ceil((newEnd - Date.now()) / 1000));
    setTimer(prev => ({ ...prev, secondsLeft: remaining, totalSeconds: total, isRunning: true }));
    if (!intervalRef.current) {
      intervalRef.current = setInterval(syncFromStorage, 1000);
    }
    postToSW({ type: 'SCHEDULE_NOTIFICATION', delay: remaining * 1000 });
    scheduleServerPush(remaining * 1000);
  }, [syncFromStorage]);

  const dismissTimer = useCallback(() => {
    stopInterval();
    localStorage.removeItem(TIMER_END_KEY);
    localStorage.removeItem(TIMER_TOTAL_KEY);
    setTimer(prev => ({ ...prev, isRunning: false, secondsLeft: 0 }));
    postToSW({ type: 'CANCEL_NOTIFICATION' });
  }, [stopInterval]);

  // Recover an in-progress timer on mount
  useEffect(() => {
    const stored = localStorage.getItem(TIMER_END_KEY);
    if (stored) {
      const endTime   = parseInt(stored, 10);
      const totalSecs = parseInt(localStorage.getItem(TIMER_TOTAL_KEY) ?? '120', 10);
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      if (remaining > 0) {
        setTimer({ isRunning: true, secondsLeft: remaining, totalSeconds: totalSecs });
        intervalRef.current = setInterval(syncFromStorage, 1000);
      } else {
        localStorage.removeItem(TIMER_END_KEY);
        localStorage.removeItem(TIMER_TOTAL_KEY);
      }
    }
    return stopInterval;
  }, [syncFromStorage, stopInterval]);

  // Resync when app comes back to the foreground (iOS throttles background intervals)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncFromStorage();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [syncFromStorage]);

  const setWorkout = useCallback((s: WorkoutSession | null) => {
    setActiveWorkoutLocal(s);
    setActiveWorkout(s);
  }, []);

  return (
    <WorkoutContext.Provider value={{ activeWorkout, setWorkout, timer, startRestTimer, extendTimer, dismissTimer }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be inside WorkoutProvider');
  return ctx;
}
