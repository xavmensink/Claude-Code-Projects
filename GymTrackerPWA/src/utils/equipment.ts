import { Equipment } from '../types';

export interface EquipmentInfo {
  label: string;   // short badge text
  hint: string;    // what the logged weight means for this equipment
  icon: string;
  color: string;
}

export const EQUIPMENT_INFO: Record<Equipment, EquipmentInfo> = {
  barbell:    { label: 'Barbell',    hint: 'total load incl. bar', icon: '🏋️', color: '#e94560' },
  dumbbell:   { label: 'Dumbbell',   hint: 'per hand',             icon: '💪', color: '#2196F3' },
  cable:      { label: 'Cable',      hint: 'stack weight',         icon: '🔗', color: '#FF9800' },
  machine:    { label: 'Machine',    hint: 'stack / plate weight', icon: '⚙️', color: '#4CAF50' },
  bodyweight: { label: 'Bodyweight', hint: 'added weight, 0 = bodyweight', icon: '🤸', color: '#9C27B0' },
};

export function equipmentInfo(equipment: Equipment | undefined): EquipmentInfo | null {
  return equipment ? EQUIPMENT_INFO[equipment] ?? null : null;
}
