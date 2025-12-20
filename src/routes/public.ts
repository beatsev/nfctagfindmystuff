import { Hono } from 'hono';
import type { Env } from '../types/env';
import { lookupTag } from '../services/tag-lookup';
import { logScanEvent } from '../services/scan-event';
import { sendTelegramNotification } from '../services/telegram';
import { renderLandingPage } from '../views/landing-page';

const app = new Hono<{ Bindings: Env }>();

// GET /t/:tagId - Landing page for finders
app.get('/t/:tagId', async (c) => {
  const tagId = c.req.param('tagId');

  // 1. Lookup tag (KV + D1 cache)
  const tagData = await lookupTag(tagId, c.env);

  if (!tagData) {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tag Not Found</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">❌</div>
      <h1>Tag Not Found</h1>
      <p class="description">This NFC tag is not registered in our system.</p>
      <div class="privacy">
        <small>If you believe this is an error, please contact the person who gave you this tag.</small>
      </div>
    </div>
  </div>
</body>
</html>`, 404);
  }

  // 2. Extract Cloudflare request metadata
  const cf = c.req.raw.cf as IncomingRequestCfProperties | undefined;
  const ipAddress = c.req.header('CF-Connecting-IP') || null;
  const userAgent = c.req.header('User-Agent') || null;

  // 3. Log scan event
  const scanEventId = await logScanEvent({
    tagId: tagData.tagId,
    objectId: tagData.objectId,
    ipAddress,
    userAgent,
    city: cf?.city || null,
    region: cf?.region || null,
    country: cf?.country || null,
  }, c.env);

  // 4. Send Telegram notification (async, non-blocking)
  const approxLocation = [cf?.city, cf?.region, cf?.country]
    .filter(Boolean)
    .join(', ') || null;

  c.executionCtx.waitUntil(
    sendTelegramNotification({
      userId: tagData.userId,
      objectName: tagData.objectName,
      tagId: tagData.tagId,
      scanEventId,
      approxLocation,
      hasMessage: false,
    }, c.env)
  );

  // 5. Render landing page
  const html = renderLandingPage({
    objectName: tagData.objectName,
    description: tagData.objectDescription,
    scanEventId,
    tagId,
  });

  return c.html(html);
});

export default app;
