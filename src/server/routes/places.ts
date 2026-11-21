import { Router } from 'express';
import { getDb, reserveCredit } from '../db.js';
import { config } from '../config.js';

export interface NormalizedPlace {
  place_id: string;
  title: string;
  address: string;
  gps_coordinates: {
    latitude: number;
    longitude: number;
  };
}

export const CURATED_FALLBACK_PLACES: NormalizedPlace[] = [
  {
    place_id: 'place_google_anantha_blr',
    title: 'Google Anantha Bengaluru',
    address: 'Google Anantha, Prestige Tech Park, Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103',
    gps_coordinates: { latitude: 12.9352, longitude: 77.6946 },
  },
  {
    place_id: 'place_paytm_office_blr',
    title: 'Paytm Office (One97 Communications)',
    address: 'Paytm Office, RMZ Ecoworld, Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103',
    gps_coordinates: { latitude: 12.9248, longitude: 77.6845 },
  },
  {
    place_id: 'ChIJk7Q3BqcUrzsR-q3Qe-place-01',
    title: 'WeWork Bellandur (Prestige Tech Park)',
    address: 'Prestige Tech Park, Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103',
    gps_coordinates: { latitude: 12.9290, longitude: 77.6760 },
  },
  {
    place_id: 'ChIJj7sY-y0VrzsRo1q2a-place-02',
    title: 'IndiQube Bellandur (Gamma)',
    address: 'Kadubeesanahalli, Outer Ring Rd, Bellandur, Bengaluru, Karnataka 560103',
    gps_coordinates: { latitude: 12.9345, longitude: 77.6892 },
  },
  {
    place_id: 'ChIJ9xZaP6EUrzsR8234bc-place-03',
    title: 'Urban Vault HSR Layout',
    address: '17th Cross Rd, Sector 4, HSR Layout, Bengaluru, Karnataka 560102',
    gps_coordinates: { latitude: 12.9121, longitude: 77.6446 },
  },
  {
    place_id: 'ChIJb6ZaP98TrzsR1902-place-04',
    title: 'BHIVE Workspace - Residency Road',
    address: 'Residency Rd, Shanthala Nagar, Ashok Nagar, Bengaluru, Karnataka 560025',
    gps_coordinates: { latitude: 12.9698, longitude: 77.6033 },
  },
  {
    place_id: 'ChIJ_indiranagar_hub_01',
    title: 'Indiranagar Hub',
    address: '100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
    gps_coordinates: { latitude: 12.9784, longitude: 77.6408 },
  },
  {
    place_id: 'ChIJ_koramangala_hub_03',
    title: 'Koramangala 4th Block',
    address: 'Sony World Junction, Koramangala 4th Block, Bengaluru, Karnataka 560034',
    gps_coordinates: { latitude: 12.9352, longitude: 77.6245 },
  },
];

export function normalizePlaces(rawList: any[]): NormalizedPlace[] {
  const normalized: NormalizedPlace[] = [];
  for (const item of rawList) {
    if (
      item &&
      typeof item.title === 'string' &&
      typeof item.place_id === 'string' &&
      item.gps_coordinates &&
      typeof item.gps_coordinates.latitude === 'number' &&
      typeof item.gps_coordinates.longitude === 'number'
    ) {
      normalized.push({
        place_id: item.place_id,
        title: item.title,
        address: item.address || 'Bengaluru, Karnataka',
        gps_coordinates: {
          latitude: Number(item.gps_coordinates.latitude),
          longitude: Number(item.gps_coordinates.longitude),
        },
      });
    }
  }
  return normalized;
}

export function getCuratedFallback(query: string): NormalizedPlace[] {
  const q = query.trim().toLowerCase();
  const filtered = CURATED_FALLBACK_PLACES.filter(
    (p) => p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
  );
  return filtered.length > 0 ? filtered : CURATED_FALLBACK_PLACES;
}

