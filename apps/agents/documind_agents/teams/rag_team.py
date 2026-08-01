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
    instruction="""You are the Retriever agent. Given the user's question and workspace_id
from session state, use the vector_search tool to find the most relevant document chunks.
Return the top-k chunks with their metadata (chunk_id, page, section, score).
Store results in state key 'retrieved_chunks'.""",
    tools=[vector_search_tool, list_workspace_documents_tool],
)

analyzer = LlmAgent(
    name="Analyzer",
    model=settings.llm_model,
    instruction="""You are the Analyzer agent. Read 'retrieved_chunks' from session state.
For each chunk, extract key facts relevant to the user's question.
Produce a structured list of facts, each tagged with its source chunk_id and page.
Store results in state key 'analyzed_facts'.""",
    tools=[fetch_chunk_tool, get_document_metadata_tool],
)

writer = LlmAgent(
    name="Writer",
    model=settings.llm_model,
    instruction="""You are the Writer agent. Read 'analyzed_facts' from session state.
Draft a clear, well-structured answer to the user's question using only the provided facts.
For each claim, include an inline citation in the format [page X, section Y].
Store your draft in state key 'draft_answer'.
If 'critic_feedback' exists in state, revise your draft to address the feedback.""",
)

critic = LlmAgent(
    name="Critic",
    model=settings.llm_model,
    instruction="""You are the Critic agent. Read 'draft_answer' and 'analyzed_facts' from state.
Verify that every claim in the draft maps to a fact from the analyzed set.
Check that citations are accurate (correct page/section).
If the draft is satisfactory, set state key 'critic_approved' to true.
If not, set 'critic_approved' to false and store specific feedback in 'critic_feedback',
then the Writer will revise.""",
)

writer_critic_loop = LoopAgent(
    name="WriterCriticLoop",
    sub_agents=[writer, critic],
    max_iterations=settings.max_critic_revisions,
)

rag_team = SequentialAgent(
    name="RagTeam",
    description="Retrieves document chunks, analyzes them, drafts a cited answer, and self-checks it.",
    sub_agents=[retriever, analyzer, writer_critic_loop],
)
