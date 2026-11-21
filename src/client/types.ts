export interface ProviderHealth {
  name: string;
  configured: boolean;
  status: 'configured' | 'skipped' | 'blocked_config';
  reason?: string;
  endpoint: string;
}

export interface BudgetStatus {
  researchCeiling: number;
  researchSpent: number;
  plannedMaxSpend: number;
  untouchedReserve: number;
  totalAccountBudget: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  mode: 'LIVE' | 'SIMULATION' | 'REPLAY';
  timestamp: string;
  worker: {
    status: 'active' | 'inactive';
    leaseAcquired: boolean;
    lastHeartbeat: string | null;
  };
  budget: BudgetStatus;
  providers: {
    serpapi: ProviderHealth;
    you: ProviderHealth;
    teamChannel: ProviderHealth;
  };
  activePactsCount: number;
}

export interface ParticipantRecord {
  id: string;
  pact_id: string;
  user_id: string;
  user_name: string;
  neighbourhood: string;
  origin_lat: number;
  origin_lon: number;
  max_duration_s: number;
  approval_version: number | null;
  approved_at: string | null;
  is_approved: boolean;
}

export interface PactDetails {
  id: string;
  team_id: string;
  title: string;
  version: number;
  status: 'draft' | 'awaiting_approval' | 'armed' | 'paused' | 'closed' | 'completed';
  destination_name: string;
  destination_place_id: string;
  destination_lat: number;
  destination_lon: number;
  destination_address?: string;
  decision_deadline_utc: string;
  decision_deadline_ist: string;
  fallback_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: ParticipantRecord[];
  all_approved: boolean;
  can_current_user_approve: boolean;
  is_current_user_approved: boolean;
  consecutive_breaches?: number;
  is_alert_active?: boolean;
  latest_source_at?: number | null;
}

export interface TeamMember {
  user_id: string;
  user_name: string;
  neighbourhood: string;
  role: string;
}

export interface UserAcknowledgement {
  userId: string;
  userName: string;
  decision: 'keep' | 'remote' | 'discuss' | 'remote_fallback' | 'keep_plan';
  action?: 'keep' | 'remote' | 'discuss' | 'remote_fallback' | 'keep_plan';
  createdAt: string;
  createdAtIst?: string;
}

export interface ConsensusState {
  status: 'pending' | 'resolved' | 'needs_discussion' | 'remote_fallback' | 'keep_plan';
  resolvedAction: 'remote' | 'keep' | 'discuss' | 'remote_fallback' | 'keep_plan' | null;
  isResolved: boolean;
  needsDiscussion: boolean;
  warningBanner: string | null;
  prefilledChat: string | null;
  resolvedAt: string | null;
  resolvedAtIst: string | null;
}

export interface BreachingObservation {
  id: string;
  watch_id?: string;
  received_at: string;
  provider_created_at?: string;
  provider_search_id?: string;
  validity: string;
  provenance: 'live' | 'replay' | 'synthetic';
  duration_minutes?: number | null;
  limit_minutes?: number;
  time_ist?: string;
  query_hash_prefix?: string;
}

export interface FullAlertReceipt {
  alertId: string;
  pactId: string;
  pactTitle: string;
  ruleVersion: number;
  episodeId: string;
  createdAt: string;
  createdAtIst?: string;
  destinationName: string;
  destinationAddress?: string;
  fallbackText: string;
  decisionDeadlineIst: string;
  participants: Array<{
    userId: string;
    userName: string;
    neighbourhood: string;
    limitMinutes: number;
  }>;
  participant: {
    userId: string;
    userName: string;
    neighbourhood: string;
    limitMinutes: number;
  };
  evidence: {
    baselineMinutes: number;
    check1Minutes: number;
    check1Timestamp: string;
    check1TimestampIst: string;
    check1LimitMinutes: number;
    check1Provenance: 'live' | 'replay' | 'synthetic';
    check1QueryHash: string;
    check2Minutes: number;
    check2Timestamp: string;
    check2TimestampIst: string;
    check2LimitMinutes: number;
    check2Provenance: 'live' | 'replay' | 'synthetic';
    check2QueryHash: string;
    sourceFreshnessSeconds: number;
    provenance: 'live' | 'replay' | 'synthetic';
    ruleFired: string;
  };
  areaIncidents: Array<{
    id: string;
    type: string;
    title: string;
  }>;
  publicContext?: any;
  acknowledgements: UserAcknowledgement[];
  currentDecisionStatus: string;
  outboxStatus?: string | null;
  outboxReceipt?: string | null;
  consensus: ConsensusState;
}
