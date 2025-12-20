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
 */
export async function sendTelegramNotification(
  payload: NotificationPayload,
  env: Env
): Promise<void> {
  // Fetch user's Telegram chat ID from DB
  const user = await env.DB.prepare(
    'SELECT telegram_chat_id FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user || !user.telegram_chat_id) {
    console.warn(`No Telegram chat ID for user ${payload.userId}`);
    // Don't throw error - just log and continue
    return;
  }

  const chatId = user.telegram_chat_id as string;

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

  // Send via Telegram Bot API
  try {
    const response = await fetch(
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
      }
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
