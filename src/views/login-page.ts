export interface LoginPageProps {
  error?: string;
  success?: string;
}

export function renderLoginPage(props: LoginPageProps = {}): string {
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
        Enter your email to receive a magic link via Telegram
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

        <button
          type="submit"
          class="cta-button"
          style="width: 100%; padding: 14px; font-size: 16px; margin-top: 8px;"
          aria-label="Send magic link to email"
        >
          Send Magic Link
        </button>
      </form>

      <div class="privacy" style="margin-top: 24px;">
        <p style="font-size: 14px; color: #666; line-height: 1.6;">
          <strong>How it works:</strong><br>
          1️⃣ Enter your registered email<br>
          2️⃣ Check your Telegram for a login link<br>
          3️⃣ Click the link to access your dashboard<br>
          <br>
          <small style="color: #999;">
            Don't have an account yet? Contact support to get started.
          </small>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
