"""Intent classifier tool — deterministic routing signal for the orchestrator."""

import re

from google.adk.tools import FunctionTool

SWE_KEYWORDS = [
    "build", "create", "implement", "code", "develop", "architect",
    "design system", "api design", "write code", "generate code",
    "scaffold", "refactor", "debug", "fix bug", "deploy",
    "test plan", "user story", "user stories", "spec", "specification",
    "schema", "database design", "endpoint", "microservice",
    "class diagram", "sequence diagram", "technical design",
    "pull request", "pr", "commit", "function", "method",
    "component", "module", "package", "library",
]

SWE_PATTERNS = [
    re.compile(r"\b(build|create|implement|write|generate|scaffold)\b.*\b(app|api|service|system|component|module|function|class)\b", re.IGNORECASE),
    re.compile(r"\b(design|architect)\b.*\b(system|architecture|solution|service)\b", re.IGNORECASE),
    re.compile(r"\b(how (would|should|can) (I|we|you))\b.*\b(build|implement|code|create)\b", re.IGNORECASE),
    re.compile(r"\b(write|generate)\b.*\b(code|test|spec)\b", re.IGNORECASE),
]

RAG_KEYWORDS = [
    "what does", "what is", "explain", "summarize", "summary",
    "find", "search", "look up", "tell me about", "describe",
    "compare", "contrast", "difference between", "list",
    "according to", "based on", "in the document", "in the file",
    "quote", "excerpt", "passage", "page", "section",
    "how many", "when did", "who", "where", "why",
]

GREETING_PATTERNS = [
    re.compile(r"^\s*(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening))\b", re.IGNORECASE),
    re.compile(r"^\s*(thanks?|thank\s+you|cheers)\s*[!.\s]*$", re.IGNORECASE),
    re.compile(r"^\s*(what can you do|help|how do you work)\s*[?\s]*$", re.IGNORECASE),
]


def classify_intent(message: str) -> dict:
    """Classify the user's message intent to help route to the right agent team.

    Args:
        message: The user's raw message text.

    Returns:
        A dict with:
          - intent: one of 'swe_request', 'rag_query', 'greeting', 'ambiguous'
          - confidence: float 0-1
          - signals: list of matched keywords/patterns that informed the decision
    """
    lower = message.lower().strip()
    signals: list[str] = []

    for pattern in GREETING_PATTERNS:
        if pattern.search(lower):
            return {
                "intent": "greeting",
                "confidence": 0.95,
                "signals": ["greeting_pattern"],
            }

    swe_score = 0
    for kw in SWE_KEYWORDS:
        if kw in lower:
            swe_score += 1
            signals.append(f"swe_kw:{kw}")

    for pattern in SWE_PATTERNS:
        if pattern.search(lower):
            swe_score += 3
            signals.append("swe_pattern")

    rag_score = 0
    for kw in RAG_KEYWORDS:
        if kw in lower:
            rag_score += 1
            signals.append(f"rag_kw:{kw}")

    if message.endswith("?") and swe_score == 0:
        rag_score += 1
        signals.append("question_mark")

    total = swe_score + rag_score
    if total == 0:
        return {
            "intent": "rag_query",
            "confidence": 0.5,
            "signals": ["default_to_rag"],
        }

    if swe_score > rag_score and swe_score >= 2:
        return {
            "intent": "swe_request",
            "confidence": min(0.95, 0.6 + swe_score * 0.1),
            "signals": signals,
        }

    if rag_score > swe_score:
        return {
            "intent": "rag_query",
            "confidence": min(0.95, 0.6 + rag_score * 0.1),
            "signals": signals,
        }

    return {
        "intent": "ambiguous",
        "confidence": 0.4,
        "signals": signals,
    }


classify_intent_tool = FunctionTool(func=classify_intent)
