import { useState, useMemo } from 'react';
import { formatIstTime, formatFreshness, formatMargin } from '../lib/time';

export type ObservationResult =
  | 'within_limit'
  | 'breach_1'
  | 'alert_2'
  | 'stale'
  | 'unknown'
  | 'recovered';

export type ProvenanceType = 'live' | 'replay' | 'synthetic';

export interface ObservationRecord {
  id: string;
  timestamp: string | number; // ISO string or epoch
  timeIst?: string;
  participantId: string;
  participantName: string;
  neighbourhood: string;
  route: string;
  durationMinutes: number;
  limitMinutes: number;
  marginMinutes?: number;
  provenance: ProvenanceType;
  freshnessSeconds?: number;
  result: ObservationResult;
  normalizedPayload: Record<string, any>;
  queryHash: string;
  rawHash: string;
  providerSearchId?: string;
  notes?: string;
}

interface ObservationTableProps {
  observations?: ObservationRecord[];
  onSelectObservation?: (obs: ObservationRecord) => void;
  className?: string;
}

type SortField = 'time' | 'participant' | 'duration' | 'margin' | 'provenance' | 'result';
type SortOrder = 'asc' | 'desc';

export function ObservationTable({
  observations,
  className = '',
}: ObservationTableProps) {
  const [selectedObs, setSelectedObs] = useState<ObservationRecord | null>(null);
  const [filterParticipant, setFilterParticipant] = useState<string>('all');
  const [filterProvenance, setFilterProvenance] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Default observations representing audit and live trace if not provided
  const now = Date.now();
  const defaultObservations: ObservationRecord[] = useMemo(() => [
    {
      id: 'obs_dir_maya_72',
      timestamp: new Date(now - 30 * 1000).toISOString(),
      participantId: 'user_maya',
      participantName: 'Maya',
      neighbourhood: 'Indiranagar',
      route: 'Indiranagar → WeWork Bellandur',
      durationMinutes: 72,
      limitMinutes: 60,
      marginMinutes: 12,
      provenance: 'synthetic',
      freshnessSeconds: 30,
      result: 'alert_2',
      queryHash: 'c7d24a91e0fb23bf6e492ca79148d8b4c5b1695f87b89e31d4e082bfa816e812',
      rawHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      providerSearchId: 'synth_dir_breach_2_72m',
      normalizedPayload: {
        travel_mode: 'Driving',
        duration_seconds: 4320,
        formatted_duration: '1 hr 12 min',
        distance_km: 14.5,
        status: 'Success',
        rule_evaluation: {
          consecutive_breaches: 2,
          threshold_seconds: 3600,
          outcome: 'alert',
          alert_generated: true,
        },
      },
      notes: '2nd consecutive breach. Immutable Evidence Receipt generated.',
    },
    {
      id: 'obs_dir_maya_68',
      timestamp: new Date(now - 120 * 1000).toISOString(),
      participantId: 'user_maya',
      participantName: 'Maya',
      neighbourhood: 'Indiranagar',
      route: 'Indiranagar → WeWork Bellandur',
      durationMinutes: 68,
      limitMinutes: 60,
      marginMinutes: 8,
      provenance: 'synthetic',
      freshnessSeconds: 120,
      result: 'breach_1',
      queryHash: 'c7d24a91e0fb23bf6e492ca79148d8b4c5b1695f87b89e31d4e082bfa816e812',
      rawHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      providerSearchId: 'synth_dir_breach_1_68m',
      normalizedPayload: {
        travel_mode: 'Driving',
        duration_seconds: 4080,
        formatted_duration: '1 hr 8 min',
        distance_km: 14.2,
        status: 'Success',
        rule_evaluation: {
          consecutive_breaches: 1,
          threshold_seconds: 3600,
          outcome: 'confirming',
          alert_generated: false,
        },
      },
      notes: '1st breach detected. Awaiting 2nd fresh check to alert.',
    },
    {
      id: 'obs_dir_arjun_34',
      timestamp: new Date(now - 180 * 1000).toISOString(),
      participantId: 'user_arjun',
      participantName: 'Arjun',
      neighbourhood: 'HSR Layout',
      route: 'HSR Layout → WeWork Bellandur',
      durationMinutes: 34,
      limitMinutes: 60,
      marginMinutes: -26,
      provenance: 'live',
      freshnessSeconds: 180,
      result: 'within_limit',
      queryHash: 'a193fe4c2b9708dc2284b39178cb9d5e3f42c2b3a19b678cd821a37c95e84992',
      rawHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      providerSearchId: 'serp_dir_live_arjun_9831',
      normalizedPayload: {
        travel_mode: 'Driving',
        duration_seconds: 2040,
        formatted_duration: '34 min',
        distance_km: 7.8,
        status: 'Success',
        rule_evaluation: {
          consecutive_breaches: 0,
          threshold_seconds: 3600,
          outcome: 'within_limit',
          alert_generated: false,
        },
      },
      notes: 'Normal traffic flow on 14th Main Rd / Outer Ring Rd.',
    },
    {
      id: 'obs_dir_maya_replay',
      timestamp: new Date(now - 240 * 1000).toISOString(),
      participantId: 'user_maya',
      participantName: 'Maya',
      neighbourhood: 'Indiranagar',
      route: 'Indiranagar → WeWork Bellandur',
      durationMinutes: 68,
      limitMinutes: 60,
      marginMinutes: 8,
      provenance: 'replay',
      freshnessSeconds: 240,
      result: 'within_limit',
      queryHash: 'c7d24a91e0fb23bf6e492ca79148d8b4c5b1695f87b89e31d4e082bfa816e812',
      rawHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      providerSearchId: 'synth_dir_breach_1_68m',
      normalizedPayload: {
        travel_mode: 'Driving',
        duration_seconds: 4080,
        formatted_duration: '1 hr 8 min',
        status: 'Success',
        rule_evaluation: {
          consecutive_breaches: 1,
          outcome: 'duplicate_or_old',
          alert_generated: false,
          rejection_reason: 'Identical source timestamp / payload already evaluated.',
        },
      },
      notes: 'Deduplicated. Replayed payloads cannot confirm a breach streak.',
    },
    {
      id: 'obs_dir_maya_42_base',
      timestamp: new Date(now - 360 * 1000).toISOString(),
      participantId: 'user_maya',
      participantName: 'Maya',
      neighbourhood: 'Indiranagar',
      route: 'Indiranagar → WeWork Bellandur',
      durationMinutes: 42,
      limitMinutes: 60,
      marginMinutes: -18,
      provenance: 'live',
      freshnessSeconds: 360,
      result: 'within_limit',
      queryHash: 'c7d24a91e0fb23bf6e492ca79148d8b4c5b1695f87b89e31d4e082bfa816e812',
      rawHash: '7a13c9e9921471d491f074d0a39943fe00057187c3390234a41f92e4242e22c9',
      providerSearchId: 'serp_dir_live_maya_0192',
      normalizedPayload: {
        travel_mode: 'Driving',
        duration_seconds: 2520,
        formatted_duration: '42 min',
        distance_km: 13.9,
        status: 'Success',
        rule_evaluation: {
          consecutive_breaches: 0,
          threshold_seconds: 3600,
          outcome: 'within_limit',
          alert_generated: false,
        },
      },
      notes: 'Initial morning baseline check via live SerpApi.',
    },
  ], [now]);

  const rawList = observations && observations.length > 0 ? observations : defaultObservations;

  // Filter and Sort
  const filteredAndSorted = useMemo(() => {
    let list = [...rawList];

    // Filter by Participant
    if (filterParticipant !== 'all') {
      list = list.filter((o) =>
        o.participantName.toLowerCase() === filterParticipant.toLowerCase() ||
        o.participantId.toLowerCase() === filterParticipant.toLowerCase()
      );
    }

    // Filter by Provenance
    if (filterProvenance !== 'all') {
      list = list.filter((o) => o.provenance === filterProvenance);
    }

    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'time': {
          const tA = new Date(a.timestamp).getTime();
          const tB = new Date(b.timestamp).getTime();
          comparison = tA - tB;
          break;
        }
        case 'participant':
          comparison = a.participantName.localeCompare(b.participantName);
          break;
        case 'duration':
          comparison = a.durationMinutes - b.durationMinutes;
          break;
        case 'margin': {
          const mA = a.durationMinutes - a.limitMinutes;
          const mB = b.durationMinutes - b.limitMinutes;
          comparison = mA - mB;
          break;
        }
        case 'provenance':
          comparison = a.provenance.localeCompare(b.provenance);
          break;
        case 'result':
          comparison = a.result.localeCompare(b.result);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [rawList, filterParticipant, filterProvenance, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const renderResultBadge = (result: ObservationResult) => {
    switch (result) {
      case 'alert_2':
        return <span className="result-chip alert">● Alert 2/2</span>;
      case 'breach_1':
        return <span className="result-chip breach">▲ Breach 1/2</span>;
      case 'within_limit':
        return <span className="result-chip ok">✓ Within limit</span>;
      case 'recovered':
        return <span className="result-chip recovered">↺ Recovered</span>;
      case 'stale':
        return <span className="result-chip stale">⏱ Stale</span>;
      case 'unknown':
      default:
        return <span className="result-chip unknown">? Unknown</span>;
    }
  };

  const renderProvenanceChip = (prov: ProvenanceType) => {
    switch (prov) {
      case 'live':
        return <span className="prov-chip live">LIVE SERPAPI</span>;
      case 'synthetic':
        return <span className="prov-chip synthetic">SYNTHETIC</span>;
      case 'replay':
        return <span className="prov-chip replay">REPLAY (DEDUP)</span>;
      default:
        return <span className="prov-chip">{prov}</span>;
    }
  };

  return (
    <div className={`observation-datatable-wrapper ${className}`}>
      {/* Table Filter & Controls Toolbar */}
      <div className="table-controls-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-title">Observation &amp; Query Invariant Table</span>
          <span className="toolbar-count">
            Showing {filteredAndSorted.length} of {rawList.length} records
          </span>
        </div>

        <div className="toolbar-filters">
          {/* Participant Filter */}
          <div className="filter-group">
            <label htmlFor="filter-participant">Participant:</label>
            <select
              id="filter-participant"
              value={filterParticipant}
              onChange={(e) => setFilterParticipant(e.target.value)}
              className="select-input-sm"
            >
              <option value="all">All Participants</option>
              <option value="maya">Maya (Indiranagar)</option>
              <option value="arjun">Arjun (HSR Layout)</option>
            </select>
          </div>

          {/* Provenance Filter */}
          <div className="filter-group">
            <label htmlFor="filter-provenance">Provenance:</label>
            <select
              id="filter-provenance"
              value={filterProvenance}
              onChange={(e) => setFilterProvenance(e.target.value)}
              className="select-input-sm"
            >
              <option value="all">All Provenances</option>
              <option value="live">Live SerpApi</option>
              <option value="synthetic">Synthetic</option>
              <option value="replay">Replay</option>
            </select>
          </div>
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="datatable-scroll-container">
        <table className="observation-table" role="grid" aria-label="Commute Observation Records">
          <thead>
            <tr>
              <th onClick={() => handleSort('time')} className="sortable-th">
                Time (IST) {sortField === 'time' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('participant')} className="sortable-th">
                Participant {sortField === 'participant' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Route</th>
              <th onClick={() => handleSort('duration')} className="sortable-th numeric">
                Duration {sortField === 'duration' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="numeric">Limit</th>
              <th onClick={() => handleSort('margin')} className="sortable-th numeric">
                Margin {sortField === 'margin' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('provenance')} className="sortable-th">
                Provenance {sortField === 'provenance' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Freshness</th>
              <th onClick={() => handleSort('result')} className="sortable-th">
                Result {sortField === 'result' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="action-th">Audit</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((obs) => {
              const margin = formatMargin(obs.durationMinutes, obs.limitMinutes);
              const freshness = formatFreshness(obs.timestamp);
              const isSelected = selectedObs?.id === obs.id;

              return (
                <tr
                  key={obs.id}
                  onClick={() => setSelectedObs(obs)}
                  className={`observation-row ${isSelected ? 'row-selected' : ''}`}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedObs(obs);
                    }
                  }}
                >
                  <td className="cell-time">{formatIstTime(obs.timestamp)}</td>
                  <td className="cell-participant">
                    <span className="part-badge">{obs.participantName}</span>
                  </td>
                  <td className="cell-route" title={obs.route}>
                    {obs.route}
                  </td>
                  <td className="cell-duration numeric">
                    <strong style={{ color: obs.durationMinutes > obs.limitMinutes ? '#B91C1C' : '#1B4D3E' }}>
                      {obs.durationMinutes}m
                    </strong>
                  </td>
                  <td className="cell-limit numeric">{obs.limitMinutes}m</td>
                  <td className="cell-margin numeric">
                    <span className={`margin-pill ${margin.isBreach ? 'over' : 'under'}`}>
                      {margin.text}
                    </span>
                  </td>
                  <td className="cell-prov">{renderProvenanceChip(obs.provenance)}</td>
                  <td className="cell-freshness">
                    <span className={`freshness-indicator ${freshness.isFresh ? 'fresh' : 'stale'}`}>
                      {freshness.text}
                    </span>
                  </td>
                  <td className="cell-result">{renderResultBadge(obs.result)}</td>
                  <td className="cell-action">
                    <button
                      type="button"
                      className="btn-inspect-row"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedObs(obs);
                      }}
                      aria-label={`Inspect observation ${obs.id}`}
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Row Click Inspection Detail Drawer (Overlay Modal / Slide-out) */}
      {selectedObs && (
        <div
          className="detail-drawer-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          onClick={() => setSelectedObs(null)}
        >
          <div
            className="detail-drawer"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setSelectedObs(null)}
          >
            <div className="drawer-header">
              <div>
                <h3 id="drawer-title" className="drawer-title">
                  Observation Audit: <code>{selectedObs.id}</code>
                </h3>
                <span className="drawer-subtitle">
                  Recorded {formatIstTime(selectedObs.timestamp)} · Provenance: <strong>{selectedObs.provenance.toUpperCase()}</strong>
                </span>
              </div>
              <button
                type="button"
                className="btn-drawer-close"
                onClick={() => setSelectedObs(null)}
                aria-label="Close detail drawer"
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {/* Quick Summary Chips */}
              <div className="drawer-summary-grid">
                <div className="drawer-summary-item">
                  <span className="summary-label">Participant</span>
                  <span className="summary-val">{selectedObs.participantName} ({selectedObs.neighbourhood})</span>
                </div>
                <div className="drawer-summary-item">
                  <span className="summary-label">Fastest Driving</span>
                  <span className="summary-val" style={{ color: selectedObs.durationMinutes > selectedObs.limitMinutes ? '#B91C1C' : '#1B4D3E' }}>
                    {selectedObs.durationMinutes} min (Limit: {selectedObs.limitMinutes}m)
                  </span>
                </div>
                <div className="drawer-summary-item">
                  <span className="summary-label">Rule Margin</span>
                  <span className="summary-val">
                    {formatMargin(selectedObs.durationMinutes, selectedObs.limitMinutes).text}
                  </span>
                </div>
                <div className="drawer-summary-item">
                  <span className="summary-label">Rule Evaluation</span>
                  <span className="summary-val">{renderResultBadge(selectedObs.result)}</span>
                </div>
              </div>

              {selectedObs.notes && (
                <div className="drawer-notes-banner">
                  <strong>Evaluation Note:</strong> {selectedObs.notes}
                </div>
              )}

              {/* Cryptographic Invariant Hashes */}
              <div className="drawer-section">
                <h4 className="drawer-section-heading">Cryptographic Invariant Signatures</h4>

                <div className="hash-block">
                  <div className="hash-label-row">
                    <span className="hash-title">Canonical Query Hash (sha256)</span>
                    <button
                      type="button"
                      className="btn-copy-hash"
                      onClick={() => copyToClipboard(selectedObs.queryHash, 'query')}
                    >
                      {copiedHash === 'query' ? '✓ Copied' : 'Copy Hash'}
                    </button>
                  </div>
                  <code className="hash-code">{selectedObs.queryHash}</code>
                  <div className="hash-hint">
                    Deterministic hash of search parameters excluding transient keys (<code>api_key</code>, <code>no_cache</code>). Prevents false change triggers across runs.
                  </div>
                </div>

                <div className="hash-block" style={{ marginTop: '12px' }}>
                  <div className="hash-label-row">
                    <span className="hash-title">Raw Response Payload Hash (sha256)</span>
                    <button
                      type="button"
                      className="btn-copy-hash"
                      onClick={() => copyToClipboard(selectedObs.rawHash, 'raw')}
                    >
                      {copiedHash === 'raw' ? '✓ Copied' : 'Copy Hash'}
                    </button>
                  </div>
                  <code className="hash-code">{selectedObs.rawHash}</code>
                  <div className="hash-hint">
                    Immutable sha256 checksum of original SerpApi provider response JSON for tamper verification and replay deduplication.
                  </div>
                </div>
              </div>

              {/* Normalized Payload JSON Viewer */}
              <div className="drawer-section" style={{ marginTop: '16px' }}>
                <div className="hash-label-row">
                  <h4 className="drawer-section-heading" style={{ margin: 0 }}>
                    Normalized Observation Payload
                  </h4>
                  <button
                    type="button"
                    className="btn-copy-hash"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(selectedObs.normalizedPayload, null, 2), 'payload')
                    }
                  >
                    {copiedHash === 'payload' ? '✓ Copied JSON' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="json-payload-viewer">
                  <code>{JSON.stringify(selectedObs.normalizedPayload, null, 2)}</code>
                </pre>
              </div>
            </div>

            <div className="drawer-footer">
              <span className="drawer-footer-hint">
                Observation entities are append-only and cryptographically verified in SQLite.
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedObs(null)}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
