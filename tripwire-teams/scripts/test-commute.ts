import 'dotenv/config';
import { GoogleRoutesProvider } from '../src/features/commute/googleRoutes.js';

async function main() {
  console.log('=== Tripwire Teams - Routes API Commute Verification ===');

  // Verify environment
  const apiKey =
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn(
      '⚠️  [Notice] GOOGLE_ROUTES_API_KEY is not set in environment or .env file.\n' +
      '   To perform live network queries against Google Routes API, set GOOGLE_ROUTES_API_KEY.\n' +
      '   The provider will handle this gracefully and return status: "unknown".\n'
    );
  }

  // Real Bengaluru Tech Hubs: Indiranagar to Google Anantha Bellandur
  const originName = 'Indiranagar (100 Feet Rd), Bengaluru';
  const destinationName = 'Google Anantha, Bellandur, Bengaluru';

  const origin = { lat: 12.9784, lon: 77.6408 };
  const destination = { lat: 12.926, lon: 77.6762 };

  // Parse mode from CLI args if provided (default: DRIVE)
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'DRIVE';

  // Target arrival: next day 9:30 AM (or +2 hours from now)
  const arriveBy = new Date();
  arriveBy.setHours(arriveBy.getHours() + 2);
  arriveBy.setMinutes(30);
  arriveBy.setSeconds(0);
  arriveBy.setMilliseconds(0);

  console.log(`Route: ${originName} -> ${destinationName}`);
  console.log(`Requested Mode: ${modeArg}`);
  console.log(`Target Arrive By: ${arriveBy.toLocaleString()}`);
  console.log('Querying commute with two-step departure calculation...\n');

  const provider = new GoogleRoutesProvider();
  const startTime = Date.now();
  const result = await provider.getCommute(origin, destination, modeArg, arriveBy);
  const elapsedMs = Date.now() - startTime;

  console.log('=== Commute Result ===');
  console.log(`Status:             ${result.status}`);
  console.log(`Mode Used:          ${result.modeUsed}`);

  if (result.status === 'ok') {
    const durMin = Math.round(result.durationSeconds / 60);
    const baseMin = result.baselineSeconds ? Math.round(result.baselineSeconds / 60) : null;
    console.log(`Duration:           ${result.durationSeconds}s (~${durMin} mins)`);
    console.log(`Baseline (Static):  ${result.baselineSeconds ? `${result.baselineSeconds}s (~${baseMin} mins)` : 'N/A'}`);
  } else {
    console.log(`Duration:           ${result.durationSeconds}s (Unknown reading)`);
    console.log(`Baseline:           ${result.baselineSeconds ?? 'null'}`);
  }

  console.log(`Provider Timestamp: ${result.providerTimestamp.toISOString()}`);
  console.log(`Query Elapsed Time: ${elapsedMs}ms`);
  console.log('======================');
}

main().catch((err) => {
  console.error('Fatal CLI execution error:', err);
  process.exit(1);
});
