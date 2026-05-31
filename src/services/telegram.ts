import type { Env } from '../types/env';

export interface NotificationPayload {
  userId: string;
  objectName: string;
  tagId: string;
  scanEventId: number;
  approxLocation: string | null;
  hasMessage: boolean;
  messagePreview?: string;
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry fetch with exponential backoff
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default 3)
 * @returns Response object
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success - return immediately
      if (response.ok) {
        if (attempt > 1) {
          console.log(`✅ Telegram API succeeded on attempt ${attempt}`);
        }
        return response;
      }

      // Client errors (4xx) - don't retry, these are permanent
      if (response.status >= 400 && response.status < 500) {
        console.error(`❌ Telegram API client error ${response.status}, not retrying`);
        return response;
      }

      // Server errors (5xx) or rate limit (429) - retry with backoff
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`⚠️ Telegram API attempt ${attempt} failed (${response.status}), retrying in ${waitTime}ms...`);
        await sleep(waitTime);
      } else {
        console.error(`❌ Telegram API failed after ${maxRetries} attempts (${response.status})`);
        return response;
      }
    } catch (error) {
      // Network errors, timeouts, etc.
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Telegram API network error on attempt ${attempt}, retrying in ${waitTime}ms...`);
        await sleep(waitTime);
      } else {
        console.error(`❌ Telegram API network error after ${maxRetries} attempts`);
        throw error;
      }
    }
  }

  throw new Error('Unexpected: retry loop completed without return');
}

/**
 * Escape special characters for Telegram Markdown
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Send a Telegram notification to the owner
 * @param payload - Notification data
 * @param env - Cloudflare environment bindings
 * @param chatId - Pre-fetched Telegram chat ID (avoids extra DB query)
 */
export async function sendTelegramNotification(
  payload: NotificationPayload,
  env: Env,
  chatId?: string
): Promise<void> {
  // Use provided chatId or fetch from DB as fallback
  if (!chatId) {
    const user = await env.DB.prepare(
      'SELECT telegram_chat_id FROM users WHERE id = ?'
    ).bind(payload.userId).first();
    chatId = user?.telegram_chat_id as string | undefined;
  }

  if (!chatId) {
    console.warn(`No Telegram chat ID for user ${payload.userId}`);
    return;
  }

  // Format message
  const emoji = payload.hasMessage ? '💬' : '🔍';
  const title = payload.hasMessage ? 'New Finder Message!' : 'Tag Scanned!';

  let message = `${emoji} *${title}*\n\n`;
  message += `📦 Item: *${escapeMarkdown(payload.objectName)}*\n`;
  message += `🏷️ Tag: \`${payload.tagId}\`\n`;

  if (payload.approxLocation) {
    message += `📍 Location: ${escapeMarkdown(payload.approxLocation)}\n`;
  }

  if (payload.messagePreview) {
    message += `\n💬 Message:\n_"${escapeMarkdown(payload.messagePreview)}"_\n`;
  }

  message += `\n🔗 [View Dashboard](${env.DOMAIN}/dashboard)`;

  // Send via Telegram Bot API with retry logic
  try {
    const response = await fetchWithRetry(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      },
      3 // 3 retry attempts
    );

    const status = response.ok ? 'sent' : 'failed';

    // Log notification
    await env.DB.prepare(`
      INSERT INTO owner_notifications (scan_event_id, channel, status)
      VALUES (?, 'telegram', ?)
    `).bind(payload.scanEventId, status).run();

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
    } else {
      console.log(`Telegram notification sent to chat ${chatId}`);
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);

    // Log failed notification
    await env.DB.prepare(`
      INSERT INTO owner_notifications (scan_event_id, channel, status)
      VALUES (?, 'telegram', 'failed')
    `).bind(payload.scanEventId).run();
  }
}
