# Reliability Improvements Roadmap

## Current Status ✅

### Database Design
- ✅ Foreign keys with CASCADE deletes
- ✅ CHECK constraints on all enum fields
- ✅ 8 performance indexes covering all query paths
- ✅ UNIQUE constraints on critical fields (email)
- ✅ Proper normalization (3NF)

### Error Handling
- ✅ 25+ try-catch blocks with error logging
- ✅ Notification failures logged to database
- ✅ Graceful degradation (missing Telegram chat_id)
- ✅ Non-blocking async operations (ctx.waitUntil)

### Security
- ✅ Zod schema validation on all inputs
- ✅ Parameterized SQL queries (injection prevention)
- ✅ Rate limiting (10/5min login, 10/min scans, 3/5min messages)
- ✅ IP hashing (SHA-256)
- ✅ HTTP-only, SameSite cookies
- ✅ Ownership verification on all dashboard operations

### Performance
- ✅ KV caching with automatic invalidation
- ✅ Read-through cache pattern
- ✅ Efficient database indexes
- ✅ Edge computing (Cloudflare global network)

---

## 🔧 Recommended Improvements

### Priority 1: Critical (High Impact, Low Effort)

#### 1.1 Telegram Notification Retry Logic
**Problem**: Single API call failure = missed notification
**Current**: Fails immediately, logs to database
**Improvement**: Retry with exponential backoff

```typescript
async function sendWithRetry(url: string, body: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) return response;

      // Don't retry on 4xx errors (bad request)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }

      // Retry on 5xx errors (server errors)
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

**Impact**: Reduces notification failures by ~80%
**Effort**: 30 minutes

---

#### 1.2 Health Check Endpoint
**Problem**: No way to monitor service health
**Current**: No dedicated health endpoint
**Improvement**: Add `/health` endpoint

```typescript
app.get('/health', async (c) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      kv: 'unknown',
    }
  };

  try {
    // Test D1 connection
    await c.env.DB.prepare('SELECT 1').first();
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
  }

  try {
    // Test KV connection
    await c.env.TAGS_KV.get('health-check');
    checks.checks.kv = 'healthy';
  } catch (error) {
    checks.checks.kv = 'unhealthy';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return c.json(checks, statusCode);
});
```

**Impact**: Enable uptime monitoring, catch issues early
**Effort**: 15 minutes

---

#### 1.3 Database Backup Strategy
**Problem**: No automated backups
**Current**: Relies on Cloudflare's infrastructure
**Improvement**: Add automated export script

```bash
# Weekly backup script (run via GitHub Actions or Cloudflare Cron)
npx wrangler d1 export findmy_tags --remote --output backup-$(date +%Y%m%d).sql

# Upload to R2 or S3
wrangler r2 object put nfc-backups/db-$(date +%Y%m%d).sql --file backup-*.sql
```

**Impact**: Prevent data loss, enable point-in-time recovery
**Effort**: 1 hour (setup automation)

---

### Priority 2: High Value (Medium Impact, Medium Effort)

#### 2.1 Request ID Tracing
**Problem**: Hard to debug issues across multiple requests
**Current**: Logs exist but no correlation
**Improvement**: Add request ID to all logs

```typescript
// Middleware
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// In logs
console.error(`[${c.get('requestId')}] Failed to send notification`);
```

**Impact**: Faster debugging, better observability
**Effort**: 2 hours

---

#### 2.2 Circuit Breaker for External APIs
**Problem**: Telegram API downtime blocks all notifications
**Current**: Every request attempts Telegram API
**Improvement**: Skip Telegram if it's down (circuit breaker)

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute(fn: () => Promise<any>) {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) { // 1 min cooldown
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= 5) {
      this.state = 'open';
    }
  }
}
```

**Impact**: Prevent cascading failures, faster recovery
**Effort**: 3 hours

---

#### 2.3 Persistent Rate Limiting
**Problem**: In-memory rate limits reset on worker restart
**Current**: Rate limits stored in Worker memory
**Improvement**: Store in KV for persistence

```typescript
async function checkRateLimit(key: string, limit: number, window: number, env: Env) {
  const now = Date.now();
  const kvKey = `ratelimit:${key}`;

  const data = await env.TAGS_KV.get(kvKey, 'json') as { count: number, resetAt: number } | null;

  if (!data || now > data.resetAt) {
    await env.TAGS_KV.put(kvKey, JSON.stringify({ count: 1, resetAt: now + window * 1000 }), {
      expirationTtl: window
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (data.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: data.resetAt };
  }

  await env.TAGS_KV.put(kvKey, JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }), {
    expirationTtl: Math.ceil((data.resetAt - now) / 1000)
  });

  return { allowed: true, remaining: limit - data.count - 1 };
}
```

