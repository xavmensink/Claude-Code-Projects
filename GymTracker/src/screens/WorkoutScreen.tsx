import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal, FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WorkoutSession, ExerciseLog, SetLog, WorkoutTemplate, Exercise } from '../types';
import { getActiveWorkout, setActiveWorkout, saveWorkoutSession, getWorkoutHistory, getExercises, getSettings } from '../storage/storage';
import { useWorkout } from '../context/WorkoutContext';
import { getSuggestedWeight } from '../utils/progressiveOverload';
import { generateId, formatDuration } from '../utils/helpers';
import RestTimerBanner from '../components/RestTimerBanner';

interface WorkoutScreenProps {
  route?: { params?: { template?: WorkoutTemplate; resume?: boolean } };
}

export default function WorkoutScreen({ route }: WorkoutScreenProps) {
  const { activeWorkout, setActiveWorkoutState, startRestTimer } = useWorkout();
  const [session, setSession] = useState<WorkoutSession | null>(activeWorkout);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [showPicker, setShowPicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigation = useNavigation<any>();

  useFocusEffect(useCallback(() => {
    getWorkoutHistory().then(setHistory);
    getSettings().then((s) => setWeightUnit(s.weightUnit));
  }, []));

  // Handle template launch from navigation params
  useEffect(() => {
    const params = route?.params;
    if (params?.template && !activeWorkout) {
      startFromTemplate(params.template);
    }
  }, [route?.params]);

  // Sync from context
  useEffect(() => { setSession(activeWorkout); }, [activeWorkout]);

  // Elapsed timer
  useEffect(() => {
    if (session) {
      elapsedRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - session.startTime) / 1000));
      }, 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [session?.id]);

  const startFromTemplate = (template: WorkoutTemplate) => {
    const newSession: WorkoutSession = {
      id: generateId(),
      templateId: template.id,
      name: template.name,
      startTime: Date.now(),
      exercises: template.exercises.map((te) => ({
        exerciseId: te.exerciseId,
        exerciseName: te.exerciseName,
        sets: Array.from({ length: te.targetSets }, () => ({
          id: generateId(),
          weight: 0,
          reps: te.targetReps,
          completed: false,
          timestamp: Date.now(),
        })),
      })),
    };
    setActiveWorkoutState(newSession);
  };

  const startEmpty = () => {
    const newSession: WorkoutSession = {
      id: generateId(),
      name: 'Quick Workout',
      startTime: Date.now(),
      exercises: [],
    };
    setActiveWorkoutState(newSession);
  };

  const updateSession = (updated: WorkoutSession) => {
    setSession(updated);
    setActiveWorkoutState(updated);
  };

  const addSet = (exIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [...ex.sets, {
          id: generateId(),
          weight: lastSet?.weight ?? 0,
          reps: lastSet?.reps ?? 10,
          completed: false,
          timestamp: Date.now(),
        }],
      };
    });
    updateSession({ ...session, exercises });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const exercises = session.exercises.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
    );
    updateSession({ ...session, exercises });
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'rpe', value: string) => {
    if (!session) return;
    const num = parseFloat(value) || 0;
    const exercises = session.exercises.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: num }),
      }
    );
    updateSession({ ...session, exercises });
  };

  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    if (!session) return;
    const set = session.exercises[exIdx].sets[setIdx];
    const nowComplete = !set.completed;
    const exercises = session.exercises.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, si) =>
          si !== setIdx ? s : { ...s, completed: nowComplete, timestamp: Date.now() }
        ),
      }
    );
    updateSession({ ...session, exercises });
    if (nowComplete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startRestTimer();
    }
  };

  const removeExercise = (exIdx: number) => {
    if (!session) return;
    Alert.alert('Remove Exercise', 'Remove this exercise from the workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        updateSession({ ...session, exercises: session.exercises.filter((_, i) => i !== exIdx) });
      }},
    ]);
  };

  const openExercisePicker = async () => {
    setAllExercises(await getExercises());
    setShowPicker(true);
  };

  const addExerciseFromPicker = (ex: Exercise) => {
    if (!session) return;
    const newEx: ExerciseLog = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: [{ id: generateId(), weight: 0, reps: 10, completed: false, timestamp: Date.now() }],
    };
    updateSession({ ...session, exercises: [...session.exercises, newEx] });
    setShowPicker(false);
    setPickerSearch('');
  };

  const finishWorkout = () => {
    Alert.alert('Finish Workout', 'Save this workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'default', onPress: async () => {
        if (!session) return;
        const finished = { ...session, endTime: Date.now() };
        await saveWorkoutSession(finished);
        setActiveWorkoutState(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
    ]);
  };

  // ── No active workout ────────────────────────────────────────────────────────
  if (!session) {
    return (
      <View style={styles.startContainer}>
        <Text style={styles.startTitle}>Ready to Train?</Text>
        <Text style={styles.startSubtitle}>Start an empty workout or pick a template from the Templates tab.</Text>
        <TouchableOpacity style={styles.startBtn} onPress={startEmpty}>
          <Ionicons name="barbell-outline" size={22} color="#fff" />
          <Text style={styles.startBtnText}>Start Empty Workout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Active workout ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.workoutName}>{session.name}</Text>
          <Text style={styles.elapsedText}>{formatDuration(elapsed)}</Text>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {session.exercises.map((ex, exIdx) => {
          const suggestion = getSuggestedWeight(ex.exerciseId, ex.sets[0]?.reps ?? 10, history, weightUnit);
          return (
            <View key={exIdx} style={styles.exerciseSection}>
              <View style={styles.exHeader}>
                <Text style={styles.exName}>{ex.exerciseName}</Text>
                <TouchableOpacity onPress={() => removeExercise(exIdx)}>
                  <Ionicons name="close-circle-outline" size={22} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Column headers */}
              <View style={styles.setRow}>
                <Text style={[styles.colHeader, styles.colSet]}>SET</Text>
                <Text style={[styles.colHeader, styles.colPrev]}>PREV</Text>
                <Text style={[styles.colHeader, styles.colWeight]}>{weightUnit.toUpperCase()}</Text>
                <Text style={[styles.colHeader, styles.colReps]}>REPS</Text>
                <Text style={[styles.colHeader, styles.colRpe]}>RPE</Text>
                <Text style={[styles.colHeader, styles.colDone]}>✓</Text>
              </View>

              {ex.sets.map((set, setIdx) => {
                const prevSession = history[0];
                const prevEx = prevSession?.exercises.find((e) => e.exerciseId === ex.exerciseId);
                const prevSet = prevEx?.sets[setIdx];
                const prevText = prevSet?.completed ? `${prevSet.weight}×${prevSet.reps}` : '—';

                return (
                  <TouchableOpacity
                    key={set.id}
                    onLongPress={() => removeSet(exIdx, setIdx)}
                    activeOpacity={1}
                    style={[styles.setRow, set.completed && styles.setRowDone]}
                  >
                    <Text style={[styles.colSet, styles.setNum]}>{setIdx + 1}</Text>
                    <Text style={[styles.colPrev, styles.prevText]}>{prevText}</Text>
                    <TextInput
                      style={[styles.colWeight, styles.setInput]}
                      value={set.weight > 0 ? String(set.weight) : ''}
                      onChangeText={(v) => updateSet(exIdx, setIdx, 'weight', v)}
                      keyboardType="decimal-pad"
                      placeholder={suggestion ? String(suggestion.weight) : '0'}
                      placeholderTextColor="#555"
                      editable={!set.completed}
                    />
                    <TextInput
                      style={[styles.colReps, styles.setInput]}
                      value={set.reps > 0 ? String(set.reps) : ''}
                      onChangeText={(v) => updateSet(exIdx, setIdx, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#555"
                      editable={!set.completed}
                    />
                    <TextInput
                      style={[styles.colRpe, styles.setInput, { color: set.rpe ? rpeColor(set.rpe) : '#fff' }]}
                      value={set.rpe ? String(set.rpe) : ''}
                      onChangeText={(v) => updateSet(exIdx, setIdx, 'rpe', v)}
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor="#555"
                      editable={!set.completed}
                      maxLength={2}
                    />
                    <TouchableOpacity
                      style={[styles.colDone, styles.doneBtn, set.completed && styles.doneBtnActive]}
                      onPress={() => toggleSetComplete(exIdx, setIdx)}
                    >
                      {set.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

              {suggestion && (
                <Text style={[styles.suggestionText, { color: suggestion.direction === 'increase' ? '#4CAF50' : suggestion.direction === 'decrease' ? '#e94560' : '#888' }]}>
                  {suggestion.direction === 'increase' ? '↑' : suggestion.direction === 'decrease' ? '↓' : '→'} Suggested: {suggestion.weight}{weightUnit}
                </Text>
              )}

              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                <Text style={styles.addSetText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addExBtn} onPress={openExercisePicker}>
          <Ionicons name="add-circle-outline" size={20} color="#e94560" />
          <Text style={styles.addExText}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <RestTimerBanner />

      {/* Exercise picker modal */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search..."
              placeholderTextColor="#666"
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoFocus
            />
            <FlatList
              data={allExercises.filter((e) => e.name.toLowerCase().includes(pickerSearch.toLowerCase()))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => addExerciseFromPicker(item)}>
                  <Text style={styles.pickerItemText}>{item.name}</Text>
                  <Text style={styles.pickerItemSub}>{item.muscleGroup} · {item.equipment}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function rpeColor(rpe: number): string {
  if (rpe <= 6) return '#4CAF50';
  if (rpe <= 8) return '#FF9800';
  return '#e94560';
}

const styles = StyleSheet.create({
  startContainer: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', padding: 32 },
  startTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  startSubtitle: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 32 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e94560', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14 },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, backgroundColor: '#16213e', borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  workoutName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  elapsedText: { color: '#888', fontSize: 13, marginTop: 2 },
  finishBtn: { backgroundColor: '#e94560', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  exerciseSection: { margin: 12, backgroundColor: '#16213e', borderRadius: 14, padding: 14 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  exName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
  setRowDone: { opacity: 0.6 },
  colHeader: { color: '#666', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 28, textAlign: 'center' },
  colPrev: { flex: 1.2, textAlign: 'center' },
  colWeight: { flex: 1.2, textAlign: 'center' },
  colReps: { flex: 1, textAlign: 'center' },
  colRpe: { width: 36, textAlign: 'center' },
  colDone: { width: 36, textAlign: 'center' },
  setNum: { color: '#888', fontSize: 14, textAlign: 'center' },
  prevText: { color: '#555', fontSize: 13, textAlign: 'center' },
  setInput: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 8, padding: 8, fontSize: 14, textAlign: 'center' },
  doneBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  doneBtnActive: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  suggestionText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
  addSetBtn: { marginTop: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333', borderRadius: 8, borderStyle: 'dashed' },
  addSetText: { color: '#888', fontSize: 14 },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 16, borderWidth: 1, borderColor: '#e94560', borderRadius: 12, borderStyle: 'dashed', justifyContent: 'center' },
  addExText: { color: '#e94560', fontSize: 15, fontWeight: '600' },
  pickerOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  pickerModal: { backgroundColor: '#16213e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%' },
  pickerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  pickerSearch: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  pickerItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  pickerItemText: { color: '#fff', fontSize: 15 },
  pickerItemSub: { color: '#666', fontSize: 12, marginTop: 2 },
  pickerCancel: { padding: 14, alignItems: 'center', marginTop: 4 },
  pickerCancelText: { color: '#888', fontSize: 15 },
});
