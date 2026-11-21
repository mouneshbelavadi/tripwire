"""One request per selected API; standard library only. Missing keys => SKIPPED.
Run from any directory: python outputs/scripts/probe_apis.py
Never logs credentials or request URLs containing keys. No automatic retries.
"""
import datetime as dt
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'fixtures'
CONTRACT = ROOT / 'fixtures' / 'field-contract.json'

def env(*names):
    return next((os.environ[n] for n in names if os.environ.get(n)), None)

def reserve(db_path, label, cap=40):
    """Persistent cumulative ceiling, including failed/ambiguous attempts."""
    with closing(sqlite3.connect(db_path, timeout=10)) as db:
        db.execute('CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY, label TEXT, reserved_at TEXT)')
        db.execute('BEGIN IMMEDIATE')
        count = db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0]
        if count >= min(cap, 40):
            raise RuntimeError('Research SerpApi ceiling reached')
        db.execute('INSERT INTO attempts(label,reserved_at) VALUES(?,?)', (label, dt.datetime.now(dt.timezone.utc).isoformat()))
        db.commit()
        return count + 1

def values_at(value, path):
    nodes = [value]
    for part in path.split('.'):
        array = part.endswith('[]')
        name = part[:-2] if array else part
        found = [n[name] for n in nodes if isinstance(n, dict) and name in n]
        nodes = [v for arr in found if isinstance(arr, list) for v in arr] if array else found
    return nodes

def validate(payload, fields):
    checks = []
    for field in fields:
        values = values_at(payload, field['path'])
        kind = field['type']
        def correct(v):
            if kind == 'number': return isinstance(v, (int, float)) and not isinstance(v, bool)
            return isinstance(v, {'string': str, 'array': list, 'object': dict}[kind])
        checks.append({'path': field['path'], 'required_for': field['required_for'],
                       'observed_values': len(values),
                       'status': ('not_observed' if not values else 'verified' if all(correct(v) for v in values) else 'type_mismatch')})
    return checks

def request_once(label, url, body=None, headers=None, sensitive=False):
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    encoded = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=encoded, headers=headers or {}, method='POST' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(req, timeout=45) as res:
            raw, status = res.read(), res.status
    except urllib.error.HTTPError as err:
        raw, status = err.read(), err.code
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        return {'api': label, 'status': 'transport_failed', 'error_type': type(err).__name__, 'started_at': started}
    folder = FIXTURES / 'private' if sensitive else FIXTURES / 'raw'
    folder.mkdir(parents=True, exist_ok=True)
    name = label + '-' + secrets.token_hex(4) + '.json'
    # Exact bytes. Private token fixtures must never be shared or committed.
    (folder / name).write_bytes(raw)
    result = {'api': label, 'status': 'received', 'http_status': status, 'started_at': started,
              'raw_file': str((folder / name).relative_to(ROOT)), 'sha256': hashlib.sha256(raw).hexdigest()}
    try: result['_payload'] = json.loads(raw)
    except (ValueError, UnicodeError): result['status'] = 'invalid_json'
    return result

