-- Add notification_channel preference to users
-- 'telegram' = Telegram only (default for existing users)
-- 'email'    = Email only via AgentMail
-- 'both'     = Telegram + Email
ALTER TABLE users ADD COLUMN notification_channel TEXT NOT NULL DEFAULT 'telegram';
