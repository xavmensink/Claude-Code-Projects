import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { WorkoutSession } from '../types';
import { getActiveWorkout, setActiveWorkout, getSettings } from '../storage/storage';

interface TimerState {
  isRunning: boolean;
  secondsLeft: number;
  totalSeconds: number;
}

interface WorkoutContextType {
  activeWorkout: WorkoutSession | null;
  setActiveWorkoutState: (session: WorkoutSession | null) => void;
  timer: TimerState;
  startRestTimer: (seconds?: number) => void;
  extendTimer: (seconds: number) => void;
  dismissTimer: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkoutLocal] = useState<WorkoutSession | null>(null);
  const [timer, setTimer] = useState<TimerState>({ isRunning: false, secondsLeft: 0, totalSeconds: 120 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const defaultDurationRef = useRef(120);

  useEffect(() => {
    getActiveWorkout().then(setActiveWorkoutLocal);
    getSettings().then((s) => { defaultDurationRef.current = s.restTimerDuration; });

    Notifications.requestPermissionsAsync();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const startRestTimer = useCallback((seconds?: number) => {
    const duration = seconds ?? defaultDurationRef.current;
    clearTimer();
    setTimer({ isRunning: true, secondsLeft: duration, totalSeconds: duration });

    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev.secondsLeft <= 1) {
          clearTimer();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Rest Over!',
              body: 'Time to hit your next set! 💪',
            },
            trigger: null,
          });
          return { ...prev, isRunning: false, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
  }, [clearTimer]);

  const extendTimer = useCallback((seconds: number) => {
    setTimer((prev) => ({ ...prev, secondsLeft: prev.secondsLeft + seconds }));
  }, []);

  const dismissTimer = useCallback(() => {
    clearTimer();
    setTimer((prev) => ({ ...prev, isRunning: false, secondsLeft: 0 }));
  }, [clearTimer]);

  const setActiveWorkoutState = useCallback((session: WorkoutSession | null) => {
    setActiveWorkoutLocal(session);
    setActiveWorkout(session);
  }, []);

  return (
    <WorkoutContext.Provider value={{ activeWorkout, setActiveWorkoutState, timer, startRestTimer, extendTimer, dismissTimer }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be inside WorkoutProvider');
  return ctx;
}
