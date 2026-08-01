from google.adk.tools import FunctionTool
from google.cloud import aiplatform


async def vector_search(query: str, workspace_id: str, k: int = 5) -> list[dict]:
    """Search the vector index for chunks relevant to the query within a workspace.

    Args:
        query: The search query text.
        workspace_id: The workspace namespace to search within.
        k: Number of top results to return.

    Returns:
        A list of matching chunks with id, text, page, section, and score.
    """
    # TODO: embed query with text-embedding-005, then query Vertex Vector Search
    # Filtered by namespace=workspace_id
    return [
        {
            "chunk_id": "stub",
            "text": f"[stub] No vector index configured yet. Query: {query}",
            "page": 1,
            "section": "",
            "score": 0.0,
        }
    ]


vector_search_tool = FunctionTool(func=vector_search)
