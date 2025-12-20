import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import type { Env } from '../types/env';
import { authMiddleware } from '../middleware/auth';
import { renderDashboardPage } from '../views/dashboard-page';
import type { SessionPayload } from '../lib/jwt';

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all dashboard routes
app.use('*', authMiddleware());

// GET /dashboard - Main dashboard page
app.get('/dashboard', async (c) => {
  const user = c.get('user') as SessionPayload;

  // Fetch user details
  const userData = await c.env.DB.prepare(
    'SELECT name FROM users WHERE id = ?'
  ).bind(user.userId).first();

  // Fetch user's objects with stats
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
    ORDER BY o.created_at DESC
  `).bind(user.userId).all();

  // Count unread messages (placeholder - all messages for now)
  const messageCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM finder_messages fm
    JOIN objects o ON fm.object_id = o.id
    WHERE o.user_id = ?
  `).bind(user.userId).first();

  return c.html(renderDashboardPage({
    userName: userData?.name as string | undefined,
    userEmail: user.email,
    objects: objects.results,
    unreadMessages: (messageCount?.count as number) || 0,
  }));
});

// GET /dashboard/objects/new - Show create object form modal
app.get('/dashboard/objects/new', (c) => {
  return c.html(`
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <h2 style="margin: 0 0 24px 0; font-size: 24px; color: #333;">Add New Object</h2>
        <form
          hx-post="/dashboard/objects"
          hx-target="#modal-container"
          hx-swap="innerHTML"
        >
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
              Object Name <span style="color: #f44336;">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g., Laptop Bag, Car Keys"
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
            >
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows="3"
              placeholder="Add details to help identify this item"
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box; font-family: inherit;"
            ></textarea>
          </div>

          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button
              type="button"
              onclick="document.getElementById('modal-container').innerHTML = ''"
              style="flex: 1; padding: 12px; background: #f5f5f5; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500; color: #666;"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="cta-button"
              style="flex: 1; padding: 12px; font-size: 16px;"
            >
              Create Object
            </button>
          </div>
        </form>
      </div>
    </div>
  `);
});

// POST /dashboard/objects - Create new object (HTMX)
app.post('/dashboard/objects', async (c) => {
  const user = c.get('user') as SessionPayload;
  const formData = await c.req.parseBody();
  const name = formData.name as string;
  const description = formData.description as string;

  try {
    const objectId = ulid();

    await c.env.DB.prepare(`
      INSERT INTO objects (id, user_id, name, description, status)
      VALUES (?, ?, ?, ?, 'active')
    `).bind(objectId, user.userId, name, description || null).run();

    // Return success and trigger page reload
    return c.html(`
      <script>
        document.getElementById('modal-container').innerHTML = '';
        window.location.href = '/dashboard/objects/${objectId}';
      </script>
    `);
  } catch (error) {
    console.error('Error creating object:', error);
    return c.html(`
      <div style="color: #f44336; padding: 12px; background: #ffebee; border-radius: 8px; margin-bottom: 16px;">
        Failed to create object. Please try again.
      </div>
    `);
  }
});

