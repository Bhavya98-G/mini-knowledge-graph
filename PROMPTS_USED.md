# Prompts Used

These are the LLM prompts embedded in the application backend.

---

## 1. Entity & Relationship Extraction
**File:** `backend/app/worker/groq_service.py → EXTRACTION_PROMPT`

```
You are an expert knowledge graph extractor. Extract ALL entities and ALL relationships — including contextual ones like location, date, and associated organizations.

ENTITY TYPES: Person, Company, Organization, Date, Technology, Location

RULES:
1. For EVERY sentence, extract relationships between ALL contextually linked entity pairs.
2. Locations and Dates in the same clause MUST be connected to related entities.
3. Every relationship MUST have: source, target, type (short verb phrase), source_text (exact sentence).
4. source and target MUST exactly match names in your entities list.
5. Never create a relationship whose source or target is not in your entities list.
6. Return ONLY valid JSON — no markdown, no explanation.
```

---

## 2. Workspace Auto-Naming
**File:** `backend/app/worker/groq_service.py → WORKSPACE_NAME_PROMPT`

```
You are an expert at summarizing document themes. Generate a concise, professional name for a Workspace (a collection of documents).

RULES:
1. 2–5 words, max 32 characters.
2. Capture the primary topic, industry, or subject matter.
3. Return ONLY the name as a plain string. No quotes, no preamble.
```
