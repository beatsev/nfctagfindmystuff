# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NFC Tag Lost & Found Tracking System - A serverless application built on Cloudflare Workers that enables tracking of lost items via NFC tags. When someone scans an NFC tag, the owner receives notifications and can communicate with the finder through a privacy-preserving interface.

## Architecture

### Stack
- **Cloudflare Workers**: All HTTP routing and business logic
- **Cloudflare D1**: Primary SQL database (users, objects, tags, scan_events, finder_messages, owner_notifications)
- **Cloudflare KV**: Read-through cache for hot-path tag lookups
- **Optional**: Cloudflare R2 for object photos

### Key Design Patterns

**Two-tier data strategy**:
- D1 is the source of truth for all relational data
- KV serves as a read-through cache: check KV first, on miss load from D1 and backfill KV
- KV keys: `tag:<tagId>` (tag metadata), `user-config:<userId>` (notification preferences)

**Request flow for tag scans**:
1. Phone scans NFC tag → Opens `https://yourdomain.com/t/:tagId`
2. Worker checks `TAGS_KV.get("tag:<tagId>")` for cached tag data
3. On KV miss: Query D1 `tags` join `objects`, write result back to KV
4. Log scan event to D1 `scan_events` table (with IP hash, user agent, approximate location from CF request metadata)
5. Trigger owner notification (email API or webhook)
6. Render landing page HTML with embedded scan_event_id

**Privacy model**:
- Always log: timestamp, hashed IP, user agent, approximate city/region (from `request.cf.city`, `request.cf.region`)
- Only with consent: precise GPS coordinates (browser geolocation API), finder contact info

## Database Schema

### Core Tables

**users**: `id` (TEXT PK), `email` (UNIQUE), `name`, `created_at`

**objects**: `id` (TEXT PK), `user_id` (FK), `name`, `description`, `photo_url`, `status` ('active'|'lost'|'recovered'), `created_at`

**tags**: `id` (TEXT PK, used in URL), `object_id` (FK), `label`, `active` (0/1), `created_at`

**scan_events**: `id` (INT PK AUTOINCREMENT), `tag_id`, `object_id`, `ts`, `ip_hash`, `user_agent`, `approx_location`, `lat`, `lng`, `source`

**finder_messages**: `id` (INT PK AUTOINCREMENT), `scan_event_id` (FK), `tag_id`, `object_id`, `message`, `contact`, `created_at`

**owner_notifications**: `id` (INT PK AUTOINCREMENT), `scan_event_id`, `channel`, `status`, `created_at`

### Relationships
- One user has many objects
- One object has many tags (allows multiple tags per item, e.g., inside and outside pocket)
- One tag has many scan_events
- One scan_event can have one finder_message

## API Routes

### Public (Finder-facing)

**`GET /t/:tagId`**
Main landing page for finders. Performs KV lookup, D1 fallback, logs scan event, triggers notification, renders HTML.

**`POST /api/t/:tagId/message`**
Body: `{ scan_event_id, message, contact? }`
Creates finder_message record, triggers owner notification.

**`POST /api/t/:tagId/location`**
Body: `{ scan_event_id, lat, lng, accuracy? }`
Updates scan_events row with precise coordinates.

### Owner Dashboard (Auth Required)

**`GET /api/objects`** - List user's objects
**`POST /api/objects`** - Create object
**`PATCH /api/objects/:id`** - Update object metadata/status
**`POST /api/tags`** - Link new tag to object
**`GET /api/tags/:tagId/scans?limit=50`** - Scan history for tag
**`GET /api/messages?object_id=...`** - Finder messages for object

### Auth Endpoints (MVP)

**`POST /api/auth/login`** - Send magic link email
**`GET /api/auth/verify?token=...`** - Verify token, set session cookie

## Cloudflare Bindings

**wrangler.toml configuration**:
```toml
[[kv_namespaces]]
binding = "TAGS_KV"
id = "..."

[[d1_databases]]
binding = "DB"
database_name = "findmy_tags"
database_id = "..."
```

**In Worker code**:
- `env.TAGS_KV.get(key)` / `env.TAGS_KV.put(key, value)`
- `env.DB.prepare(sql).bind(...).run()` / `.first()` / `.all()`

## Development Workflow

### Local Development
```bash
npx wrangler dev              # Start local dev server with bindings
npx wrangler d1 execute findmy_tags --local --file=./schema.sql
```

### Database Migrations
```bash
npx wrangler d1 migrations create findmy_tags <migration_name>
npx wrangler d1 migrations apply findmy_tags --local
npx wrangler d1 migrations apply findmy_tags --remote
```

### Deployment
```bash
npx wrangler deploy           # Deploy to production
```

## Notification Implementation

Notifications are triggered from Worker after scan event or message creation:

**Email**: Call external API (SendGrid/Mailgun/Postmark) via `fetch()`
**Webhook**: POST JSON to user's configured `webhook_url` (Discord/Telegram/Slack)

Load user notification config from KV (`user-config:<userId>`) to determine channel and preferences.

## Security Considerations

- **IP Privacy**: Hash IP addresses before storing in `scan_events.ip_hash`
- **Input Validation**: Sanitize all user inputs (finder messages, object names, etc.)
- **Rate Limiting**: Implement on public endpoints (`/t/:tagId`, `/api/t/:tagId/*`) to prevent abuse
- **Auth**: JWT in HTTP-only cookie for owner dashboard; magic link tokens expire after 15 minutes

## NFC Tag URL Structure

Tags are encoded with NDEF URI records:
`https://yourdomain.com/t/<tagId>`

Tag IDs should be short, random alphanumeric (consider ULID for sortability or crypto.randomUUID() for pure randomness).

## Performance Targets

- Landing page load: <500ms globally (edge caching)
- KV read: <50ms
- D1 write: <100ms
- API response: <200ms p95

## Current Status

Repository is in initial setup phase. Only PRD.md exists; no code has been written yet.

See PRD.md for complete product requirements, user flows, and implementation roadmap.
