import { Hono } from 'hono';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

// GET /admin/telegram-updates - Fetch recent Telegram updates to get chat IDs
app.get('/admin/telegram-updates', async (c) => {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/getUpdates`
    );

    const data = await response.json() as any;

    if (!data.ok) {
      return c.json({ error: 'Failed to fetch updates', details: data }, 500);
    }

    // Extract chat IDs from recent messages
    const updates = data.result || [];
    const chatIds = updates
      .map((update: any) => ({
        chat_id: update.message?.chat?.id || update.message?.from?.id,
        username: update.message?.from?.username,
        first_name: update.message?.from?.first_name,
        text: update.message?.text,
        date: new Date((update.message?.date || 0) * 1000).toISOString(),
      }))
      .filter((item: any) => item.chat_id);

    return c.json({
      message: 'Recent Telegram messages',
      updates: chatIds,
      instructions: 'Copy your chat_id from the list above',
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch Telegram updates', details: String(error) }, 500);
  }
});

export default app;
