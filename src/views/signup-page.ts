export interface SignupPageProps {
  token?: string;
  error?: string;
  botUsername: string;
}

export interface SignupErrorPageProps {
  message: string;
  botUsername: string;
}

export interface SignupPendingPageProps {
  email?: string;
  error?: string;
}

export function renderSignupPage(props: SignupPageProps): string {
  const isTelegramFlow = !!props.token;
  const telegramUrl = `https://t.me/${props.botUsername}`;

  if (!isTelegramFlow) {
    // Email-first signup (no Telegram token) — alternative onboarding
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">✨</div>
      <h1>Create Your Account</h1>
      <p class="description">
        Choose how you'd like to sign up — Telegram is recommended for the best experience.
      </p>

      ${props.error ? `
        <div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #c33; margin: 0; font-size: 14px;">❌ ${props.error}</p>
        </div>
      ` : ''}

      <!-- Primary: Telegram signup (recommended) -->
      <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="background: #22c55e; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Recommended</span>
          <span style="font-size: 22px;">📱</span>
        </div>
        <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1f2937;">Sign up via Telegram</h2>
        <p style="margin: 0 0 14px 0; font-size: 14px; color: #4b5563;">
          Instant notifications, manage tags from chat, no email inbox needed.
        </p>
        <a
          href="${telegramUrl}"
          target="_blank"
          class="cta-button"
          style="display: inline-block; text-decoration: none; padding: 12px 24px; font-size: 15px;"
          aria-label="Open Telegram bot"
        >
          📱 Open @${props.botUsername}
        </a>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">
          Send <code>/start</code> to get your personal signup link
        </p>
      </div>

      <!-- Divider -->
      <div style="display: flex; align-items: center; gap: 12px; margin: 24px 0;">
        <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
        <span style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">or</span>
        <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
      </div>

      <!-- Alternative: Email signup -->
      <div>
        <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1f2937;">✉️ Sign up with email</h2>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
          No Telegram needed. We'll email you a confirmation link.
        </p>
        <form
          hx-post="/api/auth/signup-email"
          hx-swap="outerHTML"
          aria-label="Email signup form">
          <div style="margin-bottom: 16px; text-align: left;">
            <label for="email" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
              Email Address *
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

          <div style="margin-bottom: 16px; text-align: left;">
            <label for="name" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
              Your Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              aria-required="true"
              placeholder="John Doe"
              maxlength="100"
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
            >
          </div>

          <button
            type="submit"
            class="cta-button"
            style="width: 100%; padding: 14px; font-size: 16px;"
            aria-label="Send confirmation link"
          >
            Send Confirmation Link
          </button>
        </form>
      </div>

      <div class="privacy" style="margin-top: 24px;">
        <p style="font-size: 13px; color: #888; line-height: 1.6;">
          <small>
            Already have an account? <a href="/login" style="color: #007bff;">Login here</a>
          </small>
        </p>
      </div>
    </div>
  </div>

  <script>
    document.body.addEventListener('htmx:responseError', (event) => {
      const error = event.detail.xhr.responseText;
      try {
        const json = JSON.parse(error);
        alert('Error: ' + (json.error || 'Failed to send confirmation link'));
      } catch (e) {
        alert('Error: Failed to send confirmation link. Please try again.');
      }
    });
  </script>
</body>
</html>`;
  }

  // Telegram signup flow (token-based, original behavior)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">✨</div>
      <h1>Complete Your Signup</h1>
      <p class="description">
        Your Telegram account is linked — finish setting up your NFC Tracker profile.
      </p>

      ${props.error ? `
        <div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #c33; margin: 0; font-size: 14px;">❌ ${props.error}</p>
        </div>
      ` : ''}

      <form
        hx-post="/api/auth/signup"
        hx-swap="outerHTML"
        style="width: 100%; max-width: 400px;"
        aria-label="Signup form">
        <input type="hidden" name="token" value="${props.token}">

        <div style="margin-bottom: 16px;">
          <label for="email" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            Email Address *
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

        <div style="margin-bottom: 16px;">
          <label for="name" style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">
            Your Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            aria-required="true"
            placeholder="John Doe"
            maxlength="100"
            style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
          >
        </div>

        <button
          type="submit"
          class="cta-button"
          style="width: 100%; padding: 14px; font-size: 16px; margin-top: 8px;"
          aria-label="Create account"
        >
          Create Account
        </button>
      </form>

      <div class="privacy" style="margin-top: 24px;">
        <p style="font-size: 14px; color: #666; line-height: 1.6;">
          <strong>What happens next:</strong><br>
          1️⃣ Your account will be created instantly<br>
          2️⃣ You'll be logged in automatically<br>
          3️⃣ Start creating objects and NFC tags!<br>
          <br>
          <small style="color: #999;">
            Already have an account? <a href="/login" style="color: #007bff;">Login here</a>
          </small>
        </p>
      </div>
    </div>
  </div>

  <script>
    document.body.addEventListener('htmx:responseError', (event) => {
      const error = event.detail.xhr.responseText;
      try {
        const json = JSON.parse(error);
        alert('Error: ' + (json.error || 'Failed to create account'));
      } catch (e) {
        alert('Error: Failed to create account. Please try again.');
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Render the "check your inbox" page shown after email signup submission.
 * If error is set, displays the error with the email pre-filled so the user can retry.
 */
export function renderSignupPendingPage(props: SignupPendingPageProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check your email - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">✉️</div>
      ${props.error ? `
        <h1>Signup Failed</h1>
        <div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #c33; margin: 0; font-size: 14px;">❌ ${props.error}</p>
        </div>
        <div style="margin-top: 20px;">
          <a href="/signup" class="cta-button" style="display: inline-block; text-decoration: none; padding: 12px 24px;">
            ← Back to signup
          </a>
        </div>
      ` : `
        <h1>Check your email</h1>
        <p class="description">
          We sent a confirmation link to ${props.email ? `<strong>${props.email}</strong>` : 'your inbox'}.
          Click it to activate your account.
        </p>
        <div class="privacy" style="margin-top: 24px;">
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            <strong>What happens next:</strong><br>
            1️⃣ Open the email we just sent<br>
            2️⃣ Click the "Confirm Email" button<br>
            3️⃣ You'll be logged in automatically<br>
            <br>
            <small style="color: #999;">
              ⏰ The link expires in 1 hour.<br>
              Don't see the email? Check your spam folder.
            </small>
          </p>
        </div>
        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 13px; color: #888; text-align: center;">
            Wrong email? <a href="/signup" style="color: #007bff;">Sign up again</a>
          </p>
        </div>
      `}
    </div>
  </div>
</body>
</html>`;
}

export function renderSignupErrorPage(props: SignupErrorPageProps): string {
  const telegramUrl = `https://t.me/${props.botUsername}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signup Error - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">❌</div>
      <h1>Signup Link Invalid</h1>
      <p class="description">${props.message}</p>

      <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px; align-items: center;">
        <a
          href="${telegramUrl}"
          target="_blank"
          class="cta-button"
          style="display: inline-block; text-decoration: none; padding: 14px 28px;"
          aria-label="Get new Telegram signup link"
        >
          📱 Get New Telegram Link
        </a>
        <a
          href="/signup"
          class="cta-button"
          style="display: inline-block; text-decoration: none; padding: 12px 24px; background: #6b7280;"
          aria-label="Sign up with email instead"
        >
          ✉️ Or sign up with email
        </a>
      </div>

      <div class="privacy" style="margin-top: 24px;">
        <p style="font-size: 14px; color: #666;">
          <strong>How to get started via Telegram:</strong><br>
          1. Message <strong>@${props.botUsername}</strong> on Telegram<br>
          2. Send the command: <code>/start</code><br>
          3. Click the signup link you receive<br>
          <br>
          Signup links expire after 1 hour for security.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}