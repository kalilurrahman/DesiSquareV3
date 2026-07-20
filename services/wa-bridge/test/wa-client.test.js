import { test } from 'node:test';
import assert from 'node:assert';
import { createWaClient, MockWaClient } from '../src/wa-client.js';
import { normalizeWaMessage } from '../src/wa-client-live.js';

test('createWaClient defaults to the mock backend (no whatsapp-web.js required)', async () => {
  const wa = await createWaClient({ wa: { backend: 'mock' } });
  assert.ok(wa instanceof MockWaClient);
  assert.strictEqual(wa.getState().backend, 'mock');
});

test('createWaClient with an unset wa config still returns the mock', async () => {
  const wa = await createWaClient({});
  assert.ok(wa instanceof MockWaClient);
});

test('normalizeWaMessage maps a group message and strips the JID suffix', () => {
  const n = normalizeWaMessage({
    id: { _serialized: 'ABC123' }, from: '120363000000@g.us',
    author: '919876543210@c.us', body: 'What are current FCNR rates?',
  });
  assert.strictEqual(n.id, 'ABC123');
  assert.strictEqual(n.groupJid, '120363000000@g.us');
  assert.strictEqual(n.phone, '919876543210'); // suffix stripped; bridge hashes it in logs
  assert.strictEqual(n.text, 'What are current FCNR rates?');
  assert.strictEqual(n.isGroup, true);
});

test('normalizeWaMessage flags direct (non-group) messages and falls back to `from`', () => {
  const n = normalizeWaMessage({ id: { _serialized: 'X' }, from: '15551234567@c.us', body: 'hi' });
  assert.strictEqual(n.isGroup, false);
  assert.strictEqual(n.phone, '15551234567');
});

test('normalizeWaMessage tolerates missing fields', () => {
  const n = normalizeWaMessage({});
  assert.strictEqual(n.id, null);
  assert.strictEqual(n.text, '');
  assert.strictEqual(n.isGroup, false);
});
