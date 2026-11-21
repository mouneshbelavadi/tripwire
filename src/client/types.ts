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
    nexconn: ProviderHealth;
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
  status: 'draft' | 'awaiting_approval' | 'armed' | 'paused' | 'closed';
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
