# NFC Tag Lost & Found Tracking System

A serverless web application for tracking lost items via NFC tags. When someone scans an NFC tag attached to a lost item, the owner receives instant notifications via Telegram and can communicate with the finder through a privacy-preserving interface.

## Features

✅ **Self-Service Signup** - Friends and family can create accounts via Telegram bot
✅ **NFC Tag Scanning** - Instant landing pages when tags are scanned
✅ **Telegram Notifications** - Real-time alerts when your items are found
✅ **Finder Messages** - Anonymous communication between finders and owners
✅ **Location Sharing** - GPS coordinates with finder consent
✅ **Dashboard** - Manage objects, tags, and view scan history
✅ **Map Visualization** - See where your items have been scanned
✅ **Privacy First** - IP hashing, optional contact sharing
✅ **Serverless** - Built on Cloudflare Workers (edge-native, global)

## Tech Stack

- **Cloudflare Workers** - Edge computing platform
- **Cloudflare D1** - SQLite database (8 migrations)
- **Cloudflare KV** - Read-through cache for tag lookups
- **Hono** - Web framework
- **HTMX** - Progressive enhancement
- **Leaflet.js** - Interactive maps
- **Telegram Bot API** - Free notifications
- **TypeScript** - Type safety

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Telegram bot token ([create one](https://t.me/BotFather))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/nfctagfindmystuff.git
   cd nfctagfindmystuff
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create Cloudflare resources**

   Create D1 database:
   ```bash
   npx wrangler d1 create findmy_tags
   ```

   Create KV namespace:
   ```bash
   npx wrangler kv:namespace create TAGS_KV
   ```

4. **Update wrangler.toml**

   Replace the IDs with your own from the previous step:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "findmy_tags"
   database_id = "YOUR_D1_DATABASE_ID"

   [[kv_namespaces]]
   binding = "TAGS_KV"
   id = "YOUR_KV_NAMESPACE_ID"
   ```

5. **Create .dev.vars file**
   ```bash
   cp .dev.vars.example .dev.vars
   ```

   Edit `.dev.vars` with your credentials:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   JWT_SECRET=your_jwt_secret
   MAGIC_LINK_SECRET=your_magic_link_secret
   ```

6. **Run migrations**
   ```bash
   npx wrangler d1 migrations apply findmy_tags --local
   ```

7. **Start development server**
   ```bash
   npx wrangler dev
   ```

   Server will be available at `http://localhost:8787`

## Creating Your Account

### Self-Service Signup (Recommended)

New users can create accounts without manual setup:

1. **Message the bot** on Telegram: [@your_nfc_bot_bot](https://t.me/Nfcstufffinderbottagger_bot)
2. **Send `/start` command**
3. **Click the signup link** you receive (valid for 1 hour)
4. **Fill in your email and name**
5. **Start creating tags!** You'll be logged in automatically

### Manual Setup (Advanced)

For development/testing, you can manually insert test data:

```bash
npx wrangler d1 execute findmy_tags --local --command "
INSERT INTO users (id, email, name, telegram_chat_id)
VALUES ('user_test123', 'you@example.com', 'Test User', 'YOUR_TELEGRAM_CHAT_ID');

INSERT INTO objects (id, user_id, name, description, status)
VALUES ('obj_test456', 'user_test123', 'Test Item', 'My test item', 'active');

INSERT INTO tags (id, object_id, active)
VALUES ('DEMO123', 'obj_test456', 1);
"
```

**Get Your Telegram Chat ID:**
1. Message your bot on Telegram
2. Visit `http://localhost:8787/admin/telegram-updates`
3. Find your `chat_id` in the response

## Usage

### For Owners

1. **Sign Up** - Message [@your_nfc_bot_bot](https://t.me/Nfcstufffinderbottagger_bot) and send `/start`
2. **Complete Signup** - Click the link and fill in your email and name
3. **Add Objects** - Create objects you want to track in the dashboard
4. **Create Tags** - Generate NFC tag IDs and link them to objects
5. **Program NFC Tags** - Use NFC Tools app to write the URL to physical tags
6. **Get Notified** - Receive instant Telegram alerts when tags are scanned

### For Finders

1. **Scan Tag** - Tap your phone to the NFC tag
2. **View Landing Page** - See item details and owner contact options
3. **Send Message** - Optionally leave a message and contact info
4. **Share Location** - Optionally share GPS coordinates

## Project Structure

```
nfctagfindmystuff/
├── src/
│   ├── index.ts                 # Main worker entry point
│   ├── lib/
│   │   ├── crypto.ts            # IP hashing utilities
│   │   └── jwt.ts               # JWT helpers
│   ├── middleware/
│   │   ├── auth.ts              # Authentication middleware
│   │   └── rate-limit.ts        # Rate limiting
│   ├── routes/
│   │   ├── admin.ts             # Admin endpoints
│   │   ├── api-dashboard.ts     # Dashboard API
│   │   ├── api-finder.ts        # Finder endpoints
│   │   ├── auth.ts              # Auth & signup routes
│   │   ├── dashboard.ts         # Dashboard UI
│   │   ├── public.ts            # Public landing pages
│   │   └── telegram-webhook.ts  # Bot webhook handler
│   ├── services/
│   │   ├── scan-event.ts        # Scan logging
│   │   ├── tag-lookup.ts        # KV + D1 cache
│   │   └── telegram.ts          # Notifications
│   ├── types/
│   │   └── env.ts               # TypeScript types
│   └── views/
│       ├── dashboard-page.ts    # Dashboard HTML
│       ├── landing-page.ts      # Finder landing page
│       ├── login-page.ts        # Login form
│       └── signup-page.ts       # Signup form
├── migrations/                  # Database migrations (8 files)
├── public/
│   └── styles.css              # Global styles
├── wrangler.toml               # Cloudflare configuration
└── package.json
```

## API Endpoints

### Public (No Auth)

- `GET /t/:tagId` - Landing page for finders
- `POST /api/t/:tagId/message` - Send message to owner
- `POST /api/t/:tagId/location` - Share GPS location

### Authentication & Signup

- `GET /login` - Login page
- `POST /api/auth/login` - Send magic link
- `GET /api/auth/verify?token=...` - Verify token
- `GET /signup?token=...` - Signup page
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/logout` - Logout

### Telegram Bot

- `POST /api/telegram/webhook` - Receive bot messages (handles `/start` command)

### Dashboard (Auth Required)

- `GET /dashboard` - Objects list
- `GET /dashboard/objects/:id` - Object detail with tabs
- `GET /dashboard/messages` - Messages inbox
- `POST /dashboard/objects` - Create object
- `POST /dashboard/objects/:id/tags` - Add tag

### Dashboard API (Auth Required)

- `GET /api/objects` - List objects
- `POST /api/objects` - Create object
- `PATCH /api/objects/:id` - Update object
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:tagId` - Update tag
- `GET /api/tags/:tagId/scans` - Scan history
- `GET /api/messages` - Finder messages

## Security Features

- **IP Hashing** - SHA-256 hashing of IP addresses
- **Rate Limiting** - Protects public endpoints from abuse
- **HTTP-Only Cookies** - Session tokens not accessible to JavaScript
- **ARIA Labels** - Accessibility improvements
- **Input Validation** - Zod schemas on all endpoints
- **Ownership Verification** - All operations check user permissions

## Performance

- **KV Caching** - 24-hour TTL for tag lookups
- **Read-Through Cache** - KV → D1 fallback pattern
- **Non-Blocking Notifications** - Using `ctx.waitUntil()`
- **Edge Computing** - Global distribution via Cloudflare

## Deployment

### Production Deployment

1. **Run migrations on production**
   ```bash
   npx wrangler d1 migrations apply findmy_tags --remote
   ```

2. **Set production secrets**
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put MAGIC_LINK_SECRET
   ```

3. **Deploy to Cloudflare**
   ```bash
   npx wrangler deploy
   ```

4. **Configure custom domain** (optional)
   - Add domain in Cloudflare dashboard
   - Update DOMAIN in wrangler.toml

## Development Commands

```bash
# Start dev server
npm run dev

# Type checking
npm run check

# Apply migrations (local)
npx wrangler d1 migrations apply findmy_tags --local

# Apply migrations (production)
npx wrangler d1 migrations apply findmy_tags --remote

# Query database (local)
npx wrangler d1 execute findmy_tags --local --command "SELECT * FROM tags"

# Deploy to production
npm run deploy
```

## Contributing

This is a personal project, but suggestions and bug reports are welcome!

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code)
- NFC technology inspiration from Apple AirTag and Tile
- Serverless architecture powered by Cloudflare Workers

## Support

For issues or questions:
- Create an issue on GitHub
- Check the PRD.md for detailed architecture docs
- Review CLAUDE.md for development patterns
