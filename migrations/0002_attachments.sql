-- Task image attachments (binary stored in D1; R2 can replace later if token allows)

CREATE TABLE IF NOT EXISTS task_attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_attachment_blobs (
  attachment_id TEXT PRIMARY KEY REFERENCES task_attachments(id) ON DELETE CASCADE,
  data BLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id);
