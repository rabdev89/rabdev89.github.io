from google.adk.tools import FunctionTool


async def get_document_metadata(doc_id: str) -> dict:
    """Retrieve metadata for a specific document.

    Args:
        doc_id: The document UUID.

    Returns:
        Document metadata including filename, status, page count.
    """
    # TODO: query Postgres via asyncpg
    return {
        "id": doc_id,
        "filename": "[stub]",
        "status": "ready",
        "pages": 0,
    }


async def list_workspace_documents(workspace_id: str) -> list[dict]:
    """List all documents in a workspace.

    Args:
        workspace_id: The workspace/org ID.

    Returns:
        List of document summaries.
    """
    # TODO: query Postgres via asyncpg
    return []


async def fetch_chunk(chunk_id: str) -> dict:
    """Fetch the full text of a specific chunk.

    Args:
        chunk_id: The chunk UUID.

    Returns:
        Chunk data including text, page, and section.
    """
    # TODO: query Postgres via asyncpg
    return {
        "id": chunk_id,
        "text": "[stub]",
        "page": 0,
        "section": "",
    }


get_document_metadata_tool = FunctionTool(func=get_document_metadata)
list_workspace_documents_tool = FunctionTool(func=list_workspace_documents)
fetch_chunk_tool = FunctionTool(func=fetch_chunk)
