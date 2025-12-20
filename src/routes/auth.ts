import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../types/env';
import { renderLoginPage } from '../views/login-page';
import { createMagicLinkToken, verifyMagicLinkToken, createSessionToken } from '../lib/jwt';
import { rateLimitMiddleware } from '../middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
});

// GET /login - Show login page
app.get('/login', (c) => {
  return c.html(renderLoginPage());
});

// POST /api/auth/login - Send magic link via Telegram
app.post(
  '/api/auth/login',
  rateLimitMiddleware(5, 300), // 5 login attempts per 5 minutes
  zValidator('form', loginSchema),
  async (c) => {
    const { email } = c.req.valid('form');

    try {
      // Look up user by email
      const user = await c.env.DB.prepare(
        'SELECT id, email, telegram_chat_id, name FROM users WHERE email = ?'
      ).bind(email).first();

      if (!user) {
        // Don't reveal if user exists or not (security)
        return c.html(renderLoginPage({
          success: 'If this email is registered, you will receive a login link on Telegram.',
        }));
      }

      if (!user.telegram_chat_id) {
        return c.html(renderLoginPage({
          error: 'Your account is not linked to Telegram. Please contact support.',
        }));
      }

      // Generate magic link token
      const token = await createMagicLinkToken(
        email,
        c.env.MAGIC_LINK_SECRET,
        parseInt(c.env.MAGIC_LINK_EXPIRY_MINUTES || '15', 10)
      );

      const magicLink = `${c.env.DOMAIN}/api/auth/verify?token=${token}`;

      // Send magic link via Telegram
      const message = `🔐 *Dashboard Login*\n\nClick the link below to access your dashboard:\n\n${magicLink}\n\n⏰ This link expires in 15 minutes.\n\n_If you didn't request this, please ignore this message._`;

      const response = await fetch(
        `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.telegram_chat_id,
            text: message,
            parse_mode: 'Markdown',
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send Telegram message:', await response.text());
        return c.html(renderLoginPage({
          error: 'Failed to send login link. Please try again.',
        }));
      }

      return c.html(renderLoginPage({
        success: 'Magic link sent! Check your Telegram messages.',
      }));
    } catch (error) {
      console.error('Login error:', error);
      return c.html(renderLoginPage({
        error: 'An error occurred. Please try again.',
      }));
    }
  }
);

// GET /api/auth/verify - Verify magic link token and create session
app.get('/api/auth/verify', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.html(renderLoginPage({
      error: 'Invalid login link.',
    }));
  }

  try {
    // Verify magic link token
    const payload = await verifyMagicLinkToken(token, c.env.MAGIC_LINK_SECRET);

    if (!payload) {
      return c.html(renderLoginPage({
        error: 'Login link expired or invalid. Please request a new one.',
      }));
    }

    // Look up user
    const user = await c.env.DB.prepare(
      'SELECT id, email, name FROM users WHERE email = ?'
    ).bind(payload.email).first();

    if (!user) {
      return c.html(renderLoginPage({
        error: 'User not found.',
      }));
    }

    // Create session token
    const sessionToken = await createSessionToken(
      {
        userId: user.id as string,
        email: user.email as string,
      },
      c.env.JWT_SECRET,
      parseInt(c.env.SESSION_DURATION_HOURS || '720', 10)
    );

    // Set session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: parseInt(c.env.SESSION_DURATION_HOURS || '720', 10) * 3600,
      path: '/',
    });

    // Redirect to dashboard
    return c.redirect('/dashboard');
  } catch (error) {
    console.error('Verification error:', error);
    return c.html(renderLoginPage({
      error: 'An error occurred. Please try again.',
    }));
  }
});

// POST /api/auth/logout - Clear session
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.redirect('/login');
});

export default app;
