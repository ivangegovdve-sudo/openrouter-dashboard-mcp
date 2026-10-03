// Read-only regional collector. Bind behind an HTTPS proxy; no inference route exists.
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { timingSafeEqual } from 'node:crypto';
import { readPublicCatalogue, PROVIDER_IDS } from '../build/public-catalogue.js';
const location = process.env.OPEN_DASHBOARD_LOCATION;
const token = process.env.OPEN_DASHBOARD_COLLECTOR_TOKEN;
if (!['bulgaria-desktop','kvm2-europe','oracle-us'].includes(location) || !token) throw new Error('LOCATION_AND_TOKEN_REQUIRED');
let active = 0;
createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json');
  const incoming = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) { response.writeHead(401); response.end('{"error":"UNAUTHORIZED"}'); return; }
  const url = new URL(request.url, 'http://localhost');
  const provider = url.searchParams.get('provider');
  if (request.method !== 'GET' || url.pathname !== '/catalogue' || !PROVIDER_IDS.includes(provider) || [...url.searchParams.keys()].some(k => k !== 'provider')) {
    response.writeHead(400); response.end('{"error":"INVALID_QUERY"}'); return;
  }
  if (active >= 2) { response.writeHead(429); response.end('{"error":"BUSY"}'); return; }
  active++;
  try { response.end(JSON.stringify({ ...await readPublicCatalogue([provider]), location, hostname: hostname(), availabilityBasis: 'catalogue_listing_only' })); }
  catch { response.writeHead(503); response.end('{"error":"SOURCE_UNAVAILABLE"}'); }
  finally { active--; }
}).listen(Number(process.env.PORT || 8789), process.env.OPEN_DASHBOARD_BIND || '127.0.0.1');
