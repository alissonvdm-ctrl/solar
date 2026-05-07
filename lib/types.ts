export interface SimulationLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface BuildingConfig {
  width: number;
  length: number;
  roofTilt: number;
  roofOrientation: number;
}

export interface PanelPosition {
  row: number;
  col: number;
}

export interface EnergyData {
  panelCount: number;
  totalPowerKW: number;
  monthlyGenerationKWh: number;
  annualGenerationKWh: number;
  peakSunHours: number;
  solarIrradiance: number;
}

export interface SolarApiData {
  maxSunshineHoursPerYear: number;
  maxArrayAreaMeters2: number;
  carbonOffsetFactorKgPerMwh: number;
  annualFluxKwhPerM2: number;
  roofSegments: {
    pitchDegrees: number;
    azimuthDegrees: number;
    areaMeters2: number;
    sunshineQuantiles: number[];
  }[];
  panelCapacityWatts: number;
  panelHeightMeters: number;
  panelWidthMeters: number;
  imageryDate?: string;
  imageryQuality?: string;
}

export interface Simulation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  location: SimulationLocation;
  building: BuildingConfig;
  panels: PanelPosition[];
  targetEnergy: number;
  energyData: EnergyData;
  solarApiData?: SolarApiData;
  threeDImageBase64?: string;
}

export const PANEL_WIDTH = 1.0;
export const PANEL_HEIGHT = 1.7;
export const PANEL_POWER = 0.4;
export const PANEL_GAP = 0.05;
export const TEMP_DERATING = 0.85;
