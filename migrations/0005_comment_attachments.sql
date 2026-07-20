-- Images attached to task comments

CREATE TABLE IF NOT EXISTS comment_attachments (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comment_attachment_blobs (
  attachment_id TEXT PRIMARY KEY REFERENCES comment_attachments(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment
  ON comment_attachments(comment_id, created_at);
