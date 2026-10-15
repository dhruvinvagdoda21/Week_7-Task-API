// Run with: npm test   (no API key, no quota: uses the mock model in test/mock-llm.js)
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startMock } = require('./mock-llm');
const app = require('../server');

const QFILE = path.join(os.tmpdir(), `quarantine-${process.pid}.jsonl`);
const results = [];

async function main() {
  const mock = await startMock();
  const api = app.listen(0);
  const base = `http://127.0.0.1:${api.address().port}`;
  Object.assign(process.env, {
    LLM_BASE_URL: `http://127.0.0.1:${mock.port}/v1`, LLM_API_KEY: 'test', LLM_MODEL: 'mock',
    LLM_RETRY_BASE_MS: '10', LLM_TIMEOUT_MS: '30000', QUARANTINE_FILE: QFILE,
  });
  delete process.env.LLM_STUB;
  delete process.env.LLM_ENABLED;

  const post = async (body, raw) => {
    const r = await fetch(`${base}/tasks/triage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ?? JSON.stringify(body) });
    return { status: r.status, body: await r.json(), source: r.headers.get('x-triage-source') };
  };
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => { try { const j = JSON.parse(a[0]); if (j.event === 'llm_call') return logs.push(j); } catch (e) {} origLog(...a); };

  async function t(name, fn) {
    mock.state.calls = 0; mock.state.bodies = []; logs.length = 0;
    try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name + '\n      ' + e.message.split('\n')[0]]); }
  }
  const setMode = (m) => (mock.state.mode = m);
  const quarantineLines = () => (fs.existsSync(QFILE) ? fs.readFileSync(QFILE, 'utf8').trim().split('\n').filter(Boolean).length : 0);

  await t('input validation: missing text -> 400 naming the field, zero model calls', async () => {
    const r = await post({}); assert.equal(r.status, 400); assert.equal(r.body.field, 'text'); assert.equal(mock.state.calls, 0);
  });
  await t('input validation: wrong type and too long -> 400, zero model calls', async () => {
    assert.equal((await post({ text: 42 })).status, 400);
    const long = await post({ text: 'x'.repeat(2001) }); assert.equal(long.status, 400); assert.equal(long.body.field, 'text');
    assert.equal(mock.state.calls, 0);
  });
  await t('broken JSON body -> 400, zero model calls', async () => {
    const r = await post(null, '{bad'); assert.equal(r.status, 400); assert.equal(mock.state.calls, 0);
  });
  await t('stub mode: LLM_STUB=1 -> 200 schema-valid, zero model calls', async () => {
    process.env.LLM_STUB = '1';
    const r = await post({ text: 'Buy milk' }); delete process.env.LLM_STUB;
    assert.equal(r.status, 200); assert.equal(r.source, 'stub'); assert.equal(mock.state.calls, 0);
  });
  await t('happy path: valid answer, system+user roles, text JSON-encoded in the user message', async () => {
    setMode('good');
    const r = await post({ text: 'Finish notes' }); assert.equal(r.status, 200); assert.equal(r.body.category, 'study');
    const m = mock.state.bodies[0].messages;
    assert.equal(m[0].role, 'system'); assert.equal(m[1].role, 'user'); assert.deepEqual(JSON.parse(m[1].content), { text: 'Finish notes' });
    assert.ok(!m[0].content.includes('Finish notes'), 'user text must not be in the system prompt');
    assert.equal(mock.state.bodies[0].temperature, 0);
  });
  await t('fenced JSON with chatter is parsed', async () => {
    setMode('fenced'); const r = await post({ text: 'x' }); assert.equal(r.status, 200); assert.equal(mock.state.calls, 1);
  });
  await t('cost log: tokens, model, prompt version, duration, repair flag', async () => {
    setMode('good'); await post({ text: 'x' });
    const l = logs[0]; assert.equal(l.input_tokens, 120); assert.equal(l.output_tokens, 30); assert.equal(l.model, 'mock');
    assert.equal(l.prompt_version, 'v1'); assert.equal(typeof l.duration_ms, 'number'); assert.equal(l.repair, false);
  });
  await t('invalid enum -> exactly one repair, then 200; repair message carries the error', async () => {
    setMode('bad_then_good'); const r = await post({ text: 'x' });
    assert.equal(r.status, 200); assert.equal(mock.state.calls, 2); assert.equal(logs[1].repair, true);
    const last = mock.state.bodies[1].messages.at(-1).content; assert.match(last, /category/); assert.match(last, /rejected/);
  });
  await t('repair fails -> 422 readable message, quarantine line written, no raw model text returned', async () => {
    setMode('always_bad'); const before = quarantineLines(); const r = await post({ text: 'x' });
    assert.equal(r.status, 422); assert.equal(mock.state.calls, 2); assert.equal(quarantineLines(), before + 1);
    assert.ok(!JSON.stringify(r.body).includes('hobby'));
  });
  await t('extra field in model output -> rejected (strict schema) -> 422', async () => {
    setMode('extra_field'); assert.equal((await post({ text: 'x' })).status, 422);
  });
  await t('model returns prose, not JSON -> 422, process still alive', async () => {
    setMode('not_json'); assert.equal((await post({ text: 'x' })).status, 422); setMode('good'); assert.equal((await post({ text: 'x' })).status, 200);
  });
  await t('timeout -> 504; retried (timeouts are retriable) up to the attempt limit', async () => {
    process.env.LLM_TIMEOUT_MS = '300'; setMode('slow'); const r = await post({ text: 'x' }); process.env.LLM_TIMEOUT_MS = '30000';
    assert.equal(r.status, 504); assert.equal(mock.state.calls, 3);
  });
  await t('429 with Retry-After: retried, then succeeds', async () => {
    setMode('rate_limit_then_good'); const r = await post({ text: 'x' }); assert.equal(r.status, 200); assert.equal(mock.state.calls, 3);
  });
  await t('5xx forever -> 3 attempts then 502', async () => {
    setMode('always_500'); const r = await post({ text: 'x' }); assert.equal(r.status, 502); assert.equal(mock.state.calls, 3);
  });
  await t('401 -> NEVER retried (exactly 1 call), clear 502', async () => {
    setMode('unauthorized'); const r = await post({ text: 'x' });
    assert.equal(r.status, 502); assert.equal(mock.state.calls, 1); assert.match(r.body.error, /credentials/);
  });
  await t('kill switch: LLM_ENABLED=false -> instant deterministic fallback, zero model calls', async () => {
    process.env.LLM_ENABLED = 'false'; setMode('good'); const r = await post({ text: 'x' }); delete process.env.LLM_ENABLED;
    assert.equal(r.status, 200); assert.equal(r.source, 'fallback'); assert.equal(r.body.category, 'other'); assert.equal(r.body.confidence, 0);
    assert.equal(mock.state.calls, 0); assert.equal(logs.length, 0);
  });
  await t('existing CRUD still works (GET /tasks, GET /tasks/triage -> 404)', async () => {
    assert.equal((await fetch(`${base}/tasks`)).status, 200); assert.equal((await fetch(`${base}/tasks/triage`)).status, 404);
  });

  console.log = origLog;
  api.close(); mock.server.close();
  const failed = results.filter((r) => !r[0]);
  results.forEach(([ok, name]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
