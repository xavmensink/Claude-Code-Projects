import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { WorkoutProvider } from './context/WorkoutContext';
import BottomNav from './components/BottomNav';
import RestTimerBanner from './components/RestTimerBanner';
import HomeScreen from './screens/HomeScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import TemplatesScreen from './screens/TemplatesScreen';
import WorkoutScreen from './screens/WorkoutScreen';
import SummaryScreen from './screens/SummaryScreen';
import HistoryScreen from './screens/HistoryScreen';
import VolumeScreen from './screens/VolumeScreen';
import SettingsScreen from './screens/SettingsScreen';
import { seedIfEmpty, migrateExercises, seedJeffNippardTemplates } from './storage/storage';

function AppInner() {
  return (
    <>
      <div className="screen">
        <Routes>
          <Route path="/"          element={<HomeScreen />} />
          <Route path="/exercises" element={<ExercisesScreen />} />
          <Route path="/templates" element={<TemplatesScreen />} />
          <Route path="/workout"          element={<WorkoutScreen />} />
          <Route path="/workout/summary" element={<SummaryScreen />} />
          <Route path="/history"         element={<HistoryScreen />} />
          <Route path="/volume"    element={<VolumeScreen />} />
          <Route path="/settings"  element={<SettingsScreen />} />
        </Routes>
      </div>
      <RestTimerBanner />
      <BottomNav />
    </>
  );
}

export default function App() {
  useEffect(() => { seedIfEmpty(); migrateExercises(); seedJeffNippardTemplates(); }, []);

  return (
    <HashRouter>
      <WorkoutProvider>
        <AppInner />
      </WorkoutProvider>
    </HashRouter>
  );
}
