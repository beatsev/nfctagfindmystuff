import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import type { Env } from '../types/env';
import { apiAuthMiddleware } from '../middleware/auth';
import type { SessionPayload } from '../lib/jwt';
import { invalidateTagCache } from '../services/tag-lookup';

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all dashboard API routes
app.use('*', apiAuthMiddleware());

// Validation schemas
const createObjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  photo_url: z.string().url().optional(),
});

const updateObjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  photo_url: z.string().url().optional(),
  status: z.enum(['active', 'lost', 'recovered']).optional(),
});

const createTagSchema = z.object({
  tag_id: z.string().min(3).max(50).regex(/^[A-Za-z0-9_-]+$/),
  object_id: z.string(),
  label: z.string().max(100).optional(),
});

// GET /api/objects - List all objects for authenticated user
app.get('/api/objects', async (c) => {
  const user = c.get('user') as SessionPayload;
  const sortBy = c.req.query('sort') || 'recent_scan';

  // Build ORDER BY clause based on sort parameter
  let orderByClause: string;
  switch (sortBy) {
    case 'status':
      orderByClause = `
        CASE o.status
          WHEN 'lost' THEN 1
          WHEN 'recovered' THEN 2
          ELSE 3
        END,
        o.created_at DESC`;
      break;
    case 'created':
      orderByClause = 'o.created_at DESC';
      break;
    case 'recent_scan':
    default:
      orderByClause = 'COALESCE(MAX(se.ts), o.created_at) DESC';
      break;
  }

  try {
    const objects = await c.env.DB.prepare(`
      SELECT
        o.id,
        o.name,
        o.description,
        o.photo_url,
        o.status,
        o.created_at,
        COUNT(DISTINCT t.id) as tag_count,
        COUNT(DISTINCT se.id) as scan_count,
        MAX(se.ts) as last_scan
      FROM objects o
      LEFT JOIN tags t ON t.object_id = o.id AND t.active = 1
      LEFT JOIN scan_events se ON se.object_id = o.id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY ${orderByClause}
    `).bind(user.userId).all();

    return c.json({ objects: objects.results });
  } catch (error) {
    console.error('Error fetching objects:', error);
    return c.json({ error: 'Failed to fetch objects' }, 500);
  }
});

