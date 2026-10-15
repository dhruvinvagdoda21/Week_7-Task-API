const fs = require('fs');
const path = require('path');

// One structured JSON line per model call, on stdout (twelve-factor: let the environment route logs).
const logCall = (fields) => console.log(JSON.stringify({ event: 'llm_call', ts: new Date().toISOString(), ...fields }));

// Bad model answers are set aside with the reason, never returned to the caller.
function quarantine(entry) {
  const file = process.env.QUARANTINE_FILE || path.join(__dirname, '..', '..', 'logs', 'quarantine.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

module.exports = { logCall, quarantine };