export async function queryOpenAIPlaces(query: string): Promise<NormalizedPlace[]> {
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;
  if (!openAiKey) return [];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a Bengaluru places resolver. Output a JSON object {"places": [...]} with up to 5 matching office or coworking places in Bengaluru. Each item must have: place_id (string), title (string), address (string), and gps_coordinates ({ latitude: number, longitude: number }). Output valid JSON only without markdown formatting.',
          },
          {
            role: 'user',
            content: `Search places matching: ${query}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.warn(`OpenAI Places API HTTP ${res.status}`);
      return [];
    }
    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : (parsed.places || parsed.results || []);
      return normalizePlaces(list);
    }
  } catch (err) {
    console.warn('OpenAI place suggestion failed:', err);
  }
  return [];
}

export async function querySerpApiPlaces(query: string): Promise<NormalizedPlace[]> {
  if (!config.serpApi.isConfigured) {
    return [];
  }

  const queryParams = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    ll: '@12.929,77.676,14z',
    type: 'search',
    gl: 'in',
    hl: 'en',
    api_key: config.serpApi.apiKey!,
  });

  const response = await fetch(`https://serpapi.com/search.json?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error(`SerpApi HTTP ${response.status}: ${await response.text()}`);
  }
  const data: any = await response.json();
  const rawList = data.local_results || data.places || [];
  return normalizePlaces(rawList);
}

export const placesRouter = Router();

// GET /api/places/autocomplete?q=...
placesRouter.get('/autocomplete', async (req, res) => {
  try {
    const rawQ = (req.query.q as string) || '';
    const q = rawQ.trim().toLowerCase();

    if (!q) {
      res.json({ places: [], cached: false });
      return;
    }

    const db = getDb();

    // 1. Check SQLite cache first: Identical searches cost 0 SerpApi credits
    const cached = db.prepare('SELECT results_json FROM place_cache WHERE query = ?').get(q) as { results_json: string } | undefined;
    if (cached) {
      const cachedPlaces = JSON.parse(cached.results_json);
      res.json({
        places: cachedPlaces,
        cached: true,
        notice: 'Loaded from SQLite place_cache (0 SerpApi credits)',
      });
      return;
    }

    // 2. Query places without blocking the user
    let places: NormalizedPlace[] = [];
    const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;

    // Check curated/known landmarks first for instant responsiveness
    const curatedMatches = CURATED_FALLBACK_PLACES.filter(
      (p) => p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
    );

    if (q.includes('google') || q.includes('anantha')) {
      const anantha = CURATED_FALLBACK_PLACES.find((p) => p.title.toLowerCase().includes('google anantha'));
      if (anantha) places.push(anantha);
    }
    if (q.includes('paytm') || q.includes('ecoworld')) {
      const paytm = CURATED_FALLBACK_PLACES.find((p) => p.title.toLowerCase().includes('paytm'));
      if (paytm && !places.some((p) => p.place_id === paytm.place_id)) places.push(paytm);
    }

    if (openAiKey && places.length === 0) {
      places = await queryOpenAIPlaces(rawQ);
    }

    if (places.length === 0 && config.serpApi.isConfigured) {
      try {
        reserveCredit('places_autocomplete', 250);
        places = await querySerpApiPlaces(rawQ);
      } catch (err) {
        console.warn('SerpApi query skipped or failed, using curated fallback:', err);
      }
    }

    // Merge with any matching curated places
    for (const cp of curatedMatches) {
      if (!places.some((p) => p.place_id === cp.place_id)) {
        places.push(cp);
      }
    }

    // Curated fallback if live providers returned empty
    if (places.length === 0) {
      places = getCuratedFallback(q);
    }

    // 4. Store in place_cache
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO place_cache (query, results_json, cached_at)
      VALUES (?, ?, ?)
      ON CONFLICT(query) DO UPDATE SET
        results_json = excluded.results_json,
        cached_at = excluded.cached_at
    `).run(q, JSON.stringify(places), nowIso);

    // 5. Return clean JSON without any budget errors
    res.json({ places, cached: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch places autocomplete' });
  }
});

// GET /api/places/search?q=... (convenience alias)
placesRouter.get('/search', async (req, res) => {
  const rawQ = (req.query.q as string) || '';
  const q = rawQ.trim().toLowerCase();
  const db = getDb();

  const cached = db.prepare('SELECT results_json FROM place_cache WHERE query = ?').get(q) as { results_json: string } | undefined;
  if (cached) {
    res.json({ places: JSON.parse(cached.results_json), venues: JSON.parse(cached.results_json), cached: true });
    return;
  }

  const places = getCuratedFallback(q);
  res.json({ places, venues: places, cached: false });
});
