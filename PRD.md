# Product Requirements Document: NFC Tag Lost & Found Tracking System

## Overview

A serverless web application for tracking lost items via NFC tags. When someone scans an NFC tag attached to a lost item, the owner receives notifications and can communicate with the finder without exposing personal contact details.

## Problem Statement

People lose valuable items (bags, laptops, keys, etc.) and need a way to:
- Be notified when someone finds their item
- Enable finders to contact them without exposing personal information
- Track scan history and approximate locations
- Manage multiple tagged items from a single dashboard

## Solution

Deploy passive NFC tags with unique URLs that, when scanned, trigger server-side notifications and provide a privacy-preserving contact interface.

## Implementation Status

**Last Updated**: December 22, 2025

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Project initialization with npm and TypeScript
- [x] Cloudflare Workers setup with Hono framework
- [x] D1 database created and configured
- [x] KV namespace created and bound
- [x] Environment variables configured (.dev.vars)
- [x] Basic health check endpoint

### ✅ Phase 2: Core Tag Scanning (COMPLETED)
- [x] Database schema migrations (7 files)
  - [x] users, objects, tags, scan_events tables
  - [x] finder_messages, owner_notifications tables
  - [x] Performance indexes
  - [x] photo_url column added to objects
- [x] Tag lookup service with KV + D1 read-through cache
- [x] Scan event logging with IP hashing (SHA-256)
- [x] Landing page for finders (HTML/CSS/JS)
- [x] Cloudflare metadata extraction (city, region, country)
- [x] Test data inserted and verified

### ✅ Phase 3: Telegram Integration (COMPLETED)
- [x] Telegram bot created (@your_nfc_bot_bot)
- [x] Notification service with Markdown formatting
- [x] Non-blocking notifications using ctx.waitUntil()
- [x] Notification status logging to database
- [x] Admin endpoint to capture user chat IDs
- [x] Live testing confirmed (user received notification)

### ✅ Phase 4: Finder Actions (COMPLETED)
- [x] POST /api/t/:tagId/message endpoint
  - [x] Zod validation for message content
  - [x] Contact info support (optional)
  - [x] Telegram notification with message preview
- [x] POST /api/t/:tagId/location endpoint
  - [x] GPS coordinate validation
  - [x] Updates scan_events with lat/lng
- [x] Rate limiting middleware (in-memory)
  - [x] 10 requests/min for landing pages
  - [x] 3 messages/5min per IP
  - [x] 5 location updates/5min per IP
- [x] Rate limit headers (X-RateLimit-*)
- [x] Cleanup logic for memory management

### ✅ Phase 5: Authentication (COMPLETED)
- [x] JWT session management with jose library
- [x] Magic link authentication via Telegram
  - [x] 15-minute magic link expiry
  - [x] 30-day session duration
- [x] Login page with email form
- [x] Auth middleware for protected routes
- [x] API auth middleware with 401 responses
- [x] Logout functionality
- [x] HTTP-only cookies with SameSite protection
- [x] Rate limiting on login (5 attempts/5min)

### ✅ Phase 6: Dashboard API (COMPLETED)
- [x] GET /api/objects - List with aggregated stats
- [x] POST /api/objects - Create new object
- [x] GET /api/objects/:id - Get single object with tags
- [x] PATCH /api/objects/:id - Update object fields
- [x] POST /api/tags - Create/link tag with KV caching
- [x] PATCH /api/tags/:tagId - Update tag or toggle active
- [x] GET /api/tags/:tagId/scans - Scan history
- [x] GET /api/messages - Finder messages with filters
- [x] Ownership verification on all operations
- [x] Dynamic SQL for partial updates
- [x] Input validation with Zod schemas

### ✅ Phase 7: Dashboard UI (COMPLETED)
- [x] Dashboard home page with objects grid
- [x] Object detail page with tabbed interface
  - [x] Tags management tab
  - [x] Scan history tab with locations
  - [x] Finder messages tab
- [x] HTMX modal forms for object creation
- [x] HTMX modal forms for tag creation
- [x] Responsive design (mobile-first)
- [x] Status badges (active/lost/recovered)
- [x] Empty states with helpful prompts
- [x] Navigation bar with message counter
- [x] Tab switching without page reload

