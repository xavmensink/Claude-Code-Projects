import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import TemplatesScreen from './src/screens/TemplatesScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

import { WorkoutProvider } from './src/context/WorkoutContext';
import { seedExercisesIfEmpty } from './src/storage/storage';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Exercises: { active: 'list', inactive: 'list-outline' },
  Templates: { active: 'copy', inactive: 'copy-outline' },
  Workout: { active: 'barbell', inactive: 'barbell-outline' },
  History: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

export default function App() {
  useEffect(() => { seedExercisesIfEmpty(); }, []);

  return (
    <SafeAreaProvider>
      <WorkoutProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                const icons = TAB_ICONS[route.name];
                const name = focused ? icons.active : icons.inactive;
                return <Ionicons name={name} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#e94560',
              tabBarInactiveTintColor: '#666',
              tabBarStyle: { backgroundColor: '#16213e', borderTopColor: '#0f3460', borderTopWidth: 1 },
              headerStyle: { backgroundColor: '#16213e' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'GymTracker' }} />
            <Tab.Screen name="Exercises" component={ExercisesScreen} />
            <Tab.Screen name="Templates" component={TemplatesScreen} />
            <Tab.Screen name="Workout" component={WorkoutScreen as any} options={{ title: 'Workout' }} />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </WorkoutProvider>
    </SafeAreaProvider>
  );
}
