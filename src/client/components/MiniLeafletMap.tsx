import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapOriginPoint {
  lat: number;
  lon: number;
  name: string;
  neighbourhood?: string;
}

interface MiniLeafletMapProps {
  lat: number;
  lon: number;
  title: string;
  address?: string;
  height?: string;
  origins?: MapOriginPoint[];
}

export function MiniLeafletMap({
  lat,
  lon,
  title,
  address,
  height = '260px',
  origins = [],
}: MiniLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check valid coordinates
    const validLat = typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
    const validLon = typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180;
    const destLat = validLat ? lat : 12.9352;
    const destLon = validLon ? lon : 77.6946;

    // Initialize map if needed
    if (!mapInstanceRef.current) {
      try {
        const map = L.map(containerRef.current, {
          center: [destLat, destLon],
          zoom: 13,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
        }).addTo(map);

        const layerGroup = L.layerGroup().addTo(map);
        layerGroupRef.current = layerGroup;
        mapInstanceRef.current = map;
      } catch (err) {
        console.warn('MiniLeafletMap init error:', err);
        return;
      }
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    // Clear previous markers
    layerGroup.clearLayers();

    const allPoints: [number, number][] = [[destLat, destLon]];

    // 1. Destination Marker (Emerald Green Pin)
    const destPin = L.divIcon({
      className: 'leaflet-dest-pin',
      html: `
        <div style="
          background: #1B4D3E;
          color: #FFFFFF;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          border: 2px solid #FFFFFF;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="22" x2="9" y2="22.01" />
            <line x1="15" y1="22" x2="15" y2="22.01" />
            <line x1="8" y1="6" x2="8" y2="6.01" />
            <line x1="16" y1="6" x2="16" y2="6.01" />
            <line x1="8" y1="10" x2="8" y2="10.01" />
            <line x1="16" y1="10" x2="16" y2="10.01" />
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    const destMarker = L.marker([destLat, destLon], { icon: destPin });
    destMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 13px;">
        <strong style="color: #1B4D3E; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B4D3E" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          TO: ${title}
        </strong>
        <div style="color: #555; font-size: 11px;">${address || ''}</div>
        <div style="color: #888; font-size: 10px; margin-top: 4px;">${destLat.toFixed(4)}, ${destLon.toFixed(4)}</div>
      </div>
    `);
    layerGroup.addLayer(destMarker);

    // 2. Commuter Origin Markers (Blue/Navy Pins with Dashed Corridors)
    origins.forEach((orig, idx) => {
      if (typeof orig.lat === 'number' && typeof orig.lon === 'number' && !isNaN(orig.lat) && !isNaN(orig.lon)) {
        allPoints.push([orig.lat, orig.lon]);

        const originPin = L.divIcon({
          className: 'leaflet-origin-pin',
          html: `
            <div style="
              background: #2563EB;
              color: #FFFFFF;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 3px 8px rgba(0,0,0,0.3);
              border: 2px solid #FFFFFF;
              font-size: 12px;
              font-weight: 700;
            ">
              ${orig.name ? orig.name.charAt(0) : (idx + 1)}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });

        const originMarker = L.marker([orig.lat, orig.lon], { icon: originPin });
        originMarker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; font-size: 13px;">
            <strong style="color: #2563EB; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              FROM: ${orig.name}
            </strong>
            <div style="color: #555; font-size: 11px;">${orig.neighbourhood || 'Commuter origin'}</div>
            <div style="color: #888; font-size: 10px; margin-top: 4px;">${orig.lat.toFixed(4)}, ${orig.lon.toFixed(4)}</div>
          </div>
        `);
        layerGroup.addLayer(originMarker);

        // Dashed corridor line to destination
        const corridorLine = L.polyline([[orig.lat, orig.lon], [destLat, destLon]], {
          color: '#1B4D3E',
          dashArray: '6, 8',
          weight: 3,
          opacity: 0.7,
        });
        layerGroup.addLayer(corridorLine);
      }
    });

    // Fit bounds to display all points
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
    } else {
      map.setView([destLat, destLon], 14);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      // Keep map instance alive across re-renders to prevent flicker
    };
  }, [lat, lon, title, address, origins]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="mini-leaflet-map-container"
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--radius-panel, 8px)',
        border: '1px solid var(--rule, #D5D8D0)',
        overflow: 'hidden',
        zIndex: 1,
      }}
      aria-label={`Interactive map showing commuter origins and destination: ${title}`}
    />
  );
}
