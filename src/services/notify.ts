import type { Env } from '../types/env';
import { sendTelegramNotification, type NotificationPayload } from './telegram';
import { sendEmailNotification } from './email';

export type { NotificationPayload };

/**
 * Dispatch a scan/message notification to the owner via their preferred channel(s).
 * Fetches the user's email + notification_channel from DB.
 */
export async function sendNotification(
  payload: NotificationPayload,
  env: Env
): Promise<void> {
  const user = await env.DB.prepare(
    'SELECT email, notification_channel, telegram_chat_id FROM users WHERE id = ?'
  ).bind(payload.userId).first<{ email: string; notification_channel: string; telegram_chat_id: string | null }>();

  if (!user) {
    console.warn(`sendNotification: user ${payload.userId} not found`);
    return;
  }

  const channel = user.notification_channel ?? 'telegram';
  const tasks: Promise<void>[] = [];

  if ((channel === 'telegram' || channel === 'both') && user.telegram_chat_id) {
    tasks.push(sendTelegramNotification(payload, env, user.telegram_chat_id));
  }

  if (channel === 'email' || channel === 'both') {
    tasks.push(sendEmailNotification(payload, user.email, env));
  }

  await Promise.all(tasks);
}
