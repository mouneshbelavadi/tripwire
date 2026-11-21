import { getDb } from '../db.js';
import { config } from '../config.js';
import { YouProvider } from '../providers/you.js';

export interface CitationItem {
  url: string;
  source: string;
  excerpt?: string;
}

export interface ContextResult {
  alertId: string;
  status: 'retrieved' | 'synthetic' | 'unavailable';
  answer: string;
  citations: CitationItem[];
  retrievedAt: string;
}

// Curated verified Bangalore public context for simulation mode
const SYNTHETIC_PUBLIC_CONTEXT: ContextResult = {
  alertId: '',
  status: 'synthetic',
  answer:
    'Bangalore Traffic Police (BTP) issued an advisory for the Outer Ring Road corridor between Silk Board and Bellandur: slow-moving traffic and lane restrictions due to ongoing metro work and drainage clearance. Commuters heading towards Bellandur should anticipate substantial delays.',
  citations: [
    {
      url: 'https://twitter.com/blrcitytraffic',
      source: 'Bangalore Traffic Police (Official Handle)',
      excerpt: 'Slow moving traffic due to vehicle breakdown and waterlogging near Bellandur EcoSpace.',
    },
    {
      url: 'https://ksp.karnataka.gov.in',
      source: 'Karnataka State Police Portal',
      excerpt: 'Public transit advisory for Outer Ring Road Tech corridor.',
    },
  ],
  retrievedAt: new Date().toISOString(),
};

export class ContextService {
  /**
   * Retrieves public cited context for an alert.
   * INVARIANTS:
   * - Query is strictly public corridor/place context (never private names or coordinates).
   * - Query length < 400 characters.
   * - Citations must be valid http(s) links.
   * - Public context failure MUST preserve the numerical alert without modification.
   */
  static async fetchPublicContext(
    alertId: string,
    corridorName: string = 'Bellandur Outer Ring Road Bengaluru'
  ): Promise<ContextResult> {
    const db = getDb();
    const nowIso = new Date().toISOString();

    // Check if context already exists for this alert
    const existing = db
      .prepare('SELECT * FROM citation_contexts WHERE alert_id = ?')
      .get(alertId) as any;

    if (existing) {
      let citations: CitationItem[] = [];
      try {
        citations = JSON.parse(existing.citations_json);
      } catch (e) {
        citations = [];
      }
      return {
        alertId: existing.alert_id,
        status: existing.status as any,
        answer: existing.answer,
        citations,
        retrievedAt: existing.retrieved_at,
      };
    }

    // Construct query < 400 characters, public corridor only
    const query = `What official traffic advisories or road disruptions are reported for ${corridorName}? Cite official public sources. Do not infer individual travel times.`;

    if (query.length > 400) {
      throw new Error(`Public context query exceeded 400 characters (${query.length})`);
    }

    if (config.youCom.isConfigured) {
      try {
        const raw = await YouProvider.answer({
          query,
          freshness: 'week',
        });

        const rawCitations = raw.citations || [];
        const validatedCitations: CitationItem[] = [];

        for (const c of rawCitations) {
          const url = c.source || c.url;
          if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
            validatedCitations.push({
              url,
              source: c.source || url,
              excerpt: Array.isArray(c.excerpts) ? c.excerpts[0] : c.excerpt || '',
            });
          }
        }

        const answerText = typeof raw.answer === 'string' ? raw.answer : 'Public traffic context received.';
        const result: ContextResult = {
          alertId,
          status: 'retrieved',
          answer: answerText,
          citations: validatedCitations,
          retrievedAt: nowIso,
        };

        db.prepare(`
          INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(alertId, 'retrieved', answerText, JSON.stringify(validatedCitations), nowIso);

        return result;
      } catch (err: any) {
        console.warn(`[ContextService] You.com request failed: ${err.message}. Retaining alert with context-unavailable copy.`);
        // Invariant: Failure preserves alert with context-unavailable copy
        const unavailableResult: ContextResult = {
          alertId,
          status: 'unavailable',
          answer: 'Public context unavailable: You.com request failed or timed out. Deterministic alert remains valid.',
          citations: [],
          retrievedAt: nowIso,
        };

        db.prepare(`
          INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(alertId, 'unavailable', unavailableResult.answer, '[]', nowIso);

        return unavailableResult;
      }
    }

    // Unconfigured mode: Use labelled synthetic public context
    const syntheticResult: ContextResult = {
      ...SYNTHETIC_PUBLIC_CONTEXT,
      alertId,
      retrievedAt: nowIso,
    };

    db.prepare(`
      INSERT INTO citation_contexts (alert_id, status, answer, citations_json, retrieved_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(alertId, 'synthetic', syntheticResult.answer, JSON.stringify(syntheticResult.citations), nowIso);

    return syntheticResult;
  }
}
