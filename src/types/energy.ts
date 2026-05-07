/**
 * Energy domain types
 * Energy levels, telemetry, and daily energy reports
 */

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export interface EnergyTelemetry {
  evaluatedAt: Date;
  completedTaskCount: number;
  completedTaskIds: string[];
  suggestedHitCount: number;
  suggestedHitRate: number;
  observedAverageLoad: number;
  observedAveragePriority: number;
  observedAverageEtaMinutes: number;
  expectedAverageLoad: number;
  calibration: 'under' | 'aligned' | 'over';
  biasDelta: number;
}

export interface DailyEnergyReport {
  date: string; // YYYY-MM-DD
  level: EnergyLevel;
  fatigue: 'low' | 'medium' | 'high';
  note?: string;
  created_at: Date;
  telemetry?: EnergyTelemetry;
}
