import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, MuscleGroup, Equipment } from '../types';
import { getExercises, addExercise, deleteExercise } from '../storage/storage';
import { generateId } from '../utils/helpers';

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms',
];

const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

const EQUIPMENT_ICONS: Record<Equipment, string> = {
  barbell: '🏋️',
  dumbbell: '💪',
  cable: '🔗',
  machine: '⚙️',
  bodyweight: '🤸',
};

const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: '#e94560', back: '#4CAF50', shoulders: '#2196F3',
  biceps: '#FF9800', triceps: '#9C27B0', quads: '#00BCD4',
  hamstrings: '#FF5722', glutes: '#E91E63', calves: '#607D8B',
  abs: '#FFC107', forearms: '#795548',
};

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('chest');
  const [newEquipment, setNewEquipment] = useState<Equipment>('barbell');

  const load = useCallback(async () => {
    setExercises(await getExercises());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = exercises.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchGroup = !filterGroup || e.muscleGroup === filterGroup;
    return matchSearch && matchGroup;
  });

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addExercise({ id: generateId(), name: newName.trim(), muscleGroup: newMuscle, equipment: newEquipment });
    setNewName('');
    setShowAddModal(false);
    load();
  };

  const handleDelete = (ex: Exercise) => {
    Alert.alert('Delete Exercise', `Remove "${ex.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExercise(ex.id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search exercises..."
        placeholderTextColor="#666"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, !filterGroup && styles.filterChipActive]}
          onPress={() => setFilterGroup(null)}
        >
          <Text style={[styles.filterText, !filterGroup && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {MUSCLE_GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.filterChip, filterGroup === g && styles.filterChipActive, filterGroup === g && { borderColor: MUSCLE_COLORS[g] }]}
            onPress={() => setFilterGroup(filterGroup === g ? null : g)}
          >
            <Text style={[styles.filterText, filterGroup === g && { color: MUSCLE_COLORS[g] }]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onLongPress={() => handleDelete(item)} activeOpacity={0.8}>
            <View style={[styles.muscleTag, { backgroundColor: MUSCLE_COLORS[item.muscleGroup] + '22', borderColor: MUSCLE_COLORS[item.muscleGroup] + '66' }]}>
              <Text style={[styles.muscleTagText, { color: MUSCLE_COLORS[item.muscleGroup] }]}>
                {item.muscleGroup.charAt(0).toUpperCase() + item.muscleGroup.slice(1)}
              </Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardEquip}>{EQUIPMENT_ICONS[item.equipment]} {item.equipment}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No exercises found</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <TextInput
              style={styles.input}
              placeholder="Exercise name"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={styles.inputLabel}>Muscle Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {MUSCLE_GROUPS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.pickerChip, newMuscle === g && { backgroundColor: MUSCLE_COLORS[g] }]}
                  onPress={() => setNewMuscle(g)}
                >
                  <Text style={[styles.pickerChipText, newMuscle === g && { color: '#fff' }]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.inputLabel}>Equipment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {EQUIPMENT.map((eq) => (
                <TouchableOpacity
                  key={eq}
                  style={[styles.pickerChip, newEquipment === eq && styles.pickerChipActive]}
                  onPress={() => setNewEquipment(eq)}
                >
                  <Text style={[styles.pickerChipText, newEquipment === eq && { color: '#fff' }]}>
                    {EQUIPMENT_ICONS[eq]} {eq}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 16 },
  search: { backgroundColor: '#16213e', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  filterRow: { marginBottom: 12, flexGrow: 0 },
  filterChip: { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  filterChipActive: { borderColor: '#e94560', backgroundColor: '#e9456022' },
  filterText: { color: '#888', fontSize: 13 },
  filterTextActive: { color: '#e94560', fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', borderRadius: 12, marginBottom: 8, padding: 14, gap: 12 },
  muscleTag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  muscleTagText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardEquip: { color: '#888', fontSize: 12, marginTop: 2 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#e94560', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#16213e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 8, marginTop: 4 },
  pickerRow: { marginBottom: 12, flexGrow: 0 },
  pickerChip: { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  pickerChipActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  pickerChipText: { color: '#888', fontSize: 13 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 15 },
  addBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#e94560', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
