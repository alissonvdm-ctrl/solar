import {
  PANEL_POWER,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  PANEL_GAP,
  TEMP_DERATING,
} from './types';
import type { BuildingConfig, EnergyData, PanelPosition } from './types';

export function calculatePeakSunHours(latitude: number): number {
  const absLat = Math.abs(latitude);
  const hours = 6.5 - (absLat - 5) * 0.06;
  return Math.max(3.5, Math.min(6.5, hours));
}

export function calculateSolarIrradiance(latitude: number): number {
  const absLat = Math.abs(latitude);
  const irradiance = 6.0 - (absLat - 5) * 0.05;
  return Math.max(3.5, Math.min(6.5, irradiance));
}

export function calculateTiltFactor(roofTilt: number, latitude: number): number {
  const optimalTilt = Math.abs(latitude);
  const deviation = Math.abs(roofTilt - optimalTilt);
  return Math.max(0.7, 1 - deviation * 0.005);
}

export function getMaxPanelGrid(building: BuildingConfig): { rows: number; cols: number } {
  const cols = Math.floor(building.width / (PANEL_WIDTH + PANEL_GAP));
  const rows = Math.floor(building.length / (PANEL_HEIGHT + PANEL_GAP));
  return { rows: Math.max(0, rows), cols: Math.max(0, cols) };
}

export function calculateEnergyData(
  panels: PanelPosition[],
  latitude: number,
  roofTilt: number,
): EnergyData {
  const panelCount = panels.length;
  const totalPowerKW = panelCount * PANEL_POWER;
  const peakSunHours = calculatePeakSunHours(latitude);
  const solarIrradiance = calculateSolarIrradiance(latitude);
  const tiltFactor = calculateTiltFactor(roofTilt, latitude);

  const monthlyGenerationKWh = totalPowerKW * peakSunHours * 30 * tiltFactor * TEMP_DERATING;
  const annualGenerationKWh = monthlyGenerationKWh * 12;

  return {
    panelCount,
    totalPowerKW: Math.round(totalPowerKW * 100) / 100,
    monthlyGenerationKWh: Math.round(monthlyGenerationKWh * 10) / 10,
    annualGenerationKWh: Math.round(annualGenerationKWh * 10) / 10,
    peakSunHours: Math.round(peakSunHours * 10) / 10,
    solarIrradiance: Math.round(solarIrradiance * 10) / 10,
  };
}

export function autoPlacePanels(
  building: BuildingConfig,
  targetEnergyKWh: number,
  latitude: number,
): PanelPosition[] {
  const { rows, cols } = getMaxPanelGrid(building);
  const maxPanels = rows * cols;

  if (maxPanels === 0) return [];

  const peakSunHours = calculatePeakSunHours(latitude);
  const tiltFactor = calculateTiltFactor(building.roofTilt, latitude);
  const monthlyPerPanel = PANEL_POWER * peakSunHours * 30 * tiltFactor * TEMP_DERATING;

  let needed = Math.ceil(targetEnergyKWh / monthlyPerPanel);
  needed = Math.min(needed, maxPanels);
  needed = Math.max(1, needed);

  const panels: PanelPosition[] = [];
  let count = 0;

  for (let row = 0; row < rows && count < needed; row++) {
    for (let col = 0; col < cols && count < needed; col++) {
      panels.push({ row, col });
      count++;
    }
  }

  return panels;
}
