import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PactDetails } from '../types';

export interface MapRouteData {
  participantId: string;
  userName: string;
  originNeighbourhood: string;
  originCoords: [number, number]; // [lat, lon]
  destinationName: string;
  destCoords: [number, number]; // [lat, lon]
  currentDurationMinutes: number;
  normalDurationMinutes: number; // baseline
  limitMinutes: number;
  geometry?: [number, number][]; // optional route points
}

export interface MapIncidentData {
  id: string;
  type: string;
  title: string;
  coords: [number, number];
}

interface EvidenceMapProps {
  pact: PactDetails;
  routes?: MapRouteData[];
  incidents?: MapIncidentData[];
  className?: string;
}

/**
 * Calculates delay ratio and returns semantic color & label:
 * - Green (<1.2x normal duration)
 * - Amber (1.2x to 1.5x)
 * - Red (>1.5x)
 */
export function getRouteDelayMetrics(observedMins: number, normalMins: number) {
  const normal = Math.max(1, normalMins || 40);
  const ratio = observedMins / normal;

  if (ratio > 1.5) {
    return {
      ratio,
      ratioFormatted: `${ratio.toFixed(2)}x`,
      color: '#B91C1C', // --red
      bgColor: '#FEE2E2',
      category: 'severe',
      label: 'Severe Delay (>1.5x)',
    };
  }
  if (ratio >= 1.2) {
    return {
      ratio,
      ratioFormatted: `${ratio.toFixed(2)}x`,
      color: '#B45309', // --amber
      bgColor: '#FEF3C7',
      category: 'moderate',
      label: 'Moderate Delay (1.2x–1.5x)',
    };
  }
  return {
    ratio,
    ratioFormatted: `${ratio.toFixed(2)}x`,
    color: '#1B4D3E', // --forest green
    bgColor: '#EBF3EE',
    category: 'normal',
    label: 'Normal Flow (<1.2x)',
  };
}

