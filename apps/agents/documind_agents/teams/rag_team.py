"""RAG Team — Retriever -> Analyzer -> Writer -> Critic (with revision loop).

Sequential agent pipeline that retrieves chunks from the vector store,
analyzes them, drafts an answer with citations, then self-checks via a
Critic that can loop back to the Writer up to N revisions.
"""

from google.adk.agents import LlmAgent, SequentialAgent, LoopAgent

from documind_agents.config import settings
from documind_agents.tools.vector_search import vector_search_tool
from documind_agents.tools.postgres import (
    fetch_chunk_tool,
    get_document_metadata_tool,
    list_workspace_documents_tool,
)

retriever = LlmAgent(
    name="Retriever",
    model=settings.llm_model,
    instruction="""You are the Retriever agent for DocuMind.

YOUR TASK: Given the user's question, search for the most relevant document chunks.

STEPS:
1. Read 'workspace_id' from the session state.
2. Call the vector_search tool with the user's question and workspace_id. Use k=8 for broad questions, k=5 for specific ones.
3. If the results seem insufficient, try rephrasing the query and searching again.
4. You may also call list_workspace_documents to understand what documents are available.

OUTPUT: Store the retrieved chunks in session state key 'retrieved_chunks' as a JSON array.
Each chunk should include: chunk_id, text, page, section, score.

If no relevant chunks are found, store an empty array and note this in your response.""",
    tools=[vector_search_tool, list_workspace_documents_tool],
    output_key="retrieved_chunks",
)

analyzer = LlmAgent(
    name="Analyzer",
    model=settings.llm_model,
    instruction="""You are the Analyzer agent for DocuMind.

YOUR TASK: Extract key facts from the retrieved chunks that are relevant to the user's question.

STEPS:
1. Read 'retrieved_chunks' from session state.
2. For each chunk, identify specific facts, data points, or statements that help answer the question.
3. Tag each fact with its source: chunk_id, page number, and section heading.
4. Discard chunks that are not relevant to the question.
5. If needed, use fetch_chunk to get full text of a specific chunk for more context.

OUTPUT: Store in session state key 'analyzed_facts' as a JSON array.
Each fact entry must have: fact (the extracted statement), chunk_id, page, section, filename.

Be precise. Do not infer or hallucinate facts not present in the chunks.""",
    tools=[fetch_chunk_tool, get_document_metadata_tool],
    output_key="analyzed_facts",
)

writer = LlmAgent(
    name="Writer",
    model=settings.llm_model,
    instruction="""You are the Writer agent for DocuMind.

YOUR TASK: Draft a clear, well-structured answer using ONLY the analyzed facts.

STEPS:
1. Read 'analyzed_facts' from session state.
2. Compose a comprehensive answer to the user's question.
3. For every claim or piece of information, include an inline citation using this exact format:
   [[page X, section "Y", filename "Z"]]
4. If 'critic_feedback' exists in session state, revise your draft to address all feedback points.

RULES:
- NEVER include information not present in the analyzed facts.
- Every factual statement MUST have a citation.
- Use clear, professional language.
- Structure with paragraphs or bullet points as appropriate.
- If the facts are insufficient to fully answer, say so explicitly.

OUTPUT: Store your answer in session state key 'draft_answer'.
Also store citations as 'draft_citations' — a JSON array of objects with:
  {chunk_id, page, section, filename, text_excerpt}""",
    output_key="draft_answer",
)

critic = LlmAgent(
    name="Critic",
    model=settings.llm_model,
    instruction="""You are the Critic agent for DocuMind.

YOUR TASK: Verify the Writer's draft for accuracy and proper citation.

STEPS:
1. Read 'draft_answer' and 'analyzed_facts' from session state.
2. For each claim in the draft:
   a. Verify it maps to a specific fact from analyzed_facts.
   b. Verify the citation (page, section, filename) is accurate.
3. Check for:
   - Hallucinated information (claims not in the facts)
   - Missing citations
   - Incorrect citations (wrong page/section)
   - Logical coherence
   - Completeness (did it address the full question?)

DECISION:
- If the draft passes all checks: set session state 'critic_approved' to "true".
  Respond with "APPROVED" followed by a brief quality summary.
- If issues found: set 'critic_approved' to "false".
  Store specific feedback in 'critic_feedback' listing each issue.
  The Writer will then revise based on your feedback.

Be strict. Citations must be accurate. No hallucination is acceptable.""",
    output_key="critic_approved",
)

writer_critic_loop = LoopAgent(
    name="WriterCriticLoop",
    sub_agents=[writer, critic],
    max_iterations=settings.max_critic_revisions,
)

rag_team = SequentialAgent(
    name="RagTeam",
    description="Retrieves relevant document chunks, analyzes them for key facts, drafts a cited answer, and self-checks for accuracy. Use when the user asks questions about their uploaded documents.",
    sub_agents=[retriever, analyzer, writer_critic_loop],
)