// POST /api/objects - Create new object
app.post(
  '/api/objects',
  zValidator('json', createObjectSchema),
  async (c) => {
    const user = c.get('user') as SessionPayload;
    const data = c.req.valid('json');

    try {
      const objectId = ulid();

      await c.env.DB.prepare(`
        INSERT INTO objects (id, user_id, name, description, photo_url, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).bind(
        objectId,
        user.userId,
        data.name,
        data.description || null,
        data.photo_url || null
      ).run();

      // Fetch the created object
      const object = await c.env.DB.prepare(
        'SELECT * FROM objects WHERE id = ?'
      ).bind(objectId).first();

      return c.json({ object }, 201);
    } catch (error) {
      console.error('Error creating object:', error);
      return c.json({ error: 'Failed to create object' }, 500);
    }
  }
);

// GET /api/objects/:id - Get single object with details
app.get('/api/objects/:id', async (c) => {
  const user = c.get('user') as SessionPayload;
  const objectId = c.req.param('id');

  try {
    // Fetch object
    const object = await c.env.DB.prepare(
      'SELECT * FROM objects WHERE id = ? AND user_id = ?'
    ).bind(objectId, user.userId).first();

    if (!object) {
      return c.json({ error: 'Object not found' }, 404);
    }

    // Fetch associated tags
    const tags = await c.env.DB.prepare(
      'SELECT * FROM tags WHERE object_id = ? ORDER BY created_at DESC'
    ).bind(objectId).all();

    return c.json({
      object,
      tags: tags.results
    });
  } catch (error) {
    console.error('Error fetching object:', error);
    return c.json({ error: 'Failed to fetch object' }, 500);
  }
});

// PATCH /api/objects/:id - Update object
app.patch('/api/objects/:id', async (c) => {
  const user = c.get('user') as SessionPayload;
  const objectId = c.req.param('id');

  // Parse form data from HTMX form submission
  const formData = await c.req.parseBody();
  const name = formData.name as string | undefined;
  const description = formData.description as string | undefined;
  const status = formData.status as string | undefined;

  try {
    // Verify ownership
    const object = await c.env.DB.prepare(
      'SELECT id FROM objects WHERE id = ? AND user_id = ?'
    ).bind(objectId, user.userId).first();

    if (!object) {
      return c.html(`
        <div style="color: #f44336; padding: 12px; background: #ffebee; border-radius: 8px;">
          Object not found or access denied
        </div>
      `);
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined && name.trim().length > 0) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || '');
    }
    if (status !== undefined && ['active', 'lost', 'recovered'].includes(status)) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return c.html(`
        <div style="color: #f44336; padding: 12px; background: #ffebee; border-radius: 8px;">
          No valid fields to update
        </div>
      `);
    }

    values.push(objectId);

    await c.env.DB.prepare(`
      UPDATE objects
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    // Invalidate cache for all tags associated with this object
    const tags = await c.env.DB.prepare(
      'SELECT id FROM tags WHERE object_id = ?'
    ).bind(objectId).all();

    // Invalidate each tag's cache
    for (const tag of tags.results) {
      await invalidateTagCache(tag.id as string, c.env);
    }

    // Return HTMX-compatible response that closes modal and reloads page
    return c.html(`
      <script>
        document.getElementById('modal-container').innerHTML = '';
        window.location.reload();
      </script>
    `);
  } catch (error) {
    console.error('Error updating object:', error);
    return c.html(`
      <div style="color: #f44336; padding: 12px; background: #ffebee; border-radius: 8px;">
        Failed to update object. Please try again.
      </div>
    `);
  }
});

// POST /api/tags - Create/link new tag to object
app.post(
  '/api/tags',
  zValidator('json', createTagSchema),
  async (c) => {
    const user = c.get('user') as SessionPayload;
    const data = c.req.valid('json');

    try {
      // Verify user owns the object
      const object = await c.env.DB.prepare(
        'SELECT id FROM objects WHERE id = ? AND user_id = ?'
      ).bind(data.object_id, user.userId).first();

      if (!object) {
        return c.json({ error: 'Object not found' }, 404);
      }

      // Check if tag_id already exists
      const existingTag = await c.env.DB.prepare(
        'SELECT id FROM tags WHERE id = ?'
      ).bind(data.tag_id).first();

      if (existingTag) {
        return c.json({ error: 'Tag ID already in use' }, 409);
      }

      // Create tag
      await c.env.DB.prepare(`
        INSERT INTO tags (id, object_id, label, active)
        VALUES (?, ?, ?, 1)
      `).bind(
        data.tag_id,
        data.object_id,
        data.label || null
      ).run();

      // Cache tag in KV for fast lookups
      const tagData = {
        tagId: data.tag_id,
        objectId: data.object_id,
        objectName: null, // Will be fetched on first scan
        objectDescription: null,
        userId: user.userId,
      };

      await c.env.TAGS_KV.put(
        `tag:${data.tag_id}`,
        JSON.stringify(tagData),
        { expirationTtl: 86400 } // 24 hours
      );

      // Fetch created tag
      const tag = await c.env.DB.prepare(
        'SELECT * FROM tags WHERE id = ?'
      ).bind(data.tag_id).first();

      return c.json({ tag }, 201);
    } catch (error) {
      console.error('Error creating tag:', error);
      return c.json({ error: 'Failed to create tag' }, 500);
    }
  }
);

// GET /api/tags/:tagId/scans - Get scan history for a tag
app.get('/api/tags/:tagId/scans', async (c) => {
  const user = c.get('user') as SessionPayload;
  const tagId = c.req.param('tagId');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  try {
    // Verify user owns the tag's object
    const tag = await c.env.DB.prepare(`
      SELECT t.id
      FROM tags t
      JOIN objects o ON t.object_id = o.id
      WHERE t.id = ? AND o.user_id = ?
    `).bind(tagId, user.userId).first();

    if (!tag) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    // Fetch scan events with message indicator
    const scans = await c.env.DB.prepare(`
      SELECT
        se.id,
        se.ts,
        se.approx_location,
        se.lat,
        se.lng,
        se.source,
        CASE WHEN fm.id IS NOT NULL THEN 1 ELSE 0 END as has_message
      FROM scan_events se
      LEFT JOIN finder_messages fm ON fm.scan_event_id = se.id
      WHERE se.tag_id = ?
      ORDER BY se.ts DESC
      LIMIT ?
    `).bind(tagId, limit).all();

    return c.json({ scans: scans.results });
  } catch (error) {
    console.error('Error fetching scans:', error);
    return c.json({ error: 'Failed to fetch scans' }, 500);
  }
});

// GET /api/messages - Get finder messages for user's objects
app.get('/api/messages', async (c) => {
  const user = c.get('user') as SessionPayload;
  const objectId = c.req.query('object_id');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  try {
    let query = `
      SELECT
        fm.id,
        fm.scan_event_id,
        fm.tag_id,
        fm.object_id,
        fm.message,
        fm.contact,
        fm.created_at,
        o.name as object_name,
        se.approx_location,
        se.lat,
        se.lng
      FROM finder_messages fm
      JOIN objects o ON fm.object_id = o.id
      LEFT JOIN scan_events se ON fm.scan_event_id = se.id
      WHERE o.user_id = ?
    `;

    const bindings: any[] = [user.userId];

    if (objectId) {
      query += ' AND fm.object_id = ?';
      bindings.push(objectId);
    }

    query += ' ORDER BY fm.created_at DESC LIMIT ?';
    bindings.push(limit);

    const messages = await c.env.DB.prepare(query).bind(...bindings).all();

    return c.json({ messages: messages.results });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

// PATCH /api/tags/:tagId - Update tag (activate/deactivate, change label)
app.patch(
  '/api/tags/:tagId',
  zValidator('json', z.object({
    active: z.boolean().optional(),
    label: z.string().max(100).optional(),
  })),
  async (c) => {
    const user = c.get('user') as SessionPayload;
    const tagId = c.req.param('tagId');
    const data = c.req.valid('json');

    try {
      // Verify user owns the tag's object
      const tag = await c.env.DB.prepare(`
        SELECT t.id
        FROM tags t
        JOIN objects o ON t.object_id = o.id
        WHERE t.id = ? AND o.user_id = ?
      `).bind(tagId, user.userId).first();

      if (!tag) {
        return c.json({ error: 'Tag not found' }, 404);
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];

      if (data.active !== undefined) {
        updates.push('active = ?');
        values.push(data.active ? 1 : 0);
      }
      if (data.label !== undefined) {
        updates.push('label = ?');
        values.push(data.label);
      }

      if (updates.length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      values.push(tagId);

      await c.env.DB.prepare(`
        UPDATE tags
        SET ${updates.join(', ')}
        WHERE id = ?
      `).bind(...values).run();

      // Invalidate KV cache
      await c.env.TAGS_KV.delete(`tag:${tagId}`);

      // Fetch updated tag
      const updated = await c.env.DB.prepare(
        'SELECT * FROM tags WHERE id = ?'
      ).bind(tagId).first();

      return c.json({ tag: updated });
    } catch (error) {
      console.error('Error updating tag:', error);
      return c.json({ error: 'Failed to update tag' }, 500);
    }
  }
);

export default app;
