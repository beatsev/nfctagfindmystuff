import { Hono } from 'hono';
import type { Env } from '../types/env';
import { lookupTag } from '../services/tag-lookup';
import { logScanEvent } from '../services/scan-event';
import { sendTelegramNotification } from '../services/telegram';
import { renderLandingPage } from '../views/landing-page';
import { landingPageStyles } from '../views/landing-styles';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// GET /t/:tagId - Landing page for finders
app.get('/t/:tagId', rateLimitMiddleware(10, 60), async (c) => {
  const tagId = c.req.param('tagId');

  // 1. Lookup tag (KV + D1 cache, non-blocking KV backfill)
  const tagData = await lookupTag(tagId, c.env, c.executionCtx);

  if (!tagData) {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tag Not Found</title>
  <style>${landingPageStyles}</style>
</head>
<body class="landing-page">
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

  // 3. Generate scan event UUID upfront so we can return the response
  //    immediately without waiting for the D1 INSERT.
  const scanEventUuid = crypto.randomUUID();

  const approxLocation = [cf?.city, cf?.region, cf?.country]
    .filter(Boolean)
    .join(', ') || null;

  // 4. Defer scan event INSERT + notification to background (non-blocking)
  c.executionCtx.waitUntil(
    logScanEvent({
      uuid: scanEventUuid,
      tagId: tagData.tagId,
      objectId: tagData.objectId,
      ipAddress,
      userAgent,
      city: cf?.city || null,
      region: cf?.region || null,
      country: cf?.country || null,
    }, c.env).then((scanEventId) =>
      sendTelegramNotification({
        userId: tagData.userId,
        objectName: tagData.objectName,
        tagId: tagData.tagId,
        scanEventId,
        approxLocation,
        hasMessage: false,
      }, c.env)
    ).catch((err) => console.error('Background scan/notification error:', err))
  );

  // 5. Render landing page immediately (only waited for tag lookup)
  const html = renderLandingPage({
    objectName: tagData.objectName,
    description: tagData.objectDescription,
    scanEventId: scanEventUuid,
    tagId,
  });

  return c.html(html);
});

export default app;
