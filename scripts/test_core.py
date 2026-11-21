import tempfile
from pathlib import Path
import unittest
from tripwire_core import RuleState, evaluate, fastest_driving, incident_snapshot, fingerprint
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

if __name__=='__main__': unittest.main(verbosity=2)
