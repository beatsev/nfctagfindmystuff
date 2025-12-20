import { Hono } from 'hono';
import type { Env } from '../types/env';
import { authMiddleware } from '../middleware/auth';
import { renderDashboardPage } from '../views/dashboard-page';
import type { SessionPayload } from '../lib/jwt';

const app = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all dashboard routes
app.use('*', authMiddleware());

// GET /dashboard - Main dashboard page
app.get('/dashboard', async (c) => {
  const user = c.get('user') as SessionPayload;

  // Fetch user details from database
  const userData = await c.env.DB.prepare(
    'SELECT name FROM users WHERE id = ?'
  ).bind(user.userId).first();

  return c.html(renderDashboardPage({
    userName: userData?.name as string | undefined,
    userEmail: user.email,
  }));
});

export default app;