// GET /dashboard/objects/:id - Object detail page
app.get('/dashboard/objects/:id', async (c) => {
  const user = c.get('user') as SessionPayload;
  const objectId = c.req.param('id');

  const object = await c.env.DB.prepare(
    'SELECT * FROM objects WHERE id = ? AND user_id = ?'
  ).bind(objectId, user.userId).first();

  if (!object) {
    return c.redirect('/dashboard');
  }

  const tags = await c.env.DB.prepare(
    'SELECT * FROM tags WHERE object_id = ? ORDER BY created_at DESC'
  ).bind(objectId).all();

  const scans = await c.env.DB.prepare(`
    SELECT
      se.id,
      se.ts,
      se.approx_location,
      se.lat,
      se.lng,
      t.id as tag_id,
      CASE WHEN fm.id IS NOT NULL THEN 1 ELSE 0 END as has_message
    FROM scan_events se
    JOIN tags t ON se.tag_id = t.id
    LEFT JOIN finder_messages fm ON fm.scan_event_id = se.id
    WHERE se.object_id = ?
    ORDER BY se.ts DESC
    LIMIT 20
  `).bind(objectId).all();

  const messages = await c.env.DB.prepare(`
    SELECT
      fm.*,
      se.approx_location,
      se.lat,
      se.lng,
      t.id as tag_id
    FROM finder_messages fm
    JOIN scan_events se ON fm.scan_event_id = se.id
    JOIN tags t ON fm.tag_id = t.id
    WHERE fm.object_id = ?
    ORDER BY fm.created_at DESC
  `).bind(objectId).all();

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${object.name} - Dashboard</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    ${getCommonStyles()}
    .tabs {
      display: flex;
      gap: 8px;
      border-bottom: 2px solid #e0e0e0;
      margin-bottom: 24px;
    }
    .tab {
      padding: 12px 24px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      color: #666;
      transition: all 0.2s;
    }
    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }
    .tab:hover {
      color: #667eea;
      background: #f5f5f5;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .tag-list {
      display: grid;
      gap: 12px;
    }
    .tag-item {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .scan-item, .message-item {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body style="margin: 0; background: #f5f5f5;">
  <div class="nav-bar">
    <h1>🏷️ NFC Tag Tracker</h1>
    <div class="nav-links">
      <a href="/dashboard" class="nav-link">← Back to Dashboard</a>
    </div>
  </div>

  <div class="main-content">
    <div style="background: white; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 32px; color: #333;">${escapeHtml(object.name as string)}</h1>
          ${object.description ? `<p style="color: #666; margin: 8px 0 0 0;">${escapeHtml(object.description as string)}</p>` : ''}
        </div>
        <span class="status-badge status-${object.status}">${object.status}</span>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab(0)">Tags (${tags.results.length})</button>
      <button class="tab" onclick="switchTab(1)">Scans (${scans.results.length})</button>
      <button class="tab" onclick="switchTab(2)">Messages (${messages.results.length})</button>
    </div>

    <div class="tab-content active">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0;">NFC Tags</h3>
        <button
          hx-get="/dashboard/objects/${objectId}/tags/new"
          hx-target="#modal-container"
          class="cta-button"
          style="width: auto; padding: 10px 20px;"
        >
          + Add Tag
        </button>
      </div>
      <div class="tag-list">
        ${tags.results.length === 0 ? `
          <div class="empty-state" style="padding: 48px;">
            <p>No tags yet. Add a tag to start tracking this object.</p>
          </div>
        ` : tags.results.map((tag: any) => `
          <div class="tag-item">
            <div>
              <code style="font-size: 16px; font-weight: 600; color: #667eea;">${tag.id}</code>
              ${tag.label ? `<p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">${escapeHtml(tag.label)}</p>` : ''}
            </div>
            <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; ${tag.active ? 'background: #e8f5e9; color: #2e7d32;' : 'background: #ffebee; color: #c62828;'}">
              ${tag.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="tab-content">
      <h3>Scan History</h3>
      ${scans.results.length === 0 ? `
        <div class="empty-state" style="padding: 48px;">
          <p>No scans yet. When someone scans your tag, the events will appear here.</p>
        </div>
      ` : scans.results.map((scan: any) => `
        <div class="scan-item">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <p style="margin: 0; font-weight: 500;">${scan.approx_location || 'Unknown location'}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">${new Date(scan.ts).toLocaleString()}</p>
            </div>
            ${scan.has_message ? '<span style="background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 6px; font-size: 12px;">💬 Message</span>' : ''}
          </div>
          ${scan.lat && scan.lng ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">📍 ${scan.lat.toFixed(4)}, ${scan.lng.toFixed(4)}</p>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="tab-content">
      <h3>Finder Messages</h3>
      ${messages.results.length === 0 ? `
        <div class="empty-state" style="padding: 48px;">
          <p>No messages yet. Finders can send you messages through the tag landing page.</p>
        </div>
      ` : messages.results.map((msg: any) => `
        <div class="message-item">
          <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.5;">"${escapeHtml(msg.message)}"</p>
          ${msg.contact ? `<p style="margin: 4px 0; font-size: 13px; color: #666;">📧 Contact: ${escapeHtml(msg.contact)}</p>` : ''}
          <p style="margin: 4px 0; font-size: 13px; color: #666;">📍 ${msg.approx_location || 'Unknown location'}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">${new Date(msg.created_at).toLocaleString()}</p>
        </div>
      `).join('')}
    </div>
  </div>

  <div id="modal-container"></div>

  <script>
    function switchTab(index) {
      const tabs = document.querySelectorAll('.tab');
      const contents = document.querySelectorAll('.tab-content');
      tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
      });
      contents.forEach((content, i) => {
        content.classList.toggle('active', i === index);
      });
    }
  </script>
</body>
</html>`);
});

// GET /dashboard/objects/:objectId/tags/new - Show add tag form modal
app.get('/dashboard/objects/:objectId/tags/new', (c) => {
  const objectId = c.req.param('objectId');

  return c.html(`
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%;">
        <h2 style="margin: 0 0 24px 0; font-size: 24px; color: #333;">Add NFC Tag</h2>
        <form
          hx-post="/dashboard/objects/${objectId}/tags"
          hx-target="#modal-container"
        >
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
              Tag ID <span style="color: #f44336;">*</span>
            </label>
            <input
              type="text"
              name="tag_id"
              required
              pattern="[A-Za-z0-9_-]+"
              placeholder="e.g., ABC123"
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box; font-family: monospace;"
            >
            <small style="color: #666; font-size: 13px;">Letters, numbers, dashes, and underscores only</small>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
              Label (optional)
            </label>
            <input
              type="text"
              name="label"
              placeholder="e.g., Inside pocket tag"
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
            >
          </div>

          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button
              type="button"
              onclick="document.getElementById('modal-container').innerHTML = ''"
              style="flex: 1; padding: 12px; background: #f5f5f5; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500; color: #666;"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="cta-button"
              style="flex: 1; padding: 12px; font-size: 16px;"
            >
              Add Tag
            </button>
          </div>
        </form>
      </div>
    </div>
  `);
});

// POST /dashboard/objects/:objectId/tags - Create new tag (HTMX)
app.post('/dashboard/objects/:objectId/tags', async (c) => {
  const user = c.get('user') as SessionPayload;
  const objectId = c.req.param('objectId');
  const formData = await c.req.parseBody();
  const tagId = formData.tag_id as string;
  const label = formData.label as string;

  try {
    // Verify ownership
    const object = await c.env.DB.prepare(
      'SELECT id FROM objects WHERE id = ? AND user_id = ?'
    ).bind(objectId, user.userId).first();

    if (!object) {
      return c.html('<div style="color: #f44336;">Object not found</div>');
    }

    // Check if tag exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM tags WHERE id = ?'
    ).bind(tagId).first();

    if (existing) {
      return c.html('<div style="color: #f44336;">Tag ID already in use</div>');
    }

    // Create tag
    await c.env.DB.prepare(`
      INSERT INTO tags (id, object_id, label, active)
      VALUES (?, ?, ?, 1)
    `).bind(tagId, objectId, label || null).run();

    // Reload page
    return c.html(`
      <script>
        window.location.reload();
      </script>
    `);
  } catch (error) {
    console.error('Error creating tag:', error);
    return c.html('<div style="color: #f44336;">Failed to create tag</div>');
  }
});

function getCommonStyles(): string {
  return `
    .nav-bar {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .nav-bar h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .nav-links { display: flex; gap: 20px; align-items: center; }
    .nav-link {
      color: white;
      text-decoration: none;
      font-size: 14px;
      padding: 8px 16px;
      border-radius: 6px;
      transition: background 0.2s;
    }
    .nav-link:hover { background: rgba(255,255,255,0.2); }
    .main-content { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-active { background: #e8f5e9; color: #2e7d32; }
    .status-lost { background: #fff3e0; color: #e65100; }
    .status-recovered { background: #e3f2fd; color: #1565c0; }
    .empty-state {
      text-align: center;
      padding: 64px 32px;
      background: #f9f9f9;
      border-radius: 12px;
      color: #666;
    }
  `;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export default app;
