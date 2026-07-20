// HTTP layer (node:http, zero deps). Route map:
//   GET  /health                      status + counts + price coverage
//   POST /webhook/discourse           post-created events → stamp Signal (HMAC, idempotent)
//   POST /discourse/webhook           alias, sibling-service convention
//   POST /models                      create a model
//   GET  /models/:id                  model + its immutable entry ledger
//   GET  /models/:id/metrics          { cagr, vsBenchmark, maxDrawdown, since, series[], periods{overall,yearly[],monthly[]} }
//   POST /models/:id/entries          declare entry/exit (immutable; dup = no-op; edit = 409)
//   GET  /models/:id/entries          read the ledger
//   GET  /users/:id/models            models owned by a user (+ card metrics)
//   GET  /users/:id/signals           signal record rows incl. sincePct
//   POST /jobs/reprice                reload EOD bars + recompute all model metrics
import http from 'node:http';
import { createModel, declareEntry, signalRows } from './ledger.js';
import { computeMetrics, metricsSummary } from './metrics.js';
import { verifySignature, handleEvent } from './webhook.js';

// Persistent product rule: every performance surface carries the disclaimer.
export const DISCLAIMER = 'Not investment advice. Performance is computed by DesiSquare from declared, timestamped entries — past performance does not guarantee future returns.';

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj, null, 2));
}

export function repriceAll({ store, prices, config }) {
  const book = prices.book;
  return {
    status: 'repriced',
    mode: config.pricesMode,
    benchmark: config.benchmark,
    instruments: book.instruments().length,
    bars: book.barCount(),
    lastBar: book.lastDate(),
    models: store.allModels().map((m) => metricsSummary(m, store.entriesFor(m.id), book, config.benchmark)),
  };
}

export function createApp({ config, store, prices }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const book = () => prices.book;
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

      // Immutability at the HTTP layer: entries and signal stamps have NO
      // update/delete surface — any attempt to modify them is rejected with 409.
      if (['PUT', 'PATCH', 'DELETE'].includes(req.method)
        && ((parts[0] === 'models' && parts[2] === 'entries') || parts[0] === 'signals' || (parts[0] === 'users' && parts[2] === 'signals'))) {
        return json(res, 409, { status: 'immutable', error: 'model entries and signal stamps are immutable — corrections are new entries' });
      }
      if (req.method === 'POST' && parts[0] === 'models' && parts[2] === 'entries' && parts[3]) {
        return json(res, 409, { status: 'immutable', error: `entry ${parts[3]} is immutable — declare a new entry to correct` });
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, {
          ok: true,
          service: 'models-service',
          mode: config.pricesMode,
          benchmark: config.benchmark,
          ...store.counts(),
          instruments: book().instruments().length,
          firstBar: book().firstDate(),
          lastBar: book().lastDate(),
        });
      }
      if (req.method === 'GET' && url.pathname === '/') {
        return json(res, 200, {
          service: 'models-service',
          mode: config.pricesMode,
          endpoints: ['/health', 'POST /webhook/discourse', 'POST /models', 'GET /models/:id', 'GET /models/:id/metrics', 'POST /models/:id/entries', 'GET /users/:id/models', 'GET /users/:id/signals', 'POST /jobs/reprice'],
          disclaimer: DISCLAIMER,
        });
      }

      // Inbound Discourse webhook (spec path + sibling-convention alias).
      if (req.method === 'POST' && (url.pathname === '/webhook/discourse' || url.pathname === '/discourse/webhook')) {
        const raw = await readBody(req);
        if (!verifySignature(raw, req.headers['x-discourse-event-signature'], config.webhookSecret)) {
          return json(res, 401, { error: 'bad signature' });
        }
        const r = handleEvent(req.headers, JSON.parse(raw || '{}'), { store, book: book() });
        const { code = 200, ...body } = r;
        return json(res, code, body);
      }

      if (req.method === 'POST' && url.pathname === '/models') {
        const r = createModel(store, JSON.parse((await readBody(req)) || '{}'));
        const { code, ...body } = r;
        return json(res, code, body);
      }
      if (req.method === 'GET' && parts[0] === 'models' && parts[1] && !parts[2]) {
        const model = store.getModel(parts[1]);
        if (!model) return json(res, 404, { error: `model ${parts[1]} not found` });
        const entries = store.entriesFor(model.id);
        return json(res, 200, { ...model, entryCount: entries.length, entries, disclaimer: DISCLAIMER });
      }
      if (req.method === 'GET' && parts[0] === 'models' && parts[1] && parts[2] === 'metrics') {
        const model = store.getModel(parts[1]);
        if (!model) return json(res, 404, { error: `model ${parts[1]} not found` });
        const metrics = computeMetrics(model, store.entriesFor(model.id), book(), config.benchmark);
        return json(res, 200, { ...metrics, name: model.name, disclaimer: DISCLAIMER });
      }
      if (req.method === 'POST' && parts[0] === 'models' && parts[1] && parts[2] === 'entries' && !parts[3]) {
        const r = declareEntry(store, book(), parts[1], JSON.parse((await readBody(req)) || '{}'));
        const { code, ...body } = r;
        return json(res, code, body);
      }
      if (req.method === 'GET' && parts[0] === 'models' && parts[1] && parts[2] === 'entries') {
        const model = store.getModel(parts[1]);
        if (!model) return json(res, 404, { error: `model ${parts[1]} not found` });
        const entries = store.entriesFor(model.id);
        return json(res, 200, { modelId: model.id, count: entries.length, entries });
      }

      if (req.method === 'GET' && parts[0] === 'users' && parts[1] && parts[2] === 'models') {
        const models = store.modelsByOwner(parts[1]).map((m) => ({
          ...m,
          entryCount: store.entriesFor(m.id).length,
          metrics: metricsSummary(m, store.entriesFor(m.id), book(), config.benchmark),
        }));
        return json(res, 200, { userId: parts[1], count: models.length, models, disclaimer: DISCLAIMER });
      }
      if (req.method === 'GET' && parts[0] === 'users' && parts[1] && parts[2] === 'signals') {
        const signals = signalRows(store, book(), parts[1]);
        return json(res, 200, { userId: parts[1], count: signals.length, signals, disclaimer: DISCLAIMER });
      }

      // Daily batch: re-ingest EOD bars, recompute every model (also on the env timer).
      if (req.method === 'POST' && url.pathname === '/jobs/reprice') {
        await prices.reload();
        return json(res, 200, repriceAll({ store, prices, config }));
      }

      return json(res, 404, { error: 'not found', path: url.pathname });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  });
}
