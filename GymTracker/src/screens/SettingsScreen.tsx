import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { AppSettings } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REST_OPTIONS = [60, 90, 120, 180, 240];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({ restTimerDuration: 120, weightUnit: 'kg' });

  useEffect(() => { getSettings().then(setSettings); }, []);

  const update = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await saveSettings(updated);
  };

  const clearAll = () => {
    Alert.alert('Clear All Data', 'This will delete all workouts, templates, and exercise history. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear Everything', style: 'destructive', onPress: async () => {
        await AsyncStorage.clear();
        Alert.alert('Done', 'All data cleared. Restart the app.');
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>REST TIMER</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Default Rest Duration</Text>
        <View style={styles.optionRow}>
          {REST_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.optionBtn, settings.restTimerDuration === s && styles.optionBtnActive]}
              onPress={() => update({ restTimerDuration: s })}
            >
              <Text style={[styles.optionText, settings.restTimerDuration === s && styles.optionTextActive]}>
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionHeader}>WEIGHT UNIT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Use Pounds (lbs)</Text>
          <Switch
            value={settings.weightUnit === 'lbs'}
            onValueChange={(v) => update({ weightUnit: v ? 'lbs' : 'kg' })}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={styles.sectionHeader}>DATA</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.dangerBtn} onPress={clearAll}>
          <Text style={styles.dangerText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.versionText}>GymTracker v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 16 },
  sectionHeader: { color: '#666', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 },
  card: { backgroundColor: '#16213e', borderRadius: 14, padding: 16, marginBottom: 4 },
  label: { color: '#fff', fontSize: 15, marginBottom: 12 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#333', borderRadius: 8, alignItems: 'center' },
  optionBtnActive: { borderColor: '#e94560', backgroundColor: '#e9456022' },
  optionText: { color: '#888', fontSize: 14 },
  optionTextActive: { color: '#e94560', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dangerBtn: { padding: 14, borderWidth: 1, borderColor: '#e94560', borderRadius: 10, alignItems: 'center' },
  dangerText: { color: '#e94560', fontSize: 15 },
  versionText: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 40 },
});
