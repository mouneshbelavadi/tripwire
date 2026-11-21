import {
  INCIDENT_DISCLAIMER,
  getIncidentTypeDetails,
} from '../../common/incidentTypes';

export interface TrafficIncidentItem {
  id: string;
  type: string;
  title: string;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  lastUpdated?: string;
  isNew?: boolean;
}

interface AreaIncidentsListProps {
  incidents?: TrafficIncidentItem[];
  bboxDescription?: string;
  className?: string;
}

export function AreaIncidentsList({
  incidents,
  bboxDescription = 'Bellandur / Outer Ring Rd Corridor (BBox: 12.915,77.660 to 12.945,77.695)',
  className = '',
}: AreaIncidentsListProps) {
  // Default illustrative incidents matching synthetic/SerpApi payloads
  const defaultIncidents: TrafficIncidentItem[] = [
    {
      id: 'trf_bellandur_waterlogging_01',
      type: 'road_closed',
      title: 'Waterlogging & Deep Puddle Closure at Bellandur Central Junction',
      location: 'Outer Ring Rd near Central Mall, Bellandur',
      coordinates: { latitude: 12.9295, longitude: 77.6755 },
      isNew: true,
    },
    {
      id: 'trf_outer_ring_congestion_02',
      type: 'construction',
      title: 'Metro Rail Phase 2A Pillar Erection & Lane Narrowing',
      location: 'Outer Ring Rd between Iblur & Bellandur flyover',
      coordinates: { latitude: 12.932, longitude: 77.682 },
      isNew: false,
    },
  ];

  const items = incidents && incidents.length > 0 ? incidents : defaultIncidents;

  return (
    <div className={`area-incidents-container ${className}`}>
      {/* Header Row */}
      <div className="area-incidents-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className="area-incidents-title">Monitored Area Traffic Incidents</h3>
          <span className="incidents-badge">{items.length} Active in BBox</span>
        </div>
        <span className="incidents-engine-tag">Engine: google_maps_traffic</span>
      </div>

      {/* Mandatory Standard Invariant Disclaimer Banner */}
      <div className="incident-disclaimer-banner" role="note">
        <span className="disclaimer-icon">⚠️</span>
        <div className="disclaimer-text">
          <strong>Standard Disclaimer:</strong> “{INCIDENT_DISCLAIMER}”
          <p className="disclaimer-sub">
            Invariant rule: Newly discovered incident IDs advance the next scheduled route check, but <em>cannot</em> assert that any participant route is impassable or satisfy the numerical 60m threshold.
          </p>
        </div>
      </div>

      <div className="incidents-bbox-info">
        <span className="bbox-label">Monitored Bounding Box:</span>
        <code className="bbox-code">{bboxDescription}</code>
      </div>

      {/* Incidents Card List */}
      <div className="incidents-list" role="list" aria-label="Area Traffic Incidents">
        {items.length === 0 ? (
          <div className="incidents-empty-state">
            <span>✓ No incidents returned for this bounding box.</span>
            <span className="empty-sub">
              (Empty response indicates none returned by provider; does not guarantee zero road friction.)
            </span>
          </div>
        ) : (
          items.map((inc) => {
            const details = getIncidentTypeDetails(inc.type);

            return (
              <div key={inc.id} className={`incident-item-card severity-${details.severity}`} role="listitem">
                <div className="incident-top-row">
                  <div className="incident-type-tag">
                    <span className="type-icon">{details.icon}</span>
                    <span className="type-label">{details.label}</span>
                    {inc.isNew && <span className="pill-new">NEWLY OBSERVED</span>}
                  </div>
                  <code className="incident-id">{inc.id}</code>
                </div>

                <div className="incident-title">{inc.title}</div>

                <div className="incident-meta-row">
                  {inc.location && (
                    <span className="meta-loc">📍 {inc.location}</span>
                  )}
                  {inc.coordinates && (
                    <span className="meta-coords">
                      GPS: {inc.coordinates.latitude.toFixed(4)}, {inc.coordinates.longitude.toFixed(4)}
                    </span>
                  )}
                  <span className="meta-impact">
                    Route Impact: <strong>Unverified Area Context Only</strong>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
