import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { WorkoutSession } from '../types';
import { getWorkoutHistory, deleteWorkoutSession } from '../storage/storage';
import { formatDate, formatDuration, totalVolume } from '../utils/helpers';
import { isPersonalRecord } from '../utils/progressiveOverload';

export default function HistoryScreen() {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [selected, setSelected] = useState<WorkoutSession | null>(null);
  const navigation = useNavigation<any>();

  const load = useCallback(async () => {
    setHistory(await getWorkoutHistory());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (session: WorkoutSession) => {
    Alert.alert('Delete Workout', 'Remove this workout from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteWorkoutSession(session.id);
        setSelected(null);
        load();
      }},
    ]);
  };

  if (selected) {
    const duration = selected.endTime
      ? formatDuration(Math.floor((selected.endTime - selected.startTime) / 1000))
      : '—';
    const vol = totalVolume(selected);
    const prevHistory = history.filter((s) => s.id !== selected.id && s.startTime < selected.startTime);

    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
          <Text style={styles.backText}>‹ History</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.sessionTitle}>{selected.name}</Text>
          <Text style={styles.sessionDate}>{formatDate(selected.startTime)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{duration}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{Math.round(vol).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Volume (kg)</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{selected.exercises.length}</Text>
              <Text style={styles.statLabel}>Exercises</Text>
            </View>
          </View>

          {selected.exercises.map((ex, i) => (
            <View key={i} style={styles.exCard}>
              <Text style={styles.exName}>{ex.exerciseName}</Text>
              <View style={styles.setHeader}>
                <Text style={styles.setHeaderText}>Set</Text>
                <Text style={styles.setHeaderText}>Weight</Text>
                <Text style={styles.setHeaderText}>Reps</Text>
                <Text style={styles.setHeaderText}>RPE</Text>
                <Text style={styles.setHeaderText}>PR</Text>
              </View>
              {ex.sets.filter((s) => s.completed).map((set, si) => {
                const isPR = isPersonalRecord(set.weight, set.reps, ex.exerciseId, prevHistory);
                return (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setCell}>{si + 1}</Text>
                    <Text style={styles.setCell}>{set.weight}kg</Text>
                    <Text style={styles.setCell}>{set.reps}</Text>
                    <Text style={[styles.setCell, { color: set.rpe ? rpeColor(set.rpe) : '#555' }]}>
                      {set.rpe ?? '—'}
                    </Text>
                    <Text style={styles.setCell}>{isPR ? '🏆' : ''}</Text>
                  </View>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(selected)}>
            <Text style={styles.deleteBtnText}>Delete Workout</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const duration = item.endTime
            ? formatDuration(Math.floor((item.endTime - item.startTime) / 1000))
            : 'In progress';
          const vol = totalVolume(item);
          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDate}>{formatDate(item.startTime)}</Text>
              </View>
              <View style={styles.cardStats}>
                <Text style={styles.cardStat}>⏱ {duration}</Text>
                <Text style={styles.cardStat}>📦 {Math.round(vol).toLocaleString()} kg</Text>
                <Text style={styles.cardStat}>🏋️ {item.exercises.length} exercises</Text>
              </View>
              <View style={styles.exerciseNames}>
                {item.exercises.slice(0, 3).map((ex, i) => (
                  <Text key={i} style={styles.exerciseName}>{ex.exerciseName}</Text>
                ))}
                {item.exercises.length > 3 && <Text style={styles.exerciseName}>+{item.exercises.length - 3}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubText}>Complete a workout to see your history</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

function rpeColor(rpe: number): string {
  if (rpe <= 6) return '#4CAF50';
  if (rpe <= 8) return '#FF9800';
  return '#e94560';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 16 },
  card: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardDate: { color: '#888', fontSize: 13 },
  cardStats: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  cardStat: { color: '#aaa', fontSize: 13 },
  exerciseNames: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  exerciseName: { backgroundColor: '#1a1a2e', color: '#888', fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySubText: { color: '#666', fontSize: 14 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#e94560', fontSize: 17 },
  sessionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sessionDate: { color: '#888', fontSize: 14, marginBottom: 16 },
  statsRow: { flexDirection: 'row', backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 16, justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  exCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginBottom: 12 },
  exName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  setHeader: { flexDirection: 'row', marginBottom: 6 },
  setHeaderText: { flex: 1, color: '#666', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  setRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  setCell: { flex: 1, color: '#ccc', fontSize: 14, textAlign: 'center' },
  deleteBtn: { margin: 16, padding: 14, borderWidth: 1, borderColor: '#e94560', borderRadius: 10, alignItems: 'center' },
  deleteBtnText: { color: '#e94560', fontSize: 15 },
});
