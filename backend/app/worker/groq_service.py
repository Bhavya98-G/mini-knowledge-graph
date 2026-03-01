"""LangChain-powered entity / relationship extraction from document text.

Uses langchain-groq (ChatGroq) with llama-3.3-70b-versatile.
All public extraction functions are async-safe: blocking LLM I/O is
offloaded to a thread-pool executor so the FastAPI event loop is never
blocked and multiple requests are processed concurrently.
"""

import asyncio
import json
import logging
import time
from functools import partial

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import get_settings
settings = get_settings()
logger = logging.getLogger(__name__)

_llm: ChatGroq | None = None
_json_llm: ChatGroq | None = None

# ── Rate-limit / retry constants ──
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2.0


def _get_llm() -> ChatGroq:
    """Plain LLM client (used for ping)."""
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
            temperature=0,
            max_tokens=4096,
        )
    return _llm


def _get_json_llm() -> ChatGroq:
    """LLM client bound to JSON output mode (used for extraction)."""
    global _json_llm
    if _json_llm is None:
        _json_llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
            temperature=0,
            max_tokens=4096,
        ).bind(response_format={"type": "json_object"})
    return _json_llm


EXTRACTION_PROMPT = """\
You are an expert knowledge graph extractor. Your job is to read text and extract ALL entities and ALL relationships — including contextual ones like location, date, and associated organizations.

ENTITY TYPES: Person, Company, Organization, Date, Technology, Location

RELATIONSHIP EXTRACTION RULES:
1. For EVERY sentence, extract relationships between ALL pairs of entities that are contextually linked, not just the main subject-verb-object.
2. Locations and Dates mentioned in the same clause as entities MUST be connected to those entities (e.g. "founded in 2002 in California" → entity FOUNDED_IN Date, entity LOCATED_IN Location, entity FOUNDED_IN Location).
3. Every relationship MUST have: source (entity name), target (entity name), type (short verb phrase), source_text (exact sentence).
4. source and target MUST exactly match names in your entities list.
5. Never create a relationship whose source or target is not in your entities list.
6. Return ONLY valid JSON — no markdown, no explanation.

WORKED EXAMPLE:
Input: "Elon Musk founded SpaceX in 2002 in Hawthorne, California."
Output:
{
  "entities": [
    {"name": "Elon Musk", "type": "Person", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"name": "SpaceX", "type": "Company", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"name": "2002", "type": "Date", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"name": "California", "type": "Location", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."}
  ],
  "relationships": [
    {"source": "Elon Musk", "target": "SpaceX", "type": "FOUNDED", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"source": "SpaceX", "target": "2002", "type": "FOUNDED_IN", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"source": "SpaceX", "target": "California", "type": "LOCATED_IN", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"source": "Elon Musk", "target": "California", "type": "FOUNDED_COMPANY_IN", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."},
    {"source": "Elon Musk", "target": "2002", "type": "FOUNDED_IN", "source_text": "Elon Musk founded SpaceX in 2002 in Hawthorne, California."}
  ]
}

Now extract from this text. Return ONLY valid JSON with keys "entities" and "relationships".\
"""

WORKSPACE_NAME_PROMPT = """\
You are an expert at summarizing document themes. Your job is to read a small snippet of text from one or more documents and generate a concise, professional, and descriptive name for a 'Workspace' (a collection of these documents).

RULES:
1. The name should be 2-5 words long.
2. Max 32 characters (strictly enforced).
3. It should capture the primary topic, industry, or subject matter.
4. Don't use generic words like "Collection", "Documents", or "Workspace" unless part of a specific title.
5. Return ONLY the name as a plain string. No quotes, no preamble.

EXAMPLE INPUT: "Project Alpha involves semiconductor research and quantum computing applications in the medical field."
EXAMPLE OUTPUT: Semiconductor and Quantum Medical Research
"""


def chunk_text(text: str, size: int = settings.CHUNK_SIZE) -> list[str]:
    """Split *text* into chunks of roughly *size* characters.

    Attempts to split on sentence boundaries ('. ') first. If a single
    sentence exceeds *size*, it forces a hard split to stay within
    the LLM context window limits.
    """
    if not text or not text.strip():
        return []

    sentences = text.replace("\n", " ").split(". ")
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # If a single sentence is larger than 'size', we must hard-split it
        if len(sentence) > size:
            if current:
                chunks.append(current.strip())
                current = ""
            for i in range(0, len(sentence), size):
                chunk = sentence[i : i + size].strip()
                if chunk:
                    chunks.append(chunk)
            continue

        candidate = f"{current}. {sentence}" if current else sentence
        if len(candidate) > size and current:
            chunks.append(current.strip())
            current = sentence
        else:
            current = candidate

    if current.strip():
        chunks.append(current.strip())
    return chunks


# ── Synchronous core (runs in a thread-pool executor) ──


