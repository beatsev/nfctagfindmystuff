export interface LoginPageProps {
  error?: string;
  success?: string;
  botUsername: string;
}

export function renderLoginPage(props: LoginPageProps): string {
  const telegramUrl = `https://t.me/${props.botUsername}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">🔐</div>
      <h1>Owner Dashboard Login</h1>
      <p class="description">
        Enter your email to receive a magic link
      </p>

      ${props.error ? `
        <div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #c33; margin: 0; font-size: 14px;">❌ ${props.error}</p>
        </div>
      ` : ''}

      ${props.success ? `
        <div style="background: #efe; border: 1px solid #cfc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #3a3; margin: 0; font-size: 14px;">✅ ${props.success}</p>
        </div>
      ` : ''}

      <form method="POST" action="/api/auth/login" style="width: 100%; max-width: 400px;" aria-label="Login form">
        <div style="margin-bottom: 16px;">
          <label for="email" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            aria-required="true"
            placeholder="you@example.com"
            style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
          >
        </div>

        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 20px; user-select: none;">
          <input
            type="checkbox"
            id="use_telegram"
            name="use_telegram"
            value="1"
            checked
            onchange="document.getElementById('login-hint').textContent = this.checked ? 'Check your Telegram for the link.' : 'Check your email inbox for the link.'"
            style="width: 18px; height: 18px; accent-color: #667eea; cursor: pointer; flex-shrink: 0;"
          >
          <span style="font-size: 14px; color: #555;">Send via Telegram</span>
        </label>

        <button
          type="submit"
          class="cta-button"
          style="width: 100%; padding: 14px; font-size: 16px;"
          aria-label="Send magic link"
        >
          Send Magic Link
        </button>
      </form>

      <div class="privacy" style="margin-top: 24px;">
        <p id="login-hint" style="font-size: 14px; color: #666; text-align: center;">
          Check your Telegram for the link.
        </p>
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid #e0e0e0;">
        <h3 style="text-align: center; margin-bottom: 16px; color: #333;">New User?</h3>
        <p style="text-align: center; margin-bottom: 16px; color: #666; font-size: 14px;">
          Choose how you'd like to sign up — Telegram is recommended.
        </p>

        <!-- Primary: Telegram signup (recommended) -->
        <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recommended</span>
          </div>
          <a
            href="${telegramUrl}"
            target="_blank"
            class="cta-button"
            style="display: block; text-align: center; text-decoration: none; padding: 12px 24px; font-size: 15px;"
            aria-label="Start signup via Telegram"
          >
            📱 Sign up via Telegram
          </a>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280; text-align: center;">
            Send <code>/start</code> to @${props.botUsername}
          </p>
        </div>

        <!-- Alternative: Email signup -->
        <div style="text-align: center;">
          <a
            href="/signup"
            class="cta-button"
            style="display: inline-block; text-decoration: none; padding: 12px 24px; font-size: 14px; background: #6b7280;"
            aria-label="Sign up with email instead"
          >
            ✉️ Or sign up with email
          </a>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
            No Telegram needed
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}