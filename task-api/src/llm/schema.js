const { z } = require('zod');

// Closed lists: anything outside these is a validation failure, never a new category.
const CATEGORIES = ['study', 'project', 'career', 'personal', 'other'];
const PRIORITIES = ['low', 'normal', 'high'];

const inputSchema = z.object({
  text: z.string({ error: 'text must be a string' }).trim().min(1, 'text must not be empty').max(2000, 'text must be 2000 characters or fewer'),
});

const outputSchema = z
  .object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(200),
  })
  .strict(); // extra fields are a failure too

// Turn a Zod error into one readable line naming the field(s).
const describe = (err) => err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

module.exports = { CATEGORIES, PRIORITIES, inputSchema, outputSchema, describe };
