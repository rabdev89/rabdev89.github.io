"""Postgres-backed tools for document and chunk metadata."""

from google.adk.tools import FunctionTool
from documind_agents.db import fetch_all, fetch_one


async def get_document_metadata(doc_id: str) -> dict:
    """Retrieve metadata for a specific document.

    Args:
        doc_id: The document UUID.

    Returns:
        Document metadata including filename, status, page count, and chunk count.
    """
    row = await fetch_one(
        """SELECT d.id, d.filename, d.status, d.mime_type, d.size_bytes,
                  d.created_at, COUNT(c.id) as chunk_count
           FROM documents d
           LEFT JOIN chunks c ON c.document_id = d.id
           WHERE d.id = $1
           GROUP BY d.id""",
        doc_id,
    )
    if not row:
        return {"error": f"Document {doc_id} not found"}

    return {
        "id": row["id"],
        "filename": row["filename"],
        "status": row["status"],
        "mime_type": row["mime_type"],
        "size_bytes": row["size_bytes"],
        "chunk_count": row["chunk_count"],
        "created_at": str(row["created_at"]),
    }


async def list_workspace_documents(workspace_id: str) -> list[dict]:
    """List all documents in a workspace.

    Args:
        workspace_id: The workspace/org ID.

    Returns:
        List of document summaries with filename, status, and chunk count.
    """
    rows = await fetch_all(
        """SELECT d.id, d.filename, d.status, d.mime_type, d.size_bytes,
                  d.created_at, COUNT(c.id) as chunk_count
           FROM documents d
           LEFT JOIN chunks c ON c.document_id = d.id
           WHERE d.workspace_id = $1
           GROUP BY d.id
           ORDER BY d.created_at DESC
           LIMIT 50""",
        workspace_id,
    )
    return [
        {
            "id": r["id"],
            "filename": r["filename"],
            "status": r["status"],
            "chunk_count": r["chunk_count"],
        }
        for r in rows
    ]


async def fetch_chunk(chunk_id: str) -> dict:
    """Fetch the full text of a specific chunk by its ID.

    Args:
        chunk_id: The chunk UUID.

    Returns:
        Chunk data including text content, page number, and section heading.
    """
    row = await fetch_one(
        """SELECT c.id, c.text, c.page, c.section, d.filename
           FROM chunks c
           JOIN documents d ON d.id = c.document_id
           WHERE c.id = $1""",
        chunk_id,
    )
    if not row:
        return {"error": f"Chunk {chunk_id} not found"}

    return {
        "id": row["id"],
        "text": row["text"],
        "page": row["page"],
        "section": row["section"],
        "filename": row["filename"],
    }


get_document_metadata_tool = FunctionTool(func=get_document_metadata)
list_workspace_documents_tool = FunctionTool(func=list_workspace_documents)
fetch_chunk_tool = FunctionTool(func=fetch_chunk)