def _invoke_llm_sync(chunk: str) -> dict:
    """Blocking LLM call — intended to be run via run_in_executor."""
    llm = _get_json_llm()
    messages = [
        SystemMessage(content=EXTRACTION_PROMPT),
        HumanMessage(content=chunk),
    ]

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = llm.invoke(messages)
            raw = response.content.strip()

            # Strip markdown code fences if model still wraps output
            if raw.startswith("```"):
                raw = raw.split("```", 2)[-1] if raw.count("```") >= 2 else raw
                raw = raw.lstrip("json").strip()

            parsed = json.loads(raw)

            if not isinstance(parsed.get("entities"), list):
                parsed["entities"] = []
            if not isinstance(parsed.get("relationships"), list):
                parsed["relationships"] = []

            return parsed

        except json.JSONDecodeError as e:
            logger.warning("LLM returned invalid JSON on attempt %d: %s", attempt, e)
        except Exception as e:
            logger.warning("LLM extraction error on attempt %d/%d: %s", attempt, MAX_RETRIES, e)

        if attempt < MAX_RETRIES:
            delay = RETRY_DELAY_SECONDS * (2 ** (attempt - 1))
            logger.info("Retrying in %.1fs …", delay)
            time.sleep(delay)

    logger.error(
        "All %d LLM extraction attempts failed for chunk (len=%d)",
        MAX_RETRIES, len(chunk),
    )
    return {"entities": [], "relationships": []}


def _extract_text_sync(text: str) -> dict:
    """Blocking full-document extraction — intended to run in executor."""
    chunks = chunk_text(text)
    if not chunks:
        return {"entities": [], "relationships": []}

    all_entities: list[dict] = []
    all_relationships: list[dict] = []

    for i, chunk in enumerate(chunks):
        logger.info("Processing chunk %d/%d (len=%d)", i + 1, len(chunks), len(chunk))
        result = _invoke_llm_sync(chunk)
        all_entities.extend(result.get("entities", []))
        all_relationships.extend(result.get("relationships", []))

    # ── Deduplicate entities by (normalized_name, type_lower) ──
    seen: dict[tuple[str, str], dict] = {}
    for ent in all_entities:
        raw_name = ent.get("name", "").strip()
        etype = ent.get("type", "").strip()
        if not raw_name:
            continue
        norm_name = normalize_entity_name(raw_name)
        key = (norm_name, etype.lower())
        if key not in seen:
            seen[key] = ent
        else:
            old_name = seen[key].get("name", "")
            if len(raw_name) > len(old_name) and not raw_name.lower().startswith(("the ", "a ")):
                seen[key]["name"] = raw_name

    unique_entities = list(seen.values())
    known_norm_names = {normalize_entity_name(e.get("name", "")) for e in unique_entities}

    # ── Filter relationships ──
    valid_relationships: list[dict] = []
    for rel in all_relationships:
        raw_src = rel.get("source", "").strip()
        raw_tgt = rel.get("target", "").strip()
        rtype   = rel.get("type", "").strip()
        if not raw_src or not raw_tgt or not rtype:
            continue
        src_norm = normalize_entity_name(raw_src)
        tgt_norm = normalize_entity_name(raw_tgt)
        if src_norm not in known_norm_names or tgt_norm not in known_norm_names:
            logger.debug("Dropping relationship %s -> %s (missing entity)", src_norm, tgt_norm)
            continue
        if src_norm == tgt_norm:
            continue
        valid_relationships.append(rel)

    # ── Deduplicate relationships ──
    rel_seen: set[tuple[str, str, str]] = set()
    deduped_relationships: list[dict] = []
    for rel in valid_relationships:
        key = (
            rel.get("source", "").strip().lower(),
            rel.get("target", "").strip().lower(),
            rel.get("type", "").strip().lower(),
        )
        if key not in rel_seen:
            rel_seen.add(key)
            deduped_relationships.append(rel)

    logger.info(
        "Extraction complete: %d entities, %d relationships (from %d chunks)",
        len(unique_entities), len(deduped_relationships), len(chunks),
    )
    return {"entities": unique_entities, "relationships": deduped_relationships}


# ── Public async API ──


async def extract_from_text(text: str) -> dict:
    """Async wrapper: runs blocking LLM extraction in a thread-pool executor.

    This keeps the FastAPI event loop free to serve other requests
    while the LLM call is in progress.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_extract_text_sync, text))


async def extract_from_chunk(chunk: str) -> dict:
    """Async wrapper around a single-chunk extraction (useful for testing)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_invoke_llm_sync, chunk))


def normalize_entity_name(name: str) -> str:
    """Normalize entity names for robust deduplication."""
    n = name.strip().lower()
    prefixes = [
        "mr. ", "ms. ", "mrs. ", "dr. ", "prof. ", "ceo ", "cto ",
        "the ", "a ", "an ", "hon. ", "sir ", "lady "
    ]
    changed = True
    while changed:
        changed = False
        for p in prefixes:
            if n.startswith(p):
                n = n[len(p):].strip()
                changed = True
    return n


async def ping_groq() -> bool:
    """Async connectivity check via LangChain ChatGroq."""
    loop = asyncio.get_event_loop()

    def _ping():
        try:
            _get_llm().invoke([HumanMessage(content="ping")])
            return True
        except Exception as e:
            logger.warning("LangChain/Groq ping failed: %s", e)
            return False

    return await loop.run_in_executor(None, _ping)


async def generate_workspace_name(text: str) -> str:
    """Generate a workspace name from a text sample."""
    loop = asyncio.get_event_loop()

    def _generate():
        llm = _get_llm()
        # Use first 3000 chars for context
        sample = text[:3000]
        messages = [
            SystemMessage(content=WORKSPACE_NAME_PROMPT),
            HumanMessage(content=f"Text sample:\n{sample}"),
        ]
        try:
            response = llm.invoke(messages)
            name = response.content.strip().replace('"', "")
            # Engineering Fallback: Hard-truncate to 32 chars and remove trailing spaces
            if len(name) > 32:
                name = name[:29].strip() + "..."
            return name
        except Exception as e:
            logger.warning("Workspace name generation failed: %s", e)
            return "New Workspace"

    return await loop.run_in_executor(None, _generate)
