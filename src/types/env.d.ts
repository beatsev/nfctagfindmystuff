export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespace
  TAGS_KV: KVNamespace;

  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  JWT_SECRET: string;
  MAGIC_LINK_SECRET: string;

  // Environment Variables
  DOMAIN: string;
  SESSION_DURATION_HOURS?: string;
  MAGIC_LINK_EXPIRY_MINUTES?: string;
}
