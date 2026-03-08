import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../types/env';
import { renderLoginPage } from '../views/login-page';
import { renderSignupPage, renderSignupErrorPage } from '../views/signup-page';
import { createMagicLinkToken, verifyMagicLinkToken, createSessionToken } from '../lib/jwt';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { sendMagicLinkEmail } from '../services/email';

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry fetch with exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        if (attempt > 1) {
          console.log(`✅ Telegram API succeeded on attempt ${attempt}`);
        }
        return response;
      }

      // Client errors (4xx) - don't retry
      if (response.status >= 400 && response.status < 500) {
        console.error(`❌ Telegram API client error ${response.status}, not retrying`);
        return response;
      }

      // Server errors (5xx) or rate limit (429) - retry
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Telegram API attempt ${attempt} failed (${response.status}), retrying in ${waitTime}ms...`);
        await sleep(waitTime);
      } else {
        console.error(`❌ Telegram API failed after ${maxRetries} attempts (${response.status})`);
        return response;
      }
    } catch (error) {
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

const app = new Hono<{ Bindings: Env }>();

// Validation schemas with email normalization
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  use_telegram: z.string().optional(), // checkbox: '1' if checked, absent if unchecked
});

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().min(1).max(100).trim(),
  token: z.string().uuid(),
});

// GET /login - Show login page
app.get('/login', (c) => {
  return c.html(renderLoginPage());
});

// POST /api/auth/login - Send magic link via Telegram
app.post(
  '/api/auth/login',
  rateLimitMiddleware(10, 300), // 10 login attempts per 5 minutes (more lenient for testing)
  zValidator('form', loginSchema),
  async (c) => {
    const { email, use_telegram } = c.req.valid('form');
    const viaEmail = use_telegram !== '1';

    try {
      // Look up user by email (case-insensitive)
      const user = await c.env.DB.prepare(
        'SELECT id, email, telegram_chat_id, notification_channel, name FROM users WHERE LOWER(email) = ?'
      ).bind(email).first<{ id: string; email: string; telegram_chat_id: string | null; notification_channel: string; name: string }>();

      if (!user) {
        // Don't reveal if user exists or not (security)
        return c.html(renderLoginPage({
          success: 'If this email is registered, you will receive a login link.',
        }));
      }

      // Generate magic link token
      const token = await createMagicLinkToken(
        email,
        c.env.MAGIC_LINK_SECRET,
        parseInt(c.env.MAGIC_LINK_EXPIRY_MINUTES || '15', 10)
      );

      const magicLink = `${c.env.DOMAIN}/api/auth/verify?token=${token}`;
      // Login page checkbox overrides: unchecked = email, checked = Telegram
      if (viaEmail) {
        const ok = await sendMagicLinkEmail(user.email, magicLink, c.env);
        if (!ok) {
          return c.html(renderLoginPage({ error: 'Failed to send login link. Please try again.' }));
        }
        return c.html(renderLoginPage({ success: 'Magic link sent! Check your email inbox.' }));
      }

      // Telegram path
      if (!user.telegram_chat_id) {
        return c.html(renderLoginPage({
          error: 'No Telegram linked. Uncheck "Send via Telegram" to receive the link by email instead.',
        }));
      }

      const message = `🔐 <b>Dashboard Login</b>\n\nClick the link below to access your dashboard:\n\n${magicLink}\n\n⏰ This link expires in 15 minutes.\n\n<i>If you didn't request this, please ignore this message.</i>`;
      const response = await fetchWithRetry(
        `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: user.telegram_chat_id, text: message, parse_mode: 'HTML' }),
        },
        3
      );

      if (!response.ok) {
        console.error('Failed to send Telegram message:', await response.text());
        return c.html(renderLoginPage({ error: 'Failed to send login link. Please try again.' }));
      }

      return c.html(renderLoginPage({ success: 'Magic link sent! Check your Telegram.' }));
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

    // Look up user (case-insensitive)
    const user = await c.env.DB.prepare(
      'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?)'
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

// GET /signup - Show signup page
app.get('/signup', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.html(renderSignupErrorPage(
      'No signup token provided. Please message the bot to get a signup link.'
    ));
  }

  // Verify token exists in KV
  const chatId = await c.env.TAGS_KV.get(`signup:${token}`);

  if (!chatId) {
    return c.html(renderSignupErrorPage(
      'This signup link has expired or is invalid. Signup links are valid for 1 hour.'
    ));
  }

  return c.html(renderSignupPage({ token }));
});

// POST /api/auth/signup - Create new user account
app.post(
  '/api/auth/signup',
  rateLimitMiddleware(5, 300), // 5 signups per 5 minutes
  zValidator('form', signupSchema),
  async (c) => {
    const { email, name, token } = c.req.valid('form');

    try {
      // Get chat_id from KV using signup token
      const chatId = await c.env.TAGS_KV.get(`signup:${token}`);

      if (!chatId) {
        return c.json({
          success: false,
          error: 'Signup link expired. Please get a new link from the bot.',
        }, 400);
      }

      // Check if email already exists (case-insensitive)
      const existingUser = await c.env.DB.prepare(
        'SELECT id FROM users WHERE LOWER(email) = ?'
      ).bind(email).first();

      if (existingUser) {
        return c.json({
          success: false,
          error: 'An account with this email already exists. Try logging in instead.',
        }, 400);
      }

      // Generate user ID
      const userId = crypto.randomUUID();

      // Insert new user
      await c.env.DB.prepare(`
        INSERT INTO users (id, email, name, telegram_chat_id, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(userId, email, name, chatId).run();

      // Delete signup token (one-time use)
      await c.env.TAGS_KV.delete(`signup:${token}`);

      // Create session token
      const sessionToken = await createSessionToken(
        {
          userId,
          email,
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

      // Return success - HTMX will redirect
      return c.html(`
        <div style="text-align: center; padding: 20px;">
          <h2 style="color: #22c55e;">✅ Account Created!</h2>
          <p>Redirecting to dashboard...</p>
          <script>
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 1000);
          </script>
        </div>
      `);
    } catch (error) {
      console.error('Signup error:', error);
      return c.json({
        success: false,
        error: 'Failed to create account. Please try again.',
      }, 500);
    }
  }
);

// POST /api/auth/logout - Clear session
app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.redirect('/login');
});

export default app;
