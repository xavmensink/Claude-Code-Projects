import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutTemplate, TemplateExercise, Exercise } from '../types';
import { getTemplates, upsertTemplate, deleteTemplate, getExercises } from '../storage/storage';
import { generateId } from '../utils/helpers';

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [editTarget, setEditTarget] = useState<WorkoutTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const navigation = useNavigation<any>();

  const load = useCallback(async () => {
    setTemplates(await getTemplates());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditTarget({ id: generateId(), name: '', exercises: [] });
    setShowEditor(true);
  };

  const openEdit = (t: WorkoutTemplate) => {
    setEditTarget({ ...t, exercises: t.exercises.map((e) => ({ ...e })) });
    setShowEditor(true);
  };

  const handleDelete = (t: WorkoutTemplate) => {
    Alert.alert('Delete Template', `Remove "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTemplate(t.id); load(); } },
    ]);
  };

  const muscleGroupsHit = (t: WorkoutTemplate) => {
    const groups = new Set(t.exercises.map((e) => e.exerciseName));
    return t.exercises.length;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{item.name || 'Unnamed Template'}</Text>
              <Ionicons name="chevron-forward" size={18} color="#666" />
            </View>
            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
            <Text style={styles.cardMeta}>{item.exercises.length} exercises</Text>
            <View style={styles.exerciseList}>
              {item.exercises.slice(0, 3).map((ex, i) => (
                <Text key={i} style={styles.exerciseItem}>• {ex.exerciseName} — {ex.targetSets}×{ex.targetReps}</Text>
              ))}
              {item.exercises.length > 3 && <Text style={styles.exerciseItem}>+{item.exercises.length - 3} more</Text>}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No templates yet</Text>
            <Text style={styles.emptySubText}>Create one to speed up your workouts</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {showEditor && editTarget && (
        <TemplateEditor
          template={editTarget}
          onSave={async (t) => { await upsertTemplate(t); setShowEditor(false); load(); }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </View>
  );
}

function TemplateEditor({ template, onSave, onClose }: {
  template: WorkoutTemplate;
  onSave: (t: WorkoutTemplate) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description ?? '');
  const [exercises, setExercises] = useState<TemplateExercise[]>(template.exercises);
  const [showPicker, setShowPicker] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');

  const openPicker = async () => {
    setAllExercises(await getExercises());
    setShowPicker(true);
  };

  const pickExercise = (ex: Exercise) => {
    setExercises((prev) => [...prev, { exerciseId: ex.id, exerciseName: ex.name, targetSets: 3, targetReps: 10 }]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSets = (idx: number, val: string) => {
    const n = parseInt(val) || 0;
    setExercises((prev) => prev.map((e, i) => i === idx ? { ...e, targetSets: n } : e));
  };

  const updateReps = (idx: number, val: string) => {
    const n = parseInt(val) || 0;
    setExercises((prev) => prev.map((e, i) => i === idx ? { ...e, targetReps: n } : e));
  };

  return (
    <Modal visible animationType="slide">
      <View style={styles.editorContainer}>
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.editorTitle}>Template</Text>
          <TouchableOpacity onPress={() => onSave({ ...template, name, description: desc, exercises })}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.editorBody} contentContainerStyle={{ paddingBottom: 40 }}>
          <TextInput
            style={styles.input}
            placeholder="Template name (e.g. Push Day)"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, { height: 70 }]}
            placeholder="Description (optional)"
            placeholderTextColor="#666"
            value={desc}
            onChangeText={setDesc}
            multiline
          />

          <Text style={styles.sectionTitle}>Exercises</Text>
          {exercises.map((ex, idx) => (
            <View key={idx} style={styles.exRow}>
              <View style={styles.exInfo}>
                <Text style={styles.exName}>{ex.exerciseName}</Text>
                <View style={styles.exInputs}>
                  <View style={styles.exInputGroup}>
                    <Text style={styles.exInputLabel}>Sets</Text>
                    <TextInput
                      style={styles.exInput}
                      value={String(ex.targetSets)}
                      onChangeText={(v) => updateSets(idx, v)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.exInputGroup}>
                    <Text style={styles.exInputLabel}>Reps</Text>
                    <TextInput
                      style={styles.exInput}
                      value={String(ex.targetReps)}
                      onChangeText={(v) => updateReps(idx, v)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => removeExercise(idx)}>
                <Ionicons name="trash-outline" size={20} color="#e94560" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addExBtn} onPress={openPicker}>
            <Ionicons name="add-circle-outline" size={20} color="#e94560" />
            <Text style={styles.addExText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={showPicker} animationType="slide" transparent>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerModal}>
              <TextInput
                style={styles.input}
                placeholder="Search exercises..."
                placeholderTextColor="#666"
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
              />
              <FlatList
                data={allExercises.filter((e) => e.name.toLowerCase().includes(pickerSearch.toLowerCase()))}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickerItem} onPress={() => pickExercise(item)}>
                    <Text style={styles.pickerItemText}>{item.name}</Text>
                    <Text style={styles.pickerItemSub}>{item.muscleGroup} · {item.equipment}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 16 },
  card: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardDesc: { color: '#888', fontSize: 13, marginBottom: 6 },
  cardMeta: { color: '#e94560', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  exerciseList: { gap: 2 },
  exerciseItem: { color: '#aaa', fontSize: 13 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySubText: { color: '#666', fontSize: 14 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#e94560', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  editorContainer: { flex: 1, backgroundColor: '#1a1a2e' },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#16213e' },
  editorTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelText: { color: '#888', fontSize: 16 },
  saveText: { color: '#e94560', fontSize: 16, fontWeight: '700' },
  editorBody: { flex: 1, padding: 16 },
  input: { backgroundColor: '#16213e', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  exRow: { backgroundColor: '#16213e', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exInfo: { flex: 1 },
  exName: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  exInputs: { flexDirection: 'row', gap: 12 },
  exInputGroup: { alignItems: 'center' },
  exInputLabel: { color: '#666', fontSize: 11, marginBottom: 4 },
  exInput: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 8, padding: 8, width: 56, textAlign: 'center', fontSize: 15 },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, borderColor: '#e94560', borderRadius: 10, borderStyle: 'dashed', justifyContent: 'center', marginTop: 4 },
  addExText: { color: '#e94560', fontSize: 15, fontWeight: '600' },
  pickerOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  pickerModal: { backgroundColor: '#16213e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
  pickerItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  pickerItemText: { color: '#fff', fontSize: 15 },
  pickerItemSub: { color: '#666', fontSize: 12, marginTop: 2 },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
});
