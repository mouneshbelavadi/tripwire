/**
 * Tripwire Teams - Google Geocoding & Coordinate Privacy
 * 
 * Enforces Rule 4: "Privacy by design. Home location is stored only as a label
 * plus coordinates rounded to 2 decimals (about 1 km), encrypted at rest.
 * The team lead sees only aggregates, never individual home areas."
 * Enforces Rule 8: "Never log secrets, tokens or coordinates."
 */

export interface GeocodingResult {
  formattedAddress: string;
  lat: number;
  lon: number;
}

/**
 * Rounds a geographic coordinate strictly to 2 decimal places.
 * At the equator / Bengaluru latitudes (~13° N), 0.01 degrees corresponds to ~1.11 km,
 * ensuring personal residential precision is obscured while preserving accurate corridor routing.
 */
export function roundCoordinate(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Convenience helper to round both latitude and longitude strictly to 2 decimal places.
 */
export function roundCoordinates(lat: number, lon: number): { lat: number; lon: number } {
  return {
    lat: roundCoordinate(lat),
    lon: roundCoordinate(lon),
  };
}

/**
 * Looks up an address using the Google Geocoding API.
 * 
 * Returns `{ formattedAddress, lat, lon }` where `lat` and `lon` are strictly rounded
 * to 2 decimal places (~1.1 km precision) to protect personal location privacy.
 * 
 * @param address Free text location or neighborhood (e.g. "HSR Layout, Bengaluru")
 * @param apiKey Google Maps / Geocoding API key
 * @param fetchFn Optional fetch implementation for testing or custom transport
 */
export async function geocodeAddress(
  address: string,
  apiKey: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<GeocodingResult> {
  const cleanAddress = address ? address.trim() : '';
  if (!cleanAddress) {
    throw new Error('Address is required for geocoding');
  }

  const cleanKey = apiKey ? apiKey.trim() : '';
  if (!cleanKey) {
    throw new Error('Google Maps API key is required for geocoding');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&key=${encodeURIComponent(cleanKey)}`;

  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (err: any) {
    throw new Error(`Geocoding network request failed: ${err?.message || err}`);
  }

  if (!response.ok) {
    throw new Error(`Geocoding HTTP error ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    status: string;
    error_message?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: {
        location?: {
          lat: number;
          lng: number;
        };
      };
    }>;
  };

  if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
    throw new Error(`No location found for "${cleanAddress}". Please specify a known neighborhood, landmark, or city.`);
  }

  if (data.status !== 'OK') {
    const errorDetail = data.error_message ? ` - ${data.error_message}` : '';
    throw new Error(`Geocoding failed with status "${data.status}"${errorDetail}`);
  }

  const firstResult = data.results[0];
  const location = firstResult.geometry?.location;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw new Error('Geocoding response is missing valid geographic coordinates');
  }

  // Strict 2-decimal rounding to protect user privacy (~1.1 km precision)
  const lat = roundCoordinate(location.lat);
  const lon = roundCoordinate(location.lng);
  const formattedAddress = firstResult.formatted_address || cleanAddress;

  return {
    formattedAddress,
    lat,
    lon,
  };
}