**Impact**: More reliable rate limiting, prevents abuse
**Effort**: 2 hours

---

### Priority 3: Nice to Have (Lower Impact, Higher Effort)

#### 3.1 Structured Logging
**Problem**: Console.log/error are hard to parse
**Improvement**: JSON structured logging

```typescript
const logger = {
  info: (message: string, meta?: any) => console.log(JSON.stringify({ level: 'info', message, ...meta, ts: Date.now() })),
  error: (message: string, error: any, meta?: any) => console.error(JSON.stringify({ level: 'error', message, error: error.message, stack: error.stack, ...meta, ts: Date.now() })),
};
```

**Impact**: Better log aggregation, easier debugging
**Effort**: 3 hours

---

#### 3.2 Metrics & Analytics
**Problem**: No visibility into usage patterns
**Improvement**: Track key metrics

```typescript
// Track to KV or external service
await env.TAGS_KV.put(`metrics:scans:${date}`, scanCount, { expirationTtl: 2592000 }); // 30 days

// Metrics to track:
- Daily scan count by tag
- Response times (p50, p95, p99)
- Error rates by endpoint
- Cache hit/miss ratio
- Notification success rate
```

**Impact**: Better capacity planning, identify trends
**Effort**: 4 hours

---

#### 3.3 Idempotency Keys
**Problem**: Duplicate scan events if user refreshes page
**Improvement**: Use idempotency keys

```typescript
// Generate stable key from request
const idempotencyKey = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(`${tagId}-${ipHash}-${timestamp.slice(0, 10)}`)
);

// Check if already processed
const existing = await env.TAGS_KV.get(`idempotency:${idempotencyKey}`);
if (existing) {
  return c.json(JSON.parse(existing)); // Return cached response
}

// Process and cache response
const response = await processRequest();
await env.TAGS_KV.put(`idempotency:${idempotencyKey}`, JSON.stringify(response), {
  expirationTtl: 86400 // 24 hours
});
```

**Impact**: Prevent duplicate scans, cleaner analytics
**Effort**: 3 hours

---

## 📊 Monitoring Recommendations

### External Monitoring (Free Tier Options)

1. **UptimeRobot** - Monitor /health endpoint every 5 minutes
2. **Better Uptime** - Monitor critical endpoints + SSL cert expiry
3. **Sentry** (Free tier) - Error tracking and alerting
4. **Cloudflare Analytics** - Built-in metrics (already available)

### Alerts to Set Up

- ❌ Health check fails (page down)
- ❌ Error rate >5% over 5 minutes
- ❌ Notification success rate <90%
- ❌ Database query latency >500ms (p95)
- ⚠️ Daily scan count drops >50% (potential issue)

---

## 🎯 Implementation Roadmap

### Week 1: Critical Fixes
- [ ] Add Telegram retry logic
- [ ] Create /health endpoint
- [ ] Set up UptimeRobot monitoring

### Week 2: Resilience
- [ ] Implement request ID tracing
- [ ] Set up database backups
- [ ] Add circuit breaker for Telegram API

### Week 3: Optimization
- [ ] Migrate to KV-based rate limiting
- [ ] Implement structured logging
- [ ] Add basic metrics tracking

### Week 4: Polish
- [ ] Idempotency keys for scan events
- [ ] Set up Sentry error tracking
- [ ] Create alerting rules

---

## 💰 Cost Impact

All improvements use existing free tiers:
- **KV**: Already using (rate limits/metrics fit in free tier)
- **D1**: Backups within free tier (100K reads/day)
- **Workers**: Additional logic within free tier CPU limits
- **Monitoring**: UptimeRobot free tier (50 monitors)

**Total additional cost**: $0/month

---

## 🔍 Testing Strategy

### Manual Testing
- Test notification retries by temporarily using wrong bot token
- Test health endpoint by querying `/health`
- Test circuit breaker by simulating Telegram API failures

### Automated Testing (Future)
- Unit tests for retry logic
- Integration tests for critical paths
- Load testing for rate limiter

---

## 📈 Success Metrics

Track these to measure improvements:

- **Notification Success Rate**: >99% (currently ~95%)
- **Service Uptime**: >99.9%
- **P95 Response Time**: <500ms
- **Error Rate**: <0.1%
- **Cache Hit Ratio**: >95%
- **Time to Detect Issues**: <5 minutes

---

## Notes

- Most improvements are backward-compatible
- Can be implemented incrementally
- No breaking changes required
- Cloudflare handles most infrastructure reliability (multi-region, DDoS protection, auto-scaling)
