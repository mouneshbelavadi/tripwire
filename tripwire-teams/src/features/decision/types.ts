export interface PlanPolicy {
  affectedThresholdPercent: number; // default 40
  rainAffectedThresholdPercent: number; // default 30
  heavyRainProbabilityPercent: number; // default 70
  baselineMultiplier: number; // default 1.35
  freshnessMaxAgeSeconds: number; // default 600 (10 minutes)
  rainfallMmThreshold?: number; // default 0.5
  unknownMaxSharePercent?: number; // default 30
}

export const DEFAULT_PLAN_POLICY: PlanPolicy = {
  affectedThresholdPercent: 40,
  rainAffectedThresholdPercent: 30,
  heavyRainProbabilityPercent: 70,
  baselineMultiplier: 1.35,
  freshnessMaxAgeSeconds: 600,
  rainfallMmThreshold: 0.5,
  unknownMaxSharePercent: 30,
};

export interface AttendeeReading {
  memberId: string;
  durationSeconds: number | null;
  baselineSeconds: number | null;
  personalMaxMinutes: number;
  status: 'ok' | 'unknown';
  providerTimestamp: Date;
  hasSkipped: boolean;
}

export interface RainForecast {
  precipitationProbability: number; // 0-100
  rainfallMm: number;
}

export interface PreviousState {
  consecutiveFlaggedChecks: number;
  lastCheckedAt: Date | null;
  lastProviderTimestamp: Date | null;
}

export type DecisionOutcome = 'GO' | 'CONFIRMING' | 'RECOMMEND_REMOTE' | 'CANNOT_ASSESS';

export interface DecisionEvaluation {
  outcome: DecisionOutcome;
  affectedCount: number;
  totalEligibleCount: number;
  affectedPercent: number;
  reasons: string[];
  privateHeadsUpMemberIds: string[];
  newConsecutiveFlaggedChecks: number;
}

export interface EvaluateDecisionInput {
  readings: AttendeeReading[];
  rainForecast?: RainForecast | null;
  previousState?: PreviousState | null;
  policy?: Partial<PlanPolicy>;
  evaluationTime?: Date;
}
