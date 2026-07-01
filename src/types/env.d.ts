export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespace
  TAGS_KV: KVNamespace;

  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  JWT_SECRET: string;
  MAGIC_LINK_SECRET: string;
  AGENTMAIL_API_KEY: string;

  // Environment Variables
  DOMAIN: string;
  AGENTMAIL_INBOX_ID: string;
  TELEGRAM_BOT_USERNAME: string;
  SESSION_DURATION_HOURS?: string;
  MAGIC_LINK_EXPIRY_MINUTES?: string;
}
