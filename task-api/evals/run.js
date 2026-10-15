// Runs every case in evals/cases.json through the live endpoint and reports how many matched.
// Needs the server running in another terminal (npm start) with a REAL provider configured (LLM_STUB must be unset).
// Budget: 8 calls per run (OpenRouter free tier = 50/day, failed requests count).
const fs = require('fs');
const path = require('path');

const BASE = process.env.EVAL_BASE_URL || 'http://localhost:3000';
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let hit = 0;
  const failed = [];
  const rows = [];
  let lowOk = 0, lowTotal = 0;
  for (const c of cases) {
    let got = null, status = null, source = null;
    try {
      const r = await fetch(`${BASE}/tasks/triage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: c.text }) });
      status = r.status; source = r.headers.get('x-triage-source'); got = await r.json();
    } catch (e) { got = { error: e.message }; }
    const right = status === 200 && got.category === c.expected_category;
    if (right) hit++; else failed.push({ id: c.id, expected: c.expected_category, got: got.category ?? got.error, status });
    if (c.expect_low_confidence) { lowTotal++; if (status === 200 && got.confidence < 0.5) lowOk++; }
    rows.push({ id: c.id, status, source, expected: c.expected_category, got: got.category ?? null, confidence: got.confidence ?? null });
    await sleep(Number(process.env.EVAL_DELAY_MS || 500));
  }
  const pct = Math.round((hit / cases.length) * 100);
  const out = { date: new Date().toISOString().slice(0, 10), prompt_version: process.env.PROMPT_VERSION || 'v1', model: process.env.LLM_MODEL || '(unknown)', category_correct: `${hit}/${cases.length}`, percent: pct, low_confidence_rule: `${lowOk}/${lowTotal}`, failed, rows };
  console.table(rows);
  console.log(`\nCategory match: ${hit}/${cases.length} (${pct}%)   When-unsure rule (confidence < 0.5): ${lowOk}/${lowTotal}`);
  console.log(failed.length ? 'Failed cases:\n' + failed.map((f) => `  #${f.id} expected ${f.expected}, got ${f.got} (HTTP ${f.status})`).join('\n') : 'No failures.');
  if (rows.some((r) => r.source === 'stub' || r.source === 'fallback')) console.log('\nWARNING: some answers came from stub/fallback, not a model. Unset LLM_STUB and set LLM_ENABLED=true, then rerun.');
  fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify(out, null, 2));
  console.log('\nSaved evals/last-run.json. Copy the date, prompt version, model and score into the README.');
})();
