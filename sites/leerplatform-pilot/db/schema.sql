-- Voorbereid schema. Nog niet toegepast op een gehoste database.
CREATE TABLE user_documents (
  owner_id TEXT NOT NULL,
  document_key TEXT NOT NULL,
  value TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, document_key)
);
CREATE TABLE ai_usage (
  owner_id TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, day)
);
CREATE TABLE ai_results (
  owner_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, request_id)
);
