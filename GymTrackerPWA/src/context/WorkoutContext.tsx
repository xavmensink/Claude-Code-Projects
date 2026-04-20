import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { WorkoutSession } from '../types';
import { getActiveWorkout, setActiveWorkout, getSettings } from '../storage/storage';
import { playBeep, vibrate } from '../utils/helpers';

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

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkoutLocal] = useState<WorkoutSession | null>(getActiveWorkout);
  const [timer, setTimer] = useState<TimerState>({ isRunning: false, secondsLeft: 0, totalSeconds: 120 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const defaultDuration = useRef(getSettings().restTimerDuration);

  useEffect(() => {
    defaultDuration.current = getSettings().restTimerDuration;
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const startRestTimer = useCallback((seconds?: number) => {
    const duration = seconds ?? defaultDuration.current;
    clearTimer();
    setTimer({ isRunning: true, secondsLeft: duration, totalSeconds: duration });

    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev.secondsLeft <= 1) {
          clearTimer();
          // Alert: beep + vibrate + notification
          playBeep();
          vibrate([200, 100, 200, 100, 200]);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Rest Over! 💪', { body: 'Time to hit your next set!' });
          }
          return { ...prev, isRunning: false, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
  }, [clearTimer]);

  const extendTimer = useCallback((seconds: number) => {
    setTimer(prev => ({ ...prev, secondsLeft: prev.secondsLeft + seconds, isRunning: true }));
    // Re-start interval if not running
    if (!intervalRef.current) startRestTimer(timer.secondsLeft + seconds);
  }, [timer.secondsLeft, startRestTimer]);

  const dismissTimer = useCallback(() => {
    clearTimer();
    setTimer(prev => ({ ...prev, isRunning: false, secondsLeft: 0 }));
  }, [clearTimer]);

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
