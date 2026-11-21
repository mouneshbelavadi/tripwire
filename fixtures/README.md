# Fixture provenance

`probe-report.json` is the actual probe execution report. Missing credentials cause explicit SKIPPED records, not fake provider responses.

`field-contract.json` lists documentation-backed paths to check. Documentation presence is not live verification. An empty result array cannot prove its item fields exist; the validator reports `not_observed`.

On a credentialed run, exact SerpApi and You.com response bytes go into `raw/`; a Nexconn token response goes into `private/` because it contains a credential. Both directories are gitignored. Do not share the private directory. Non-2xx response bodies are retained too. The report stores hashes and field-check statuses without token values.

`research-ledger.sqlite3` conservatively reserves one credit before each SerpApi search attempt, with a cumulative ceiling of 40. Keep it across reruns. Other processes using the account are outside this local guard.

Synthetic rule tests in `scripts/test_core.py` are test inputs only. They are not search fixtures and do not validate Bengaluru coverage. There are no fabricated live API responses in this package.
