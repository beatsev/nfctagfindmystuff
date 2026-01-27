import type { Env } from '../types/env';

export interface TagData {
  tagId: string;
  objectId: string;
  userId: string;
  objectName: string;
  objectDescription: string | null;
  objectStatus: string;
  active: boolean;
}

/**
 * Look up tag data with KV cache + D1 fallback
 * @param tagId - The tag ID to look up
 * @param env - Cloudflare environment bindings
 * @param ctx - Optional execution context for non-blocking KV backfill
 * @returns TagData if found, null otherwise
 */
export async function lookupTag(
  tagId: string,
  env: Env,
  ctx?: ExecutionContext
): Promise<TagData | null> {
  // 1. Check KV cache first
  const cached = await env.TAGS_KV.get(`tag:${tagId}`, 'json');
  if (cached) {
    return cached as TagData;
  }

  // 2. Query D1 with JOIN
  const result = await env.DB.prepare(`
    SELECT
      t.id as tagId,
      t.object_id as objectId,
      t.active,
      o.user_id as userId,
      o.name as objectName,
      o.description as objectDescription,
      o.status as objectStatus
    FROM tags t
    JOIN objects o ON t.object_id = o.id
    WHERE t.id = ? AND t.active = 1
  `).bind(tagId).first();

  if (!result) {
    return null;
  }

  const tagData: TagData = {
    tagId: result.tagId as string,
    objectId: result.objectId as string,
    userId: result.userId as string,
    objectName: result.objectName as string,
    objectDescription: result.objectDescription as string | null,
    objectStatus: result.objectStatus as string,
    active: Boolean(result.active),
  };

  // 3. Backfill KV cache with 24-hour TTL (non-blocking)
  const kvBackfill = env.TAGS_KV.put(
    `tag:${tagId}`,
    JSON.stringify(tagData),
    { expirationTtl: 86400 } // 24 hours
  );
  if (ctx) {
    ctx.waitUntil(kvBackfill);
  }

  return tagData;
}

/**
 * Invalidate tag cache (call when object/tag is updated)
 * @param tagId - The tag ID to invalidate
 * @param env - Cloudflare environment bindings
 */
export async function invalidateTagCache(tagId: string, env: Env): Promise<void> {
  await env.TAGS_KV.delete(`tag:${tagId}`);
}
