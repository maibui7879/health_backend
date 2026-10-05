-- Migration: feed community ngầm (Phase 7F) — impression + điểm author.
-- Không API hide/mute công khai: tất cả suy từ hành vi (like/comment +1,
-- report -2), ranking trong CommunityService. Tự chạy khi boot (migrator.ts).

CREATE TABLE IF NOT EXISTS community_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  impressions INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_community_post_views_user
  ON community_post_views (user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS community_author_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score FLOAT NOT NULL DEFAULT 0,
  interactions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, author_id)
);
