CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL, message_id INTEGER NOT NULL,
 game TEXT NOT NULL DEFAULT 'Other', developer TEXT NOT NULL DEFAULT 'Other',
 version TEXT NOT NULL DEFAULT 'Unspecified', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL, UNIQUE(chat_id,message_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_game ON posts(game);
CREATE INDEX IF NOT EXISTS idx_posts_dev ON posts(developer);
CREATE INDEX IF NOT EXISTS idx_posts_version ON posts(version);
