import type { Env } from '../types/env';
import type { NotificationPayload } from './telegram';

const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';

async function agentMailSend(
  inboxId: string,
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(`${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, subject, html, text }),
    });

    if (!response.ok) {
      console.error('AgentMail error:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('AgentMail request failed:', error);
    return false;
  }
}

/**
 * Send a scan/message notification email to the owner
 */
export async function sendEmailNotification(
  payload: NotificationPayload,
  ownerEmail: string,
  env: Env
): Promise<void> {
  const title = payload.hasMessage ? 'New Finder Message' : 'Tag Scanned';
  const emoji = payload.hasMessage ? '💬' : '🔍';
  const subject = `${emoji} ${title}: ${payload.objectName}`;

  const locationLine = payload.approxLocation
    ? `<p><strong>Location:</strong> ${payload.approxLocation}</p>`
    : '';
  const messageLine = payload.messagePreview
    ? `<p><strong>Message from finder:</strong><br><em>"${payload.messagePreview}"</em></p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
  <h2 style="color: #667eea;">${emoji} ${title}</h2>
  <p><strong>Item:</strong> ${payload.objectName}</p>
  <p><strong>Tag ID:</strong> <code>${payload.tagId}</code></p>
  ${locationLine}
  ${messageLine}
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p><a href="${env.DOMAIN}/dashboard" style="background: #667eea; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Dashboard</a></p>
</body>
</html>`;

  const text = [
    `${title}: ${payload.objectName}`,
    `Tag: ${payload.tagId}`,
    payload.approxLocation ? `Location: ${payload.approxLocation}` : null,
    payload.messagePreview ? `Message: "${payload.messagePreview}"` : null,
    `Dashboard: ${env.DOMAIN}/dashboard`,
  ].filter(Boolean).join('\n');

  const ok = await agentMailSend(
    env.AGENTMAIL_INBOX_ID,
    env.AGENTMAIL_API_KEY,
    ownerEmail,
    subject,
    html,
    text
  );

  const status = ok ? 'sent' : 'failed';
  await env.DB.prepare(`
    INSERT INTO owner_notifications (scan_event_id, channel, status)
    VALUES (?, 'email', ?)
  `).bind(payload.scanEventId, status).run();
}

/**
 * Send a magic link login email
 */
export async function sendMagicLinkEmail(
  toEmail: string,
  magicLink: string,
  env: Env
): Promise<boolean> {
  const subject = 'Your NFC Tracker login link';

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
  <h2 style="color: #667eea;">Dashboard Login</h2>
  <p>Click the button below to log in to your dashboard:</p>
  <p style="margin: 32px 0;">
    <a href="${magicLink}" style="background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px;">
      Log in to Dashboard
    </a>
  </p>
  <p style="color: #888; font-size: 13px;">This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>
  <p style="color: #bbb; font-size: 12px; margin-top: 24px;">Or copy this URL: ${magicLink}</p>
</body>
</html>`;

  const text = `Log in to your NFC Tracker dashboard:\n\n${magicLink}\n\nExpires in 15 minutes.`;

  return agentMailSend(
    env.AGENTMAIL_INBOX_ID,
    env.AGENTMAIL_API_KEY,
    toEmail,
    subject,
    html,
    text
  );
}
