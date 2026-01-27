import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/env';
import { updateScanEventLocation } from '../services/scan-event';
import { sendTelegramNotification } from '../services/telegram';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// Validation schemas - scan_event_id accepts UUID string or legacy integer ID
const messageSchema = z.object({
  scan_event_id: z.string().min(1),
  message: z.string().min(1).max(1000),
  contact: z.string().max(200).optional(),
});

const locationSchema = z.object({
  scan_event_id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// POST /api/t/:tagId/message - Finder sends message to owner
app.post(
  '/api/t/:tagId/message',
  rateLimitMiddleware(3, 300), // 3 messages per 5 minutes
  zValidator('form', messageSchema),
  async (c) => {
    const tagId = c.req.param('tagId');
    const { scan_event_id, message, contact } = c.req.valid('form');

    try {
      // Verify scan event belongs to this tag (lookup by UUID or legacy integer ID)
      const isUuid = scan_event_id.includes('-');
      const scanEvent = await c.env.DB.prepare(
        isUuid
          ? 'SELECT id, object_id, tag_id FROM scan_events WHERE uuid = ?'
          : 'SELECT id, object_id, tag_id FROM scan_events WHERE id = ?'
      ).bind(isUuid ? scan_event_id : Number(scan_event_id)).first();

      if (!scanEvent || scanEvent.tag_id !== tagId) {
        return c.html(`
          <div class="success-message" style="background: linear-gradient(to bottom, #fee2e2, #fecaca); border-color: #ef4444;">
            <p style="color: #991b1b;">❌ <strong>Error</strong></p>
            <p style="color: #b91c1c;">Invalid scan event. Please try scanning the tag again.</p>
          </div>
        `, 400);
      }

      // Get object and user info for notification
      const objectData = await c.env.DB.prepare(`
        SELECT o.name, o.user_id
        FROM objects o
        WHERE o.id = ?
      `).bind(scanEvent.object_id).first();

      if (!objectData) {
        return c.html(`
          <div class="success-message" style="background: linear-gradient(to bottom, #fee2e2, #fecaca); border-color: #ef4444;">
            <p style="color: #991b1b;">❌ <strong>Error</strong></p>
            <p style="color: #b91c1c;">Item not found. Please contact support.</p>
          </div>
        `, 404);
      }

      // Insert message using the integer scan event ID
      const scanEventIntId = scanEvent.id as number;
      await c.env.DB.prepare(`
        INSERT INTO finder_messages
        (scan_event_id, tag_id, object_id, message, contact)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        scanEventIntId,
        tagId,
        scanEvent.object_id,
        message,
        contact || null
      ).run();

      // Send Telegram notification with message preview (async, non-blocking)
      c.executionCtx.waitUntil(
        sendTelegramNotification({
          userId: objectData.user_id as string,
          objectName: objectData.name as string,
          tagId,
          scanEventId: scanEventIntId,
          approxLocation: null,
          hasMessage: true,
          messagePreview: message.substring(0, 100),
        }, c.env)
      );

      // Return HTML for HTMX to swap in
      return c.html(`
        <div class="success-message">
          <p>✅ <strong>Message sent to owner!</strong></p>
          <p>They will be notified and can reach out to you if you provided contact information.</p>
        </div>
      `);
    } catch (error) {
      console.error('Error saving message:', error);
      return c.html(`
        <div class="success-message" style="background: linear-gradient(to bottom, #fee2e2, #fecaca); border-color: #ef4444;">
          <p style="color: #991b1b;">❌ <strong>Error</strong></p>
          <p style="color: #b91c1c;">Failed to send message. Please try again.</p>
        </div>
      `, 500);
    }
  }
);

// POST /api/t/:tagId/location - Finder shares GPS location
app.post(
  '/api/t/:tagId/location',
  rateLimitMiddleware(5, 300), // 5 location updates per 5 minutes
  zValidator('json', locationSchema),
  async (c) => {
    const tagId = c.req.param('tagId');
    const { scan_event_id, lat, lng } = c.req.valid('json');

    try {
      // Verify scan event belongs to this tag (lookup by UUID or legacy integer ID)
      const isUuid = scan_event_id.includes('-');
      const scanEvent = await c.env.DB.prepare(
        isUuid
          ? 'SELECT id, tag_id FROM scan_events WHERE uuid = ?'
          : 'SELECT id, tag_id FROM scan_events WHERE id = ?'
      ).bind(isUuid ? scan_event_id : Number(scan_event_id)).first();

      if (!scanEvent || scanEvent.tag_id !== tagId) {
        return c.json({ error: 'Invalid scan event' }, 400);
      }

      // Update scan event with location using the integer ID
      await updateScanEventLocation(scanEvent.id as number, lat, lng, c.env);

      return c.json({
        success: true,
        message: 'Location shared with owner',
        coordinates: { lat, lng }
      });
    } catch (error) {
      console.error('Error updating location:', error);
      return c.json({ error: 'Failed to share location' }, 500);
    }
  }
);

export default app;
