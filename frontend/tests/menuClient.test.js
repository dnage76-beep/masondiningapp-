import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, fetchMenusWithRetry } from '../src/menuClient.js';

test('moves across month and year boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('retries a failed request and returns the first success', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    assert.equal(url, '/api/menus?date=2026-10-14');
    if (calls < 3) throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => ({ date: '2026-10-14' }) };
  };
  const data = await fetchMenusWithRetry('', '2026-10-14', { fetchImpl, backoffMs: 1 });
  assert.deepEqual(data, { date: '2026-10-14' });
  assert.equal(calls, 3);
});

test('gives a readable error after every attempt fails', async () => {
  const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(
    fetchMenusWithRetry('', '2026-10-14', { fetchImpl, backoffMs: 1 }),
    /Check your Wi-Fi/,
  );
});
