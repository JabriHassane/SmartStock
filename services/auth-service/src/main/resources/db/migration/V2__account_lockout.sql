-- Verrouillage temporaire après échecs de connexion répétés (voir LoginAttemptService).
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
