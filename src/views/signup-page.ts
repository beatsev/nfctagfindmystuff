export interface SignupPageProps {
  token: string;
  error?: string;
}

export function renderSignupPage(props: SignupPageProps): string {
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
        Complete your signup to start tracking your items with NFC tags
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
    // Handle HTMX errors
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

export function renderSignupErrorPage(error: string): string {
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
      <p class="description">${error}</p>

      <div style="margin-top: 24px;">
        <a href="https://t.me/Nfcstufffinderbottagger_bot" target="_blank" class="cta-button" style="display: inline-block; text-decoration: none; padding: 14px 28px;">
          📱 Get New Signup Link
        </a>
      </div>

      <div class="privacy" style="margin-top: 24px;">
        <p style="font-size: 14px; color: #666;">
          <strong>How to get started:</strong><br>
          1. Message <strong>@Nfcstufffinderbottagger_bot</strong> on Telegram<br>
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