### ✅ Phase 8: Polish & Testing (COMPLETED)
- [x] Map visualization for scan locations
  - [x] Leaflet.js integration for interactive maps
  - [x] Scan location markers with popups
  - [x] OpenStreetMap tile layer
- [x] Enhanced error handling and user feedback
- [x] Accessibility improvements (ARIA labels)
  - [x] Form labels and descriptions
  - [x] Button aria-labels
  - [x] Semantic HTML structure
- [x] Mobile responsiveness verified
- [x] Input validation with Zod schemas

### ✅ Phase 9: Deployment (COMPLETED)
- [x] Production environment variables setup
  - [x] DOMAIN updated to https://nfc-tag-tracker.beatsev.workers.dev
  - [x] SESSION_DURATION_HOURS and MAGIC_LINK_EXPIRY_MINUTES configured
- [x] Production secrets configured
  - [x] TELEGRAM_BOT_TOKEN
  - [x] JWT_SECRET (auto-generated secure random)
  - [x] MAGIC_LINK_SECRET (auto-generated secure random)
- [x] D1 migrations to production (all 8 migrations applied)
- [x] Cloudflare Workers deployment
  - [x] Worker deployed to https://nfc-tag-tracker.beatsev.workers.dev
  - [x] Account ID configured in wrangler.toml
- [x] SSL/TLS setup (automatic via Cloudflare)
- [x] Production testing
  - [x] Tag landing page verified (/t/PROD123)
  - [x] Location sharing tested and verified
  - [x] Scan events logging confirmed
  - [x] Dashboard auth protection verified
- [x] Test data inserted (user, object, tag)
- [x] Documentation complete (README.md with deployment instructions)

## Core User Flows

### 1. Owner Setup Flow
1. Owner logs into dashboard
2. Creates an "object" record (e.g., "Laptop bag")
3. Assigns a new NFC tag with unique ID (e.g., `ABC123`)
4. System generates URL: `https://yourdomain.com/t/ABC123`
5. Owner writes URL to physical NFC tag using NFC Tools app
6. Attaches tag to item

### 2. Finder Scan Flow
1. Finder's phone touches NFC tag
2. Phone reads NDEF URI and opens URL in browser
3. Landing page loads showing:
   - Item name and optional photo
   - "This item is lost" message
   - Contact owner form
   - Optional location sharing button
4. Finder can:
   - Send message to owner (with optional contact info)
   - Share precise location (browser permission required)
   - Mark item as delivered (future)

### 3. Owner Notification Flow
1. Tag scan triggers:
   - D1 database write (scan event)
   - Owner notification (email/webhook)
2. Owner receives alert with:
   - Item name
   - Scan timestamp
   - Approximate location (from IP)
   - Link to scan history
3. If finder sends message:
   - Additional notification with message content
   - Optional finder contact info

## Technical Architecture

### Stack
- **Cloudflare Workers**: All HTTP endpoints and logic
- **Cloudflare KV**: Fast read cache for tag lookups
- **Cloudflare D1**: Primary SQL database for structured data
- **Optional**: R2 for object photos

### Why This Stack
- Edge-native, global low latency
- Minimal cost at low-medium scale
- No server management
- Strong privacy controls (data residency)

## Data Model

### D1 Schema (Source of Truth)

#### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- ULID or UUID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);
```

#### `objects`
```sql
CREATE TABLE objects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,            -- e.g., "Laptop bag"
  description TEXT,
  photo_url TEXT,                -- R2 or external CDN
  status TEXT NOT NULL,          -- 'active' | 'lost' | 'recovered'
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `tags`
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,           -- Short ID used in URL (e.g., ABC123)
  object_id TEXT NOT NULL,
  label TEXT,                    -- Optional alias like "Outer tag"
  active INTEGER NOT NULL,       -- 0 or 1
  created_at TEXT NOT NULL,
  FOREIGN KEY (object_id) REFERENCES objects(id)
);
```

#### `scan_events`
```sql
CREATE TABLE scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  ip_hash TEXT,                  -- Hashed for privacy
  user_agent TEXT,
  approx_location TEXT,          -- City/region from IP
  lat REAL,                      -- Browser geolocation if consented
  lng REAL,
  source TEXT,                   -- 'landing_page' | 'api'
  FOREIGN KEY (tag_id) REFERENCES tags(id),
  FOREIGN KEY (object_id) REFERENCES objects(id)
);
```

#### `finder_messages`
```sql
CREATE TABLE finder_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_event_id INTEGER NOT NULL,
  tag_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  message TEXT NOT NULL,
  contact TEXT,                  -- Email/phone or pseudonym
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_event_id) REFERENCES scan_events(id)
);
```

#### `owner_notifications`
```sql
CREATE TABLE owner_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_event_id INTEGER NOT NULL,
  channel TEXT NOT NULL,         -- 'email' | 'webhook' | 'push'
  status TEXT NOT NULL,          -- 'sent' | 'failed'
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_event_id) REFERENCES scan_events(id)
);
```

### KV Layout (Hot Path Cache)

**Namespace**: `TAGS_KV`

- **`tag:<tagId>`** → JSON:
  ```json
  {
    "object_id": "obj_123",
    "user_id": "user_1",
    "status": "active",
    "name": "Laptop bag",
    "photo_url": "https://..."
  }
  ```

- **`user-config:<userId>`** → JSON:
  ```json
  {
    "email": "owner@example.com",
    "notify_on_every_scan": true,
    "webhook_url": "https://...",
    "notification_channel": "email"
  }
  ```

**Strategy**: Worker checks KV first; on miss, queries D1 and backfills KV.

## API Specification

### Public Endpoints (Finder)

#### `GET /t/:tagId`
- Look up tag in KV → D1 fallback
- Log scan event to D1
- Trigger owner notification
- Render landing page HTML

**Response**: HTML page with object info and action buttons

#### `POST /api/t/:tagId/message`
**Request Body**:
```json
{
  "scan_event_id": 123,
  "message": "Found your bag at the airport",
  "contact": "finder@example.com"  // optional
}
```
**Actions**:
- Insert into `finder_messages`
- Trigger owner notification

#### `POST /api/t/:tagId/location`
**Request Body**:
```json
{
  "scan_event_id": 123,
  "lat": 37.7749,
  "lng": -122.4194,
  "accuracy": 10
}
```
**Actions**:
- Update `scan_events` row with coordinates

### Owner Dashboard API

#### `GET /api/objects`
- List all objects for authenticated user
- **Auth**: Required

#### `POST /api/objects`
**Request Body**:
```json
{
  "name": "Laptop bag",
  "description": "Black messenger bag",
  "photo_url": "https://..."
}
```

#### `PATCH /api/objects/:id`
**Request Body**:
```json
{
  "name": "Updated name",
  "status": "recovered"
}
```

#### `POST /api/tags`
**Request Body**:
```json
{
  "tag_id": "ABC123",
  "object_id": "obj_456",
  "label": "Inside pocket tag"
}
```

#### `GET /api/tags/:tagId/scans?limit=50`
**Response**:
```json
{
  "scans": [
    {
      "id": 123,
      "ts": "2025-12-20T14:30:00Z",
      "approx_location": "San Francisco, CA",
      "lat": 37.7749,
      "lng": -122.4194,
      "has_message": true
    }
  ]
}
```

#### `GET /api/messages?object_id=...`
**Response**:
```json
{
  "messages": [
    {
      "id": 45,
      "scan_event_id": 123,
      "message": "Found at airport",
      "contact": "finder@example.com",
      "created_at": "2025-12-20T14:35:00Z"
    }
  ]
}
```

## Notification System

### Channels

1. **Email (via API)**
   - SendGrid / Mailgun / Postmark
   - Worker calls external API via `fetch`

2. **Webhook**
   - Telegram / Discord / Slack
   - POST JSON to configured `webhook_url`

3. **Web Push** (future)
   - Browser-based notifications

### Notification Triggers

- **On every scan**: Optional per-user config
- **On finder message**: Always
- **On location share**: Always

### Notification Payload
```json
{
  "event": "scan",
  "tag_id": "ABC123",
  "object_name": "Laptop bag",
  "timestamp": "2025-12-20T14:30:00Z",
  "approx_location": "San Francisco, CA",
  "has_message": true,
  "message_preview": "Found at airport...",
  "dashboard_link": "https://yourdomain.com/dashboard/objects/obj_123"
}
```

## Request Lifecycle: Tag Scan

1. **Phone scans NFC** → Opens `https://yourdomain.com/t/ABC123`

2. **Worker `GET /t/ABC123`**:
   ```javascript
   // Check KV cache
   let tagData = await env.TAGS_KV.get("tag:ABC123", "json");

   if (!tagData) {
     // Query D1
     const result = await env.DB.prepare(
       "SELECT t.*, o.name, o.photo_url, o.user_id FROM tags t JOIN objects o ON t.object_id = o.id WHERE t.id = ?"
     ).bind("ABC123").first();

     if (!result) return new Response("Tag not found", { status: 404 });

     // Backfill KV
     tagData = { object_id: result.object_id, name: result.name, ... };
     await env.TAGS_KV.put("tag:ABC123", JSON.stringify(tagData));
   }

   // Log scan event
   const scanEvent = await env.DB.prepare(
     "INSERT INTO scan_events (tag_id, object_id, ts, ip_hash, user_agent, approx_location) VALUES (?, ?, ?, ?, ?, ?)"
   ).bind(
     "ABC123",
     tagData.object_id,
     new Date().toISOString(),
     hashIP(request.headers.get("CF-Connecting-IP")),
     request.headers.get("User-Agent"),
     request.cf.city + ", " + request.cf.region
   ).run();

   // Trigger notification
   await notifyOwner(tagData.user_id, scanEvent.lastInsertRowid);

   // Render landing page
   return new Response(renderLandingPage(tagData, scanEvent.lastInsertRowid), {
     headers: { "Content-Type": "text/html" }
   });
   ```

3. **Finder actions** (optional):
   - JS calls `POST /api/t/ABC123/message` with form data
   - JS calls `POST /api/t/ABC123/location` with geolocation coords

## Frontend: Landing Page

### Requirements
- Fast load (<500ms)
- Mobile-first responsive
- No login required for finder
- Clear privacy messaging

### Layout
```
┌─────────────────────────────┐
│  [Photo of item]            │
│                             │
│  Lost Item Found!           │
│  This laptop bag is lost.   │
│  Please help return it.     │
│                             │
│  ┌───────────────────────┐  │
│  │ Message to owner      │  │
│  │ [textarea]            │  │
│  │ Your email (optional) │  │
│  │ [input]               │  │
│  │ [Send Message]        │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ [Share My Location]   │  │
│  └───────────────────────┘  │
│                             │
│  Privacy: We log scan time, │
│  approximate location (IP), │
│  and any info you provide.  │
└─────────────────────────────┘
```

### Tech Options
- **Minimal**: Plain HTML + CSS + vanilla JS
- **Enhanced**: HTMX or Alpine.js for interactivity
- **Framework**: Not required for landing page

## Frontend: Owner Dashboard

### Requirements
- Authenticated access only
- CRUD for objects and tags
- View scan history with map
- View finder messages
- Configure notification settings

### Pages
1. **Objects List**
   - Grid/list of all objects
   - Status badges (active/lost/recovered)
   - Quick actions: Edit, View scans

2. **Object Detail**
   - Edit object info
   - Scan history table with timestamps and locations
   - Map view of scan locations
   - Attached tags list

3. **Tags Manager**
   - Assign new tag to object
   - Generate QR code for NFC programming
   - Deactivate tags

4. **Messages Inbox**
   - List all finder messages
   - Mark as read/resolved
   - Reply via email (future)

5. **Settings**
   - Notification preferences
   - Webhook configuration
   - Account info

### Tech Options
- **Simple**: Server-rendered HTML with forms
- **SPA**: React/Vue/Svelte served from Workers/Pages
- **Hybrid**: HTMX with server-rendered partials

## Authentication

### Phase 1 (MVP)
- **Magic link** email-based auth
- Store `users` table in D1
- JWT in cookie or localStorage
- No passwords

### Implementation
```javascript
// POST /api/auth/login
// Send magic link email with token
// GET /api/auth/verify?token=...
// Set session cookie, redirect to dashboard
```

### Phase 2 (Future)
- OAuth (Google, Apple)
- Multi-user accounts
- Team/organization support

## Privacy & Compliance

### Data Collection Transparency
- Clear messaging on landing page
- Privacy policy link
- Cookie consent banner (if in EU)

### Data Logged
- **Without consent**: Timestamp, IP (hashed), user agent, approximate location (city-level)
- **With consent**: Precise GPS coordinates, finder contact info

