const { outputSchema, describe } = require('./schema');

// Models wrap JSON in ```json fences or add "Sure! Here's the JSON:". Strip that, find the object, parse it.
function extractJson(text) {
  const raw = String(text ?? '');
  const noFence = raw.replace(/```(?:json)?/gi, '');
  const start = noFence.indexOf('{');
  const end = noFence.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'no JSON object found in the answer' };
  try {
    return { ok: true, value: JSON.parse(noFence.slice(start, end + 1)) };
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${e.message}` };
  }
}

// Parse, then validate against the schema. Returns { ok, data } or { ok:false, error }.
function parseAndValidate(text) {
  const j = extractJson(text);
  if (!j.ok) return j;
  const r = outputSchema.safeParse(j.value);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: describe(r.error) };
}

module.exports = { extractJson, parseAndValidate };
