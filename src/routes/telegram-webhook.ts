import { Hono } from 'hono';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// POST /api/telegram/webhook - Receive updates from Telegram Bot
app.post('/api/telegram/webhook', async (c) => {
  try {
    const update: TelegramUpdate = await c.req.json();

    // Only process messages (ignore other update types)
    if (!update.message || !update.message.text) {
      return c.json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // Handle /start command for signup
    if (text === '/start' || text.startsWith('/start ')) {
      // Generate unique signup token
      const signupToken = crypto.randomUUID();

      // Store token -> chat_id mapping in KV (1 hour expiry)
      await c.env.TAGS_KV.put(
        `signup:${signupToken}`,
        chatId,
        { expirationTtl: 3600 } // 1 hour
      );

      // Send signup link to user
      const signupUrl = `${c.env.DOMAIN}/signup?token=${signupToken}`;
      const welcomeMessage = `Welcome to NFC Tag Tracker! 🎉

Click the link below to complete your signup:
${signupUrl}

This link expires in 1 hour.`;

      await fetch(
        `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeMessage,
          }),
        }
      );

      return c.json({ ok: true });
    }

    // Handle other commands or messages (optional)
    if (text === '/help') {
      const helpMessage = `*NFC Tag Tracker Bot* 📦

Commands:
/start - Get your signup link
/help - Show this help message

Need to create an account? Use /start to get started!`;

      await fetch(
        `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpMessage,
            parse_mode: 'Markdown',
          }),
        }
      );

      return c.json({ ok: true });
    }

    // Default response for unrecognized commands
    return c.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return c.json({ ok: false, error: 'Internal error' }, 500);
  }
});

export default app;
