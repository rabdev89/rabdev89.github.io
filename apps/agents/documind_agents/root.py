"""Root Orchestrator — routes user intent to the RAG team or SWE team."""

from google.adk.agents import LlmAgent

from documind_agents.config import settings
from documind_agents.teams.rag_team import rag_team
from documind_agents.teams.swe_team import swe_team

root_orchestrator = LlmAgent(
    name="RootOrchestrator",
    model=settings.llm_model,
    instruction="""You are the RootOrchestrator for DocuMind. You receive user messages
and route them to the appropriate agent team.

ROUTING RULES:
1. If the user asks a question about their documents, wants information retrieved,
   summarized, compared, or analyzed from uploaded content → delegate to RagTeam.
2. If the user asks to build, design, architect, code, spec, or create software
   artifacts based on their documents → delegate to SweTeam.
3. If the intent is ambiguous, ask a clarifying question.

Always pass the workspace_id and user_id from the session state to sub-agents.
When a sub-agent completes, relay its final answer back to the user with
proper citations preserved.""",
    sub_agents=[rag_team, swe_team],
)
