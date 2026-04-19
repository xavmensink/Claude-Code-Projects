import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useWorkout } from '../context/WorkoutContext';

export default function RestTimerBanner() {
  const { timer, extendTimer, dismissTimer } = useWorkout();

  if (!timer.isRunning && timer.secondsLeft === 0) return null;

  const minutes = Math.floor(timer.secondsLeft / 60);
  const seconds = timer.secondsLeft % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progress = timer.totalSeconds > 0 ? timer.secondsLeft / timer.totalSeconds : 0;
  const isUrgent = timer.secondsLeft <= 10 && timer.secondsLeft > 0;

  return (
    <View style={styles.container}>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: isUrgent ? '#e94560' : '#4CAF50' }]} />
      </View>
      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.label}>REST</Text>
          <Text style={[styles.time, isUrgent && styles.urgent]}>
            {timer.secondsLeft === 0 ? 'GO!' : timeStr}
          </Text>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.extendBtn} onPress={() => extendTimer(30)}>
            <Text style={styles.extendText}>+30s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.extendBtn} onPress={() => extendTimer(60)}>
            <Text style={styles.extendText}>+60s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissBtn} onPress={dismissTimer}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: '#0f3460',
  },
  progressBar: {
    height: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  left: {},
  label: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  time: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  urgent: {
    color: '#e94560',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extendBtn: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  extendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissText: {
    color: '#aaa',
    fontSize: 14,
  },
});
