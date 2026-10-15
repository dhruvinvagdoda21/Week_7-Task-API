const fs = require('fs');
const path = require('path');
const getConfig = require('./config');
const { callModel, LlmError } = require('./call');
const { parseAndValidate } = require('./parse');
const { quarantine } = require('./log');

const promptCache = {};
function loadPrompt(version) {
  if (!promptCache[version]) {
    promptCache[version] = fs.readFileSync(path.join(__dirname, '..', '..', 'prompts', `triage-${version}.md`), 'utf8');
  }
  return promptCache[version];
}

// Safe, deterministic answers for kill-switch and stub mode. Both satisfy the output schema.
const FALLBACK = { category: 'other', priority: 'normal', confidence: 0, reason: 'AI triage is switched off, so this item was left uncategorised.' };
const STUB = { category: 'study', priority: 'normal', confidence: 0.9, reason: 'Stub answer (LLM_STUB=1), no model was called.' };

async function triage(text) {
  const cfg = getConfig();
  if (!cfg.enabled) return { data: FALLBACK, source: 'fallback' }; // kill switch: zero model calls
  if (cfg.stub) return { data: STUB, source: 'stub' };

  const system = loadPrompt(cfg.promptVersion);
  // Untrusted text goes in the USER message, JSON-encoded so it cannot break out of its quotes.
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ text }) },
  ];

  const first = await callModel(messages);
  const r1 = parseAndValidate(first);
  if (r1.ok) return { data: r1.data, source: 'model', repaired: false };

  // Repair once: hand the model its own broken answer and the exact error.
  const repairMessages = [
    ...messages,
    { role: 'assistant', content: String(first).slice(0, 2000) },
    { role: 'user', content: `Your previous answer was rejected for this reason: ${r1.error}. Return only corrected JSON matching the schema.` },
  ];
  const second = await callModel(repairMessages, { repair: true });
  const r2 = parseAndValidate(second);
  if (r2.ok) return { data: r2.data, source: 'model', repaired: true };

  quarantine({ input: text, first_output: first, raw_output: second, error: r2.error, prompt_version: cfg.promptVersion, model: cfg.model });
  throw new LlmError(422, 'The model did not return a valid answer, even after one repair attempt.', 'invalid_output');
}

module.exports = { triage };
