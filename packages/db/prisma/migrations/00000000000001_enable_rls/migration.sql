-- Row-Level Security policies for workspace isolation.
-- Defense-in-depth: the application already filters by workspace_id,
-- but RLS enforces it at the database level as a safety net.
--
-- The app sets `app.current_workspace_id` via SET LOCAL at the start
-- of each request. RLS policies check this setting.

-- Enable RLS on workspace-scoped tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (the app user)
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE chunks FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_traces FORCE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs FORCE ROW LEVEL SECURITY;

-- Documents: direct workspace_id column
CREATE POLICY workspace_isolation_documents ON documents
  USING (workspace_id = current_setting('app.current_workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.current_workspace_id', true));

-- Chunks: direct workspace_id column
CREATE POLICY workspace_isolation_chunks ON chunks
  USING (workspace_id = current_setting('app.current_workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.current_workspace_id', true));

-- Conversations: direct workspace_id column
CREATE POLICY workspace_isolation_conversations ON conversations
  USING (workspace_id = current_setting('app.current_workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.current_workspace_id', true));

-- Messages: join through conversations
CREATE POLICY workspace_isolation_messages ON messages
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE workspace_id = current_setting('app.current_workspace_id', true)
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE workspace_id = current_setting('app.current_workspace_id', true)
    )
  );

-- Agent traces: join through messages -> conversations
CREATE POLICY workspace_isolation_agent_traces ON agent_traces
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = current_setting('app.current_workspace_id', true)
    )
  )
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = current_setting('app.current_workspace_id', true)
    )
  );

-- Ingestion jobs: join through documents
CREATE POLICY workspace_isolation_ingestion_jobs ON ingestion_jobs
  USING (
    document_id IN (
      SELECT id FROM documents
      WHERE workspace_id = current_setting('app.current_workspace_id', true)
    )
  )
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents
      WHERE workspace_id = current_setting('app.current_workspace_id', true)
    )
  );

-- Bypass policy for the migrations/admin user (superuser bypasses RLS by default,
-- but if using a non-superuser admin role, create this):
-- CREATE POLICY admin_bypass ON documents FOR ALL TO admin_role USING (true);
