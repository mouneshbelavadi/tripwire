"""Local proof of the decision kernel, not a production monitor."""
from dataclasses import dataclass, field
import hashlib
import json
import math

def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()

def fastest_driving(payload):
    if payload.get('search_metadata', {}).get('status') != 'Success' or payload.get('error'):
        return None
    rows = payload.get('directions')
    if not isinstance(rows, list): return None
    values = [r['duration'] for r in rows if isinstance(r, dict) and r.get('travel_mode') == 'Driving'
              and isinstance(r.get('duration'), (int, float)) and not isinstance(r['duration'], bool)
              and math.isfinite(r['duration']) and r['duration'] > 0]
    return min(values) if values else None

def incident_snapshot(payload):
    rows = payload.get('traffic_incidents')
    if payload.get('search_metadata', {}).get('status') != 'Success' or not isinstance(rows, list): return None
    # Optional text and position deliberately excluded from detection.
    result = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('incident_id'), str) or not isinstance(row.get('type'), str):
            return None
        result[row['incident_id']] = row['type']
    return dict(sorted(result.items()))

@dataclass
class RuleState:
    rule_version: str
    query_hash: str
    consecutive: int = 0
    active: bool = False
    last_source_at: float = float('-inf')
    seen_ids: set = field(default_factory=set)

def evaluate(state, *, observation_id, source_at, now, deadline, duration, limit,
             query_hash, rule_version, max_age=300, reset_margin=300):
    if now >= deadline: return 'expired'
    if rule_version != state.rule_version or query_hash != state.query_hash: return 'incomparable'
    if observation_id in state.seen_ids or source_at <= state.last_source_at: return 'duplicate_or_old'
    if not (isinstance(duration, (int,float)) and not isinstance(duration,bool) and math.isfinite(duration) and duration > 0):
        state.consecutive = 0
        return 'unknown'
    if source_at > now or now-source_at > max_age:
        state.consecutive = 0
        return 'stale'
    state.seen_ids.add(observation_id)
    state.last_source_at = source_at
    if duration > limit:
        state.consecutive += 1
        if state.consecutive >= 2 and not state.active:
            state.active = True
            return 'alert'
        return 'active' if state.active else 'confirming'
    state.consecutive = 0
    if state.active and duration <= limit-reset_margin:
        state.active = False
        return 'recovered'
    return 'active' if state.active else 'within_limit'