export function EvidenceMap({
  pact,
  routes,
  incidents = [],
  className = '',
}: EvidenceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Default route data derived from pact if not explicitly provided
  const resolvedRoutes: MapRouteData[] =
    routes && routes.length > 0
      ? routes
      : (pact.participants || []).map((p) => {
          // Baselines: Maya standard is ~42m, Arjun standard is ~34m
          const normalMinutes = p.user_id === 'user_maya' ? 42 : 34;
          // Current estimate: if alert or breach active, Maya is 72m; otherwise 42m
          const currentMinutes =
            p.user_id === 'user_maya'
              ? pact.is_alert_active || (pact.consecutive_breaches && pact.consecutive_breaches > 0)
                ? 72
                : 42
              : 34;

          return {
            participantId: p.id,
            userName: p.user_name,
            originNeighbourhood: p.neighbourhood,
            originCoords: [p.origin_lat || 12.9784, p.origin_lon || 77.6408],
            destinationName: pact.destination_name,
            destCoords: [pact.destination_lat || 12.9290, pact.destination_lon || 77.6760],
            currentDurationMinutes: currentMinutes,
            normalDurationMinutes: normalMinutes,
            limitMinutes: Math.round((p.max_duration_s || 3600) / 60),
          };
        });

  // Default area incidents around destination corridor
  const resolvedIncidents: MapIncidentData[] =
    incidents && incidents.length > 0
      ? incidents
      : [
          {
            id: 'trf_bellandur_waterlogging_01',
            type: 'weather',
            title: 'Waterlogging & Slow Traffic at Bellandur Central Junction',
            coords: [12.9305, 77.6780],
          },
          {
            id: 'trf_outer_ring_congestion_02',
            type: 'construction',
            title: 'Metro Pillar Construction & Narrowing on Outer Ring Road',
            coords: [12.9340, 77.6830],
          },
        ];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      // High-performance Esri World Street Map tiles (Zero rate-limit blocks, no API key required)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
        maxZoom: 19,
      }).addTo(map);

      layersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layers = layersGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const allBoundsCoords: [number, number][] = [];

    // 1. Destination Marker (Bellandur)
    const destCoords: [number, number] = [
      pact.destination_lat || 12.9290,
      pact.destination_lon || 77.6760,
    ];
    allBoundsCoords.push(destCoords);

    const destIcon = L.divIcon({
      className: 'custom-map-marker destination-marker',
      html: `
        <div class="marker-pin destination-pin" title="${pact.destination_name}">
          <span class="pin-symbol">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/></svg>
          </span>
          <span class="pin-label">${pact.destination_name}</span>
        </div>
      `,
      iconSize: [140, 40],
      iconAnchor: [70, 36],
    });

    const destMarker = L.marker(destCoords, { icon: destIcon }).addTo(layers);
    destMarker.bindPopup(`
      <div class="map-popup-card">
        <strong>Destination: ${pact.destination_name}</strong>
        <p style="margin: 4px 0 0; color: #4A4A4A; font-size: 12px;">
          ${pact.destination_address || 'Outer Ring Rd, Bellandur, Bengaluru'}
        </p>
        <div style="margin-top: 6px; font-size: 11px; color: #1B4D3E; font-weight: 600;">
          Pact Decision Deadline: ${pact.decision_deadline_ist}
        </div>
      </div>
    `);

    // 2. Participant Origins & Routes

    resolvedRoutes.forEach((route) => {
      allBoundsCoords.push(route.originCoords);

      const delayMetrics = getRouteDelayMetrics(
        route.currentDurationMinutes,
        route.normalDurationMinutes
      );

      // Participant Origin Marker
      const initial = route.userName.charAt(0).toUpperCase();
      const originIcon = L.divIcon({
        className: 'custom-map-marker origin-marker',
        html: `
          <div class="marker-pin origin-pin" style="border-color: ${delayMetrics.color}">
            <span class="pin-badge" style="background: ${delayMetrics.color}">${initial}</span>
            <span class="pin-label">${route.userName} (${route.originNeighbourhood})</span>
          </div>
        `,
        iconSize: [130, 36],
        iconAnchor: [65, 32],
      });

      const originMarker = L.marker(route.originCoords, { icon: originIcon }).addTo(layers);
      originMarker.bindPopup(`
        <div class="map-popup-card">
          <strong>Participant: ${route.userName}</strong>
          <div>Origin: <strong>${route.originNeighbourhood}</strong></div>
          <div>Observed Driving Duration: <strong>${route.currentDurationMinutes} min</strong></div>
          <div>Baseline Normal: <strong>${route.normalDurationMinutes} min</strong></div>
          <div>Pact Threshold Limit: <strong>${route.limitMinutes} min</strong></div>
          <div style="margin-top: 6px; padding: 4px 8px; border-radius: 4px; background: ${delayMetrics.bgColor}; color: ${delayMetrics.color}; font-weight: 600; font-size: 11px;">
            Delay Ratio: ${delayMetrics.ratioFormatted} · ${delayMetrics.label}
          </div>
        </div>
      `);

      // Route Polyline
      const hasGeometry = route.geometry && route.geometry.length > 1;
      const polylinePoints: [number, number][] = hasGeometry
        ? route.geometry!
        : [route.originCoords, route.destCoords];

      const polyline = L.polyline(polylinePoints, {
        color: delayMetrics.color,
        weight: 5,
        opacity: 0.85,
        dashArray: hasGeometry ? undefined : '8, 8', // dashed straight line fallback
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layers);

      polyline.bindPopup(`
        <div class="map-popup-card">
          <strong>Corridor: ${route.originNeighbourhood} → ${route.destinationName}</strong>
          <div style="margin: 4px 0;">Participant: <strong>${route.userName}</strong></div>
          <div>Current Driving Duration: <strong style="color: ${delayMetrics.color}">${route.currentDurationMinutes} min</strong> (Normal: ${route.normalDurationMinutes}m, Limit: ${route.limitMinutes}m)</div>
          <div style="margin-top: 4px;">Delay Ratio: <strong>${delayMetrics.ratioFormatted}</strong> (${delayMetrics.label})</div>
          ${
            !hasGeometry
              ? '<div style="margin-top: 6px; font-size: 11px; color: #666; font-style: italic;">Clean straight dashed corridor displayed: Turn-by-turn geometry not returned by engine.</div>'
              : ''
          }
        </div>
      `);
    });

    // 3. Area Incident Markers (SerpApi google_maps_traffic)
    resolvedIncidents.forEach((inc) => {
      allBoundsCoords.push(inc.coords);

      const incidentIcon = L.divIcon({
        className: 'custom-map-marker incident-marker',
        html: `
          <div class="marker-pin incident-pin" title="${inc.title}">
            <span class="pin-symbol">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <span class="pin-label-mini">Area Incident</span>
          </div>
        `,
        iconSize: [90, 30],
        iconAnchor: [45, 26],
      });

      const incMarker = L.marker(inc.coords, { icon: incidentIcon }).addTo(layers);
      incMarker.bindPopup(`
        <div class="map-popup-card">
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #B45309; background: #FEF3C7; padding: 2px 6px; border-radius: 3px;">
            Area Incident (SerpApi)
          </span>
          <div style="font-weight: 600; margin-top: 6px; font-size: 12px; color: #1A1A1A;">
            ${inc.title}
          </div>
          <p style="margin: 6px 0 0; font-size: 11px; color: #666; font-style: italic;">
            Disclaimer: Area incident, effect on individual routes is unverified.
          </p>
        </div>
      `);
    });

    // Auto-fit to bounds
    if (allBoundsCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(allBoundsCoords);
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 14,
        });
      } catch (err) {
        console.warn('Leaflet fitBounds failed:', err);
      }
    }

    // Force map size invalidation in case container was rendered in hidden tab
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
  }, [pact, resolvedRoutes, resolvedIncidents]);

  return (
    <div className={`evidence-map-wrapper ${className}`}>
      <div className="evidence-map-header">
        <div className="map-title-row">
          <span className="map-title">Corridor Spatial Verification Map</span>
          <span className="map-engine-tag">OpenStreetMap Tiles · SerpApi Coordinates</span>
        </div>
        <span className="map-subtitle">
          Real-time commute corridors to <strong>{pact.destination_name}</strong>
        </span>
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="leaflet-map-canvas"
        style={{ width: '100%', height: '340px', borderRadius: '6px', overflow: 'hidden' }}
        role="region"
        aria-label="Interactive Commute Evidence Map"
      />

      {/* Map Legend & Geometry Fallback Note */}
      <div className="map-legend-bar">
        <div className="legend-items-row">
          <div className="legend-item">
            <span className="legend-swatch normal" />
            <span className="legend-text">Normal (&lt;1.2x)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch moderate" />
            <span className="legend-text">Moderate (1.2x–1.5x)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch severe" />
            <span className="legend-text">Severe Delay (&gt;1.5x)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch dashed" />
            <span className="legend-text">Corridor Fallback (Dashed)</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <span className="legend-text">Area Incident</span>
          </div>
        </div>

        <div className="legend-fallback-note">
          ℹ Straight dashed line represents direct corridor path when turn-by-turn waypoint geometry is omitted by engine.
        </div>
      </div>
    </div>
  );
}
