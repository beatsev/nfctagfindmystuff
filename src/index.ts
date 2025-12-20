import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Env } from './types/env';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';
import apiFinderRoutes from './routes/api-finder';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Serve static CSS
app.get('/styles.css', serveStatic({ path: './public/styles.css' }));

// Routes
app.route('/', publicRoutes);
app.route('/', adminRoutes);
app.route('/', apiFinderRoutes);
app.route('/', authRoutes);
app.route('/', dashboardRoutes);

// Health check route
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'NFC Tag Tracker API',
    version: '1.0.0'
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

export default app;
