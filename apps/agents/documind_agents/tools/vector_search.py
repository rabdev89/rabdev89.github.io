"""Vector search tool — queries Vertex AI Vector Search for relevant chunks."""

import json

from google.adk.tools import FunctionTool
from google.cloud import aiplatform
from vertexai.language_models import TextEmbeddingModel

from documind_agents.config import settings
from documind_agents.db import fetch_all

_embedding_model: TextEmbeddingModel | None = None


def _get_embedding_model() -> TextEmbeddingModel:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = TextEmbeddingModel.from_pretrained(settings.embedding_model)
    return _embedding_model


async def vector_search(query: str, workspace_id: str, k: int = 5) -> list[dict]:
    """Search the vector index for document chunks relevant to the query.

    Args:
        query: The natural language search query.
        workspace_id: Workspace ID to scope the search to.
        k: Number of top results to return (default 5).

    Returns:
        List of matching chunks with chunk_id, text, page, section, and score.
    """
    model = _get_embedding_model()
    embeddings = model.get_embeddings(
        [query],
        output_dimensionality=settings.embedding_dimensions,
    )
    query_vector = embeddings[0].values

    if not settings.vertex_vector_search_index_endpoint:
        return await _fallback_text_search(query, workspace_id, k)

    index_endpoint = aiplatform.MatchingEngineIndexEndpoint(
        index_endpoint_name=settings.vertex_vector_search_index_endpoint,
    )

    response = index_endpoint.find_neighbors(
        deployed_index_id=settings.vertex_vector_search_deployed_index_id,
        queries=[query_vector],
        num_neighbors=k,
        filter=[
            aiplatform.matching_engine.matching_engine_index_endpoint.Namespace(
                name="workspace_id",
                allow_tokens=[workspace_id],
            )
        ],
    )

    if not response or not response[0]:
        return []

    vector_ids = [match.id for match in response[0]]
    scores = {match.id: match.distance for match in response[0]}

    if not vector_ids:
        return []

    placeholders = ", ".join(f"${i+1}" for i in range(len(vector_ids)))
    chunks = await fetch_all(
        f"""SELECT id, text, page, section, vector_id
            FROM chunks
            WHERE vector_id IN ({placeholders}) AND workspace_id = ${len(vector_ids)+1}
            ORDER BY ordinal""",
        *vector_ids,
        workspace_id,
    )

    return [
        {
            "chunk_id": c["id"],
            "text": c["text"],
            "page": c["page"],
            "section": c["section"],
            "score": round(scores.get(c["vector_id"], 0.0), 4),
        }
        for c in chunks
    ]


async def _fallback_text_search(query: str, workspace_id: str, k: int) -> list[dict]:
    """Fallback text search when Vector Search is not configured."""
    words = query.lower().split()
    if not words:
        return []

    like_clauses = " OR ".join(["LOWER(text) LIKE $" + str(i + 2) for i in range(len(words))])
    params: list[object] = [workspace_id] + [f"%{w}%" for w in words[:5]]

    chunks = await fetch_all(
        f"""SELECT id, text, page, section
            FROM chunks
            WHERE workspace_id = $1 AND ({like_clauses})
            ORDER BY ordinal
            LIMIT {k}""",
        *params,
    )

    return [
        {
            "chunk_id": c["id"],
            "text": c["text"],
            "page": c["page"],
            "section": c["section"],
            "score": 0.5,
        }
        for c in chunks
    ]


vector_search_tool = FunctionTool(func=vector_search)
