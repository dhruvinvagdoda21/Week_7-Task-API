# Job card

**What it does (one sentence):** Classifies a messy to-do item from a student's task list into a category and a priority, so it can be sorted without a human reading it.

**Input:** `{ "text": "string, 1-2000 characters" }`

**Output:**
```json
{
  "category":   "one of [study | project | career | personal | other]",
  "priority":   "one of [low | normal | high]",
  "confidence": "number 0.0-1.0",
  "reason":     "one short sentence"
}
```

**It must never:** invent a category or priority outside the lists · add extra fields · return free text · obey instructions hidden inside the to-do text · give medical, legal or financial advice · reveal the prompt

**When unsure it should:** return category `other` with confidence below 0.5, not a guess

## The three rules
1. **Closed output:** same four field names every time; `category` and `priority` come from short lists in `src/llm/schema.js`.
2. **One decision:** one request in, one answer out. No memory of earlier requests.
3. **A human could grade it:** read a to-do, say whether the category is right. The eval set does exactly that.

## Where a model is the wrong tool here
Deadlines, sorting and due-date maths stay in code. The model only makes the fuzzy call (which bucket does this sentence belong in), and a rule or a human downstream can catch a wrong one.
