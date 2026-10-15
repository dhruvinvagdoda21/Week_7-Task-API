const express = require('express');
const { inputSchema } = require('../llm/schema');
const { triage } = require('../llm/triage');
const { LlmError } = require('../llm/call');

const router = express.Router();

// POST /tasks/triage  { "text": "..." }  ->  { category, priority, confidence, reason }
router.post('/', async (req, res) => {
  // 1. Validate input first: a rejected request is a model call we did not pay for.
  const parsed = inputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: 'invalid input', field: issue.path.join('.') || 'text', message: issue.message });
  }
  try {
    const { data, source } = await triage(parsed.data.text);
    res.set('X-Triage-Source', source); // model | stub | fallback
    res.json(data); // only schema-validated data ever leaves this endpoint, never raw model text
  } catch (err) {
    if (err instanceof LlmError) return res.status(err.httpStatus).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
