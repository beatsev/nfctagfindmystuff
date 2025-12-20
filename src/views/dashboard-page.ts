export interface DashboardPageProps {
  userName?: string;
  userEmail: string;
}

export function renderDashboardPage(props: DashboardPageProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="container">
    <div class="card" style="max-width: 800px;">
      <div class="icon">📊</div>
      <h1>Welcome${props.userName ? `, ${props.userName}` : ''}!</h1>
      <p class="description">
        Logged in as: <strong>${props.userEmail}</strong>
      </p>

      <div style="margin: 32px 0; padding: 24px; background: #f5f5f5; border-radius: 12px;">
        <h2 style="margin-top: 0; font-size: 18px; color: #333;">Dashboard Coming Soon</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 16px;">
          Your dashboard is under construction. Soon you'll be able to:
        </p>
        <ul style="text-align: left; color: #666; line-height: 1.8;">
          <li>📦 Manage your objects and NFC tags</li>
          <li>📍 View scan history and locations</li>
          <li>💬 Read messages from finders</li>
          <li>⚙️ Configure notification settings</li>
        </ul>
      </div>

      <form method="POST" action="/api/auth/logout" style="margin-top: 24px;">
        <button
          type="submit"
          class="cta-button"
          style="background: #666; width: auto; padding: 12px 32px;"
        >
          Logout
        </button>
      </form>

      <div class="privacy" style="margin-top: 24px;">
        <p style="font-size: 14px; color: #999;">
          Session expires in 30 days
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