### GDPR Considerations
- Data retention policy (auto-delete scans after X months)
- User data export/deletion
- Lawful basis: Legitimate interest (lost property recovery)

### Security
- Hash IP addresses for storage
- HTTPS only
- Rate limiting on public endpoints
- Input sanitization and validation

## NFC Tag Programming

### Tag Types
- **Recommended**: NTAG213, NTAG215, NTAG216
- **Capacity**: 144-888 bytes (sufficient for URL)
- **Security**: Optional password protection

### NDEF Record Format
```
Record Type: URI (U)
URI Identifier: https://
Payload: yourdomain.com/t/ABC123
```

### Tools
- **Mobile**: NFC Tools (iOS/Android)
- **Hardware**: ACR122U USB NFC reader/writer
- **Process**:
  1. Generate tag ID in dashboard
  2. Write URL to tag
  3. Test scan
  4. Apply tag to item

### Advanced Features (Future)
- Read counter mirroring in URL (`/t/ABC123?c=5`)
- Tamper detection (permanent lock after first write)
- UID mirroring for additional verification

## Non-Functional Requirements

### Performance
- Landing page load: <500ms (global)
- API response: <200ms (p95)
- KV read: <50ms
- D1 write: <100ms

### Scalability
- Support 10,000 tags initially
- 1,000 scans/day
- Horizontal scaling via Cloudflare's global network

### Reliability
- 99.9% uptime (Cloudflare SLA)
- Graceful degradation if D1 slow (serve cached KV data)
- Retry logic for notifications

### Cost
- Target: <$5/month for MVP usage
- KV: Free tier (1 GB, 100k reads/day)
- D1: Free tier (5 GB storage, 5M rows read/day)
- Workers: Free tier (100k requests/day)

## Out of Scope (v1)

- Mobile native apps
- Real-time WebSocket updates
- Blockchain/NFT integration
- Reward system for finders
- Multi-language support
- Admin panel for multiple users
- Marketplace for NFC tags

## Success Metrics

### User Metrics
- Number of registered objects
- Number of active tags
- Scans per tag per month
- Message-to-scan ratio
- Recovery rate (items marked recovered)

### Technical Metrics
- P95 response time
- Error rate
- KV cache hit ratio
- Notification delivery success rate

### Business Metrics (if monetized)
- Monthly active users
- Subscription conversion rate
- Customer acquisition cost
- Churn rate

## Launch Plan

### Phase 1: MVP (Weeks 1-2)
- D1 schema + migrations
- Worker with core routes
- Basic landing page (HTML/CSS/JS)
- Email notifications
- No auth (single hardcoded user)

### Phase 2: Dashboard (Weeks 3-4)
- Magic link authentication
- Object/tag CRUD
- Scan history view
- Message inbox

### Phase 3: Polish (Weeks 5-6)
- Map visualization
- Webhook notifications
- Settings page
- Mobile responsive refinements

### Phase 4: Beta Launch
- Invite 10-20 beta users
- Gather feedback
- Iterate on UX
- Fix bugs

### Phase 5: Public Launch
- Marketing site
- Documentation
- Blog post
- Social media announcement

## Open Questions

1. **Notification preference**: Email API provider (SendGrid, Mailgun, Postmark) or webhook (Discord, Telegram)?
2. **Dashboard framework**: Server-rendered, SPA, or HTMX hybrid?
3. **Photo storage**: Cloudflare R2, external CDN, or base64 in D1?
4. **Multi-tag per object**: Allow multiple tags per object in MVP?
5. **Anonymous finders**: Allow messages without any contact info?
6. **Rate limiting**: How aggressive on public endpoints?
7. **Tag ID format**: Random alphanumeric, ULID, or sequential?

## Next Steps

1. Choose email/webhook notification channel
2. Choose dashboard framework
3. Set up Cloudflare account + Workers project
4. Create D1 database and run initial migrations
5. Create KV namespace
6. Implement core Worker routes
7. Build landing page prototype
8. Order sample NFC tags for testing
9. Test end-to-end flow with physical tag
10. Deploy to production and test with real phone

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [NFC NDEF Specification](https://nfc-forum.org/our-work/specifications-and-application-documents/specifications/nfc-forum-technical-specifications/)
- [Android NFC Guide](https://developer.android.com/develop/connectivity/nfc/nfc)
