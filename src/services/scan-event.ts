import type { Env } from '../types/env';
import { hashIP } from '../lib/crypto';

export interface ScanEventData {
  tagId: string;
  objectId: string;
  ipAddress: string | null;
  userAgent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Log a scan event to D1
 * @param data - Scan event data
 * @param env - Cloudflare environment bindings
 * @returns Promise<number> - The ID of the inserted scan event
 */
export async function logScanEvent(
  data: ScanEventData,
  env: Env
): Promise<number> {
  // Hash IP for privacy
  const ipHash = data.ipAddress ? await hashIP(data.ipAddress) : null;

  // Build approximate location string from CF metadata
  const approxLocation = [data.city, data.region, data.country]
    .filter(Boolean)
    .join(', ') || null;

  const result = await env.DB.prepare(`
    INSERT INTO scan_events
    (tag_id, object_id, ip_hash, user_agent, approx_location, source)
    VALUES (?, ?, ?, ?, ?, 'landing_page')
  `).bind(
    data.tagId,
    data.objectId,
    ipHash,
    data.userAgent,
    approxLocation
  ).run();

  return result.meta.last_row_id as number;
}

/**
 * Update scan event with precise GPS coordinates
 * @param scanEventId - The scan event ID to update
 * @param lat - Latitude
 * @param lng - Longitude
 * @param env - Cloudflare environment bindings
 */
export async function updateScanEventLocation(
  scanEventId: number,
  lat: number,
  lng: number,
  env: Env
): Promise<void> {
  await env.DB.prepare(`
    UPDATE scan_events
    SET lat = ?, lng = ?
    WHERE id = ?
  `).bind(lat, lng, scanEventId).run();
}
