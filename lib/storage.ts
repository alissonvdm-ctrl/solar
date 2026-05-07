import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Simulation } from './types';

const STORAGE_KEY = '@solarsim_simulations';

export async function saveSimulation(simulation: Simulation): Promise<void> {
  const all = await loadAllSimulations();
  const index = all.findIndex(s => s.id === simulation.id);
  if (index >= 0) {
    all[index] = { ...simulation, updatedAt: new Date().toISOString() };
  } else {
    all.push(simulation);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function loadAllSimulations(): Promise<Simulation[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data) as Simulation[];
  } catch {
    return [];
  }
}

export async function loadSimulation(id: string): Promise<Simulation | null> {
  const all = await loadAllSimulations();
  return all.find(s => s.id === id) ?? null;
}

export async function deleteSimulation(id: string): Promise<void> {
  const all = await loadAllSimulations();
  const filtered = all.filter(s => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
