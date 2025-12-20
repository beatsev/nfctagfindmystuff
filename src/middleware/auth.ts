import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifySessionToken, type SessionPayload } from '../lib/jwt';

// Extend Hono context with user info
export interface AuthContext {
  user: SessionPayload;
}

/**
 * Authentication middleware
 * Verifies session cookie and adds user info to context
 * Redirects to login page if not authenticated
 */
export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const sessionToken = getCookie(c, 'session');

    if (!sessionToken) {
      return c.redirect('/login');
    }

    const user = await verifySessionToken(sessionToken, c.env.JWT_SECRET);

    if (!user) {
      return c.redirect('/login');
    }

    // Add user to context for use in route handlers
    c.set('user', user);

    await next();
  };
}

/**
 * API authentication middleware
 * Returns 401 JSON response instead of redirect
 */
export function apiAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const sessionToken = getCookie(c, 'session');

    if (!sessionToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const user = await verifySessionToken(sessionToken, c.env.JWT_SECRET);

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Add user to context for use in route handlers
    c.set('user', user);

    await next();
  };
}
