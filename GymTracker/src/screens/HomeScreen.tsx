import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutTemplate, WorkoutSession } from '../types';
import { getTemplates, getWorkoutHistory } from '../storage/storage';
import { formatDate, formatDuration, totalVolume } from '../utils/helpers';

export default function HomeScreen() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const navigation = useNavigation<any>();

  useFocusEffect(useCallback(() => {
    getTemplates().then(setTemplates);
    getWorkoutHistory().then(setHistory);
  }, []));

  const streak = computeStreak(history);
  const recent = history.slice(0, 3);

  const startFromTemplate = (template: WorkoutTemplate) => {
    navigation.navigate('Workout', { template });
  };

  const startEmpty = () => {
    navigation.navigate('Workout', {});
  };

  const dayOfWeek = new Date().toLocaleDateString('en-GB', { weekday: 'long' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.greeting}>Ready to train,</Text>
        <Text style={styles.dayName}>{dayOfWeek}?</Text>
        {streak > 0 && (
          <Text style={styles.streak}>🔥 {streak} day streak</Text>
        )}
      </View>

      {/* Start workout */}
      <TouchableOpacity style={styles.startBtn} onPress={startEmpty}>
        <Ionicons name="barbell-outline" size={22} color="#fff" />
        <Text style={styles.startBtnText}>Start Empty Workout</Text>
      </TouchableOpacity>

      {/* Weekly volume chart */}
      <WeeklyChart history={history} />

      {/* Templates */}
      {templates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {templates.map((t) => (
              <TouchableOpacity key={t.id} style={styles.templateCard} onPress={() => startFromTemplate(t)}>
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateMeta}>{t.exercises.length} exercises</Text>
                <View style={styles.templateExList}>
                  {t.exercises.slice(0, 2).map((ex, i) => (
                    <Text key={i} style={styles.templateEx}>· {ex.exerciseName}</Text>
                  ))}
                  {t.exercises.length > 2 && <Text style={styles.templateEx}>+{t.exercises.length - 2} more</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent workouts */}
      {recent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {recent.map((session) => {
            const vol = totalVolume(session);
            const duration = session.endTime
              ? formatDuration(Math.floor((session.endTime - session.startTime) / 1000))
              : '—';
            return (
              <View key={session.id} style={styles.recentCard}>
                <View style={styles.recentTop}>
                  <Text style={styles.recentName}>{session.name}</Text>
                  <Text style={styles.recentDate}>{formatDate(session.startTime)}</Text>
                </View>
                <View style={styles.recentStats}>
                  <Text style={styles.recentStat}>⏱ {duration}</Text>
                  <Text style={styles.recentStat}>📦 {Math.round(vol)} kg</Text>
                  <Text style={styles.recentStat}>🏋️ {session.exercises.length} exercises</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {templates.length === 0 && history.length === 0 && (
        <View style={styles.onboarding}>
          <Text style={styles.onboardingTitle}>Welcome to GymTracker</Text>
          <Text style={styles.onboardingText}>
            1. Go to <Text style={styles.highlight}>Templates</Text> to create your first workout plan{'\n'}
            2. Tap <Text style={styles.highlight}>Start Empty Workout</Text> to log a session now{'\n'}
            3. Track sets, weight & RPE in real time{'\n'}
            4. Watch progressive overload suggestions appear
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function WeeklyChart({ history }: { history: WorkoutSession[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon

  const workoutDays = new Set(
    history.map((s) => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const chartDays = days.map((label, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const hasWorkout = workoutDays.has(key);
    const isToday = i === dayOfWeek;
    return { label, hasWorkout, isToday };
  });

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>This Week</Text>
      <View style={styles.chart}>
        {chartDays.map((day, i) => (
          <View key={i} style={styles.chartDay}>
            <View style={[styles.chartDot, day.hasWorkout && styles.chartDotDone, day.isToday && styles.chartDotToday]} />
            <Text style={[styles.chartLabel, day.isToday && styles.chartLabelToday]}>{day.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function computeStreak(history: WorkoutSession[]): number {
  if (!history.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checkDate = new Date(today);

  const workoutDates = new Set(
    history.map((s) => {
      const d = new Date(s.startTime);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  while (workoutDates.has(checkDate.getTime())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  headerSection: { padding: 24, paddingBottom: 8 },
  greeting: { color: '#888', fontSize: 16 },
  dayName: { color: '#fff', fontSize: 28, fontWeight: '800' },
  streak: { color: '#FF9800', fontSize: 15, fontWeight: '600', marginTop: 8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e94560', marginHorizontal: 16, marginVertical: 12, padding: 18, borderRadius: 14, justifyContent: 'center' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  chartContainer: { backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 16, borderRadius: 14, padding: 16 },
  chartTitle: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  chart: { flexDirection: 'row', justifyContent: 'space-around' },
  chartDay: { alignItems: 'center', gap: 6 },
  chartDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a2e', borderWidth: 2, borderColor: '#333' },
  chartDotDone: { backgroundColor: '#e94560', borderColor: '#e94560' },
  chartDotToday: { borderColor: '#e94560' },
  chartLabel: { color: '#666', fontSize: 11 },
  chartLabelToday: { color: '#e94560', fontWeight: '700' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  templateCard: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginRight: 12, width: 180 },
  templateName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  templateMeta: { color: '#e94560', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  templateExList: { gap: 2 },
  templateEx: { color: '#888', fontSize: 12 },
  recentCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginBottom: 10 },
  recentTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recentName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recentDate: { color: '#888', fontSize: 12 },
  recentStats: { flexDirection: 'row', gap: 14 },
  recentStat: { color: '#aaa', fontSize: 12 },
  onboarding: { margin: 16, backgroundColor: '#16213e', borderRadius: 14, padding: 20 },
  onboardingTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  onboardingText: { color: '#888', fontSize: 14, lineHeight: 24 },
  highlight: { color: '#e94560', fontWeight: '600' },
});
