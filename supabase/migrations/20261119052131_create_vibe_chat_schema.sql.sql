/*
# Vibe Chat schema (single-tenant, no auth)

1. Plain-English summary
   Vibe Chat persists AI chat threads. A "conversation" is a thread with a
   title and a tone; every message (user or assistant) inside a thread is
   stored as its own row so streaming, regeneration and editing can append,
   replace or delete individual messages without rewriting the thread.

2. New tables
   - conversations
     - id (uuid, primary key)
     - title (text, shown in the sidebar)
     - tone (text: 'professional' | 'casual' | 'concise')
     - pinned (boolean, pinned threads surface at the top of the sidebar)
     - created_at, updated_at (timestamps; sidebar groups threads by recency)
   - messages
     - id (uuid, primary key)
     - conversation_id (uuid -> conversations.id, ON DELETE CASCADE)
     - role (text: 'user' | 'assistant')
     - content (text, the message body)
     - tone (text, the tone the message was created under)
     - interrupted (boolean, true when generation was stopped mid-stream)
     - tokens_used (integer, optional usage counter)
     - created_at (timestamp)

3. Indexes
   - conversations: btree index on updated_at DESC (sidebar ordering).
   - messages: index on conversation_id + created_at (thread loading).
   - Full-text search index on conversations.title and
     messages.content (sidebar search across titles AND message text).

4. Security
   - RLS enabled on both tables.
   - Single-tenant, no sign-in: full CRUD granted to anon + authenticated,
     with USING(true) policies because the data is intentionally public/shared.
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New chat',
  tone text NOT NULL DEFAULT 'professional'
    CHECK (tone IN ('professional', 'casual', 'concise')),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  tone text NOT NULL DEFAULT 'professional'
    CHECK (tone IN ('professional', 'casual', 'concise')),
  interrupted boolean NOT NULL DEFAULT false,
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_title_fts
  ON conversations USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_messages_content_fts
  ON messages USING gin (to_tsvector('english', content));

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO anon, authenticated;

DROP POLICY IF EXISTS "Public read conversations" ON conversations;
CREATE POLICY "Public read conversations" ON conversations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public insert conversations" ON conversations;
CREATE POLICY "Public insert conversations" ON conversations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public update conversations" ON conversations;
CREATE POLICY "Public update conversations" ON conversations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete conversations" ON conversations;
CREATE POLICY "Public delete conversations" ON conversations
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read messages" ON messages;
CREATE POLICY "Public read messages" ON messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public insert messages" ON messages;
CREATE POLICY "Public insert messages" ON messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public update messages" ON messages;
CREATE POLICY "Public update messages" ON messages
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete messages" ON messages;
CREATE POLICY "Public delete messages" ON messages
  FOR DELETE TO anon, authenticated USING (true);
