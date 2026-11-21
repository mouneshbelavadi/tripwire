import tempfile
from pathlib import Path
import unittest
from tripwire_core import (
    RuleState, evaluate, fastest_driving, incident_snapshot, fingerprint,
    deadline_status, resolve_decision, estimate_credits
)
from probe_apis import reserve, validate

class Proof(unittest.TestCase):
    def setUp(self): self.s = RuleState('v1','q')
    def observation(self, **overrides):
        args=dict(observation_id='a',source_at=100,now=110,deadline=1000,duration=3900,limit=3600,query_hash='q',rule_version='v1')
        args.update(overrides)
        return evaluate(self.s,**args)
    def test_two_fresh_breaches(self):
        self.assertEqual(self.observation(),'confirming')
        self.assertEqual(self.observation(observation_id='b',source_at=120,now=130),'alert')
    def test_replay_cannot_confirm(self):
        self.observation()
        self.assertEqual(self.observation(),'duplicate_or_old')
        self.assertFalse(self.s.active)
    def test_same_cached_timestamp_cannot_confirm(self):
        self.observation()
        self.assertEqual(self.observation(observation_id='b'),'duplicate_or_old')
    def test_stale_cannot_alert(self): self.assertEqual(self.observation(now=900),'stale')
    def test_missing_cannot_be_zero(self): self.assertEqual(self.observation(duration=None),'unknown')
    def test_invalid_numeric(self):
        for value in [True, float('nan'), -1, 0]: self.assertEqual(self.observation(duration=value),'unknown')
    def test_deadline(self): self.assertEqual(self.observation(now=1000),'expired')
    def test_query_change(self): self.assertEqual(self.observation(query_hash='different'),'incomparable')
    def test_rule_change(self): self.assertEqual(self.observation(rule_version='v2'),'incomparable')
    def test_recovery_hysteresis(self):
        self.observation(); self.observation(observation_id='b',source_at=120,now=130)
        self.assertEqual(self.observation(observation_id='c',source_at=140,now=150,duration=3500),'active')
        self.assertEqual(self.observation(observation_id='d',source_at=160,now=170,duration=3300),'recovered')
    def test_route_reorder_not_change(self):
        rows=[{'travel_mode':'Driving','duration':4000},{'travel_mode':'Driving','duration':3500}]
        p={'search_metadata':{'status':'Success'},'directions':rows}
        a=fastest_driving(p); p['directions']=list(reversed(rows))
        self.assertEqual(a,fastest_driving(p))
    def test_empty_route_unknown(self): self.assertIsNone(fastest_driving({'search_metadata':{'status':'Success'},'directions':[]}))
    def test_incident_reordering(self):
        rows=[{'incident_id':'b','type':'construction'},{'incident_id':'a','type':'road_closed'}]
        p={'search_metadata':{'status':'Success'},'traffic_incidents':rows}
        a=fingerprint(incident_snapshot(p)); p['traffic_incidents'].reverse()
        self.assertEqual(a,fingerprint(incident_snapshot(p)))
    def test_empty_array_does_not_verify_fields(self):
        check=validate({'rows':[]},[{'path':'rows[].id','type':'string','required_for':'identity'}])[0]
        self.assertEqual(check['status'],'not_observed')
    def test_credit_ceiling_persists(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'budget.sqlite3'
            for i in range(40): self.assertEqual(reserve(path,'test'),i+1)
            with self.assertRaises(RuntimeError): reserve(path,'forty-first')

    def test_deadline_status(self):
        # 1000 is deadline, closing soon threshold = 300
        # now = 500 -> upcoming (500s remaining > 300)
        self.assertEqual(deadline_status(1000, 500, closing_soon_threshold=300), 'upcoming')
        # now = 700 -> closing_soon (300s remaining <= 300)
        self.assertEqual(deadline_status(1000, 700, closing_soon_threshold=300), 'closing_soon')
        # now = 900 -> closing_soon (100s remaining <= 300)
        self.assertEqual(deadline_status(1000, 900, closing_soon_threshold=300), 'closing_soon')
        # now = 1000 -> expired (exact deadline)
        self.assertEqual(deadline_status(1000, 1000, closing_soon_threshold=300), 'expired')
        # now = 1050 -> expired (past deadline)
        self.assertEqual(deadline_status(1000, 1050, closing_soon_threshold=300), 'expired')

    def test_decision_resolution(self):
        # Empty -> pending
        self.assertEqual(resolve_decision([]), 'pending')
        # Single vote (below quorum 2) -> pending
        self.assertEqual(resolve_decision([{'userId': 'maya', 'decision': 'remote'}]), 'pending')
        # Unanimous remote
        self.assertEqual(resolve_decision([
            {'userId': 'maya', 'decision': 'remote'},
            {'userId': 'arjun', 'decision': 'remote'}
        ]), 'unanimous_remote')
        # Unanimous keep
        self.assertEqual(resolve_decision([
            {'userId': 'maya', 'decision': 'keep'},
            {'userId': 'arjun', 'decision': 'keep'}
        ]), 'unanimous_keep')
        # Split votes -> needs_discussion
        self.assertEqual(resolve_decision([
            {'userId': 'maya', 'decision': 'remote'},
            {'userId': 'arjun', 'decision': 'keep'}
        ]), 'needs_discussion')
        # Any 'discuss' vote -> needs_discussion (even with partial quorum)
        self.assertEqual(resolve_decision([{'userId': 'maya', 'decision': 'discuss'}]), 'needs_discussion')
        self.assertEqual(resolve_decision([
            {'userId': 'maya', 'decision': 'discuss'},
            {'userId': 'arjun', 'decision': 'remote'}
        ]), 'needs_discussion')

    def test_credit_estimation(self):
        # 2 participants, 60 minutes window (5m route, 15m traffic, 2 reserve)
        # route: ceil(60/5) * 2 = 12 * 2 = 24
        # traffic: ceil(60/15) = 4
        # total: 24 + 4 + 2 = 30 credits
        est = estimate_credits(2, 60, route_interval_minutes=5, traffic_interval_minutes=15, contingency_reserve=2, budget_cap=40)
        self.assertEqual(est['route_checks'], 24)
        self.assertEqual(est['traffic_checks'], 4)
        self.assertEqual(est['total_estimated_credits'], 30)
        self.assertTrue(est['is_within_budget'])

        # Window exceeding budget cap
        est_big = estimate_credits(2, 180, budget_cap=40)
        # route: ceil(180/5)*2 = 36*2 = 72
        # traffic: ceil(180/15) = 12
        # total: 72 + 12 + 2 = 86 > 40
        self.assertFalse(est_big['is_within_budget'])
        self.assertEqual(est_big['total_estimated_credits'], 86)

    def test_two_breach_gate_and_recovery_margin_invariants(self):
        # Reset state: 60m (3600s) threshold, 5m (300s) recovery margin
        s = RuleState('v1', 'q')
        # 1st breach: confirming, active=False
        self.assertEqual(evaluate(s, observation_id='o1', source_at=100, now=110, deadline=1000,
                                  duration=3800, limit=3600, query_hash='q', rule_version='v1'), 'confirming')
        self.assertFalse(s.active)
        self.assertEqual(s.consecutive, 1)

        # 2nd breach (fresh): triggers alert, active=True
        self.assertEqual(evaluate(s, observation_id='o2', source_at=120, now=130, deadline=1000,
                                  duration=3900, limit=3600, query_hash='q', rule_version='v1'), 'alert')
        self.assertTrue(s.active)
        self.assertEqual(s.consecutive, 2)

        # 3rd breach while active: remains active
        self.assertEqual(evaluate(s, observation_id='o3', source_at=140, now=150, deadline=1000,
                                  duration=3950, limit=3600, query_hash='q', rule_version='v1'), 'active')
        self.assertTrue(s.active)

        # Hysteresis test: duration drops to 3450s (below limit 3600, but > 3600-300=3300)
        self.assertEqual(evaluate(s, observation_id='o4', source_at=160, now=170, deadline=1000,
                                  duration=3450, limit=3600, query_hash='q', rule_version='v1'), 'active')
        self.assertTrue(s.active)

        # Recovery: duration drops to 3300s (<= 3300s) -> recovers!
        self.assertEqual(evaluate(s, observation_id='o5', source_at=180, now=190, deadline=1000,
                                  duration=3300, limit=3600, query_hash='q', rule_version='v1'), 'recovered')
        self.assertFalse(s.active)

if __name__=='__main__': unittest.main(verbosity=2)