def main():
    FIXTURES.mkdir(exist_ok=True)
    contract = json.loads(CONTRACT.read_text(encoding='utf-8'))
    reports = []
    serp = env('SERPAPI_API_KEY', 'SERPAPI_KEY')
    jobs = [
        ('serp_maps', {'engine': 'google_maps', 'q': 'coworking Bellandur Bengaluru', 'll': '@12.929,77.676,14z', 'type': 'search', 'gl': 'in', 'hl': 'en'}),
        ('serp_directions', {'engine': 'google_maps_directions', 'start_coords': '12.9784,77.6408', 'end_coords': '12.929,77.676', 'travel_mode': '0', 'distance_unit': '0', 'gl': 'in', 'hl': 'en', 'no_cache': 'true'}),
        ('serp_traffic', {'engine': 'google_maps_traffic', 'bbox': '12.97,77.64,12.90,77.71', 'zoom': '13', 'gl': 'in', 'hl': 'en', 'no_cache': 'true'})
    ]
    for label, params in jobs:
        if not serp:
            reports.append({'api': label, 'status': 'skipped', 'reason': 'SERPAPI_API_KEY / SERPAPI_KEY missing'})
            continue
        try: reserve(FIXTURES / 'research-ledger.sqlite3', label)
        except RuntimeError:
            reports.append({'api': label, 'status': 'blocked_budget'})
            continue
        result = request_once(label, 'https://serpapi.com/search.json?' + urllib.parse.urlencode({**params, 'api_key': serp}))
        payload = result.pop('_payload', None)
        if isinstance(payload, dict):
            result['checks'] = validate(payload, contract[label])
            result['provider_success'] = payload.get('search_metadata', {}).get('status') == 'Success' and 'error' not in payload
        reports.append(result)
    key = env('YDC_API_KEY', 'YOU_API_KEY', 'YOU_COM_API_KEY')
    if key:
        result = request_once('you_answer', 'https://api.you.com/v1/answer',
            {'query': 'What public official sources publish Bengaluru traffic advisories? Cite sources. Do not infer that a specific commute is disrupted.', 'freshness': 'week'},
            {'X-API-Key': key, 'Content-Type': 'application/json'})
        payload = result.pop('_payload', None)
        if isinstance(payload, dict): result['checks'] = validate(payload, contract['you_answer'])
        reports.append(result)
    else: reports.append({'api': 'you_answer', 'status': 'skipped', 'reason': 'YDC_API_KEY / YOU_API_KEY / YOU_COM_API_KEY missing'})
    appkey, secret, base = env('NEXCONN_APP_KEY'), env('NEXCONN_APP_SECRET'), env('NEXCONN_API_BASE')
    if appkey and secret and base:
        allowed = {'https://api.sg-light-api.com', 'https://api-b.sg-light-api.com', 'https://api.us-light-api.com', 'https://api-b.us-light-api.com', 'https://api.sau-light-api.com', 'https://api-b.sau-light-api.com'}
        if base.rstrip('/') not in allowed:
            reports.append({'api': 'nex_token', 'status': 'blocked_config', 'reason': 'Base URL is not a documented regional HTTPS host'})
        else:
            nonce, stamp = secrets.token_hex(8), str(time.time_ns() // 1_000_000)
            signature = hashlib.sha1((secret + nonce + stamp).encode()).hexdigest()
            result = request_once('nex_token', base.rstrip('/') + '/v4/auth/access-token/issue',
                {'userId': 'officepactprobe', 'name': 'Office Pact Probe'},
                {'App-Key': appkey, 'Nonce': nonce, 'Timestamp': stamp, 'Signature': signature, 'Content-Type': 'application/json'}, sensitive=True)
            payload = result.pop('_payload', None)
            if isinstance(payload, dict):
                result['checks'] = validate(payload, contract['nex_token'])
                result['provider_success'] = payload.get('code') == 0
            reports.append(result)
    else:
        reports.append({'api': 'nex_token', 'status': 'skipped', 'reason': 'NEXCONN_APP_KEY, NEXCONN_APP_SECRET and/or NEXCONN_API_BASE missing'})
    reports.append({'api': 'nex_web_sdk', 'status': 'not_run', 'reason': 'Token issuance alone does not prove Web SDK connection or delivery; follow BUILDPLAN hour 3 in two test sessions'})
    ledger = FIXTURES / 'research-ledger.sqlite3'
    used = 0
    if ledger.exists():
        with closing(sqlite3.connect(ledger)) as db: used = db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0]
    output = {'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'serpapi_reserved_attempts_cumulative': used,
              'serpapi_research_cap': 40, 'reports': reports,
              'note': 'not_observed is not verified. Empty collections cannot validate item fields. No fabricated live fixtures.'}
    (FIXTURES / 'probe-report.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
    for report in reports: print(report['api'] + ': ' + report['status'])
    print('SerpApi reserved attempts:', used, '/ 40')

if __name__ == '__main__': main()
