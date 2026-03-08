export interface DashboardPageProps {
  userName?: string;
  userEmail: string;
  objects: any[];
  unreadMessages: number;
  currentFilter?: string;
  currentSort?: string;
}

export function renderDashboardPage(props: DashboardPageProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - NFC Tag Tracker</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    .nav-bar {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .nav-bar h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .nav-links {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .nav-link {
      color: white;
      text-decoration: none;
      font-size: 14px;
      padding: 8px 16px;
      border-radius: 6px;
      transition: background 0.2s;
    }
    .nav-link:hover {
      background: rgba(255,255,255,0.2);
    }
    .nav-link.active {
      background: rgba(255,255,255,0.3);
    }
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    .page-header h2 {
      margin: 0;
      font-size: 28px;
      color: #333;
    }
    .objects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }
    .object-card {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 20px;
      transition: all 0.2s;
      cursor: pointer;
    }
    .object-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
      transform: translateY(-2px);
    }
    .object-card h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #333;
    }
    .object-card p {
      margin: 4px 0;
      font-size: 14px;
      color: #666;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 8px;
    }
    .status-active { background: #e8f5e9; color: #2e7d32; }
    .status-lost { background: #fff3e0; color: #e65100; }
    .status-recovered { background: #e3f2fd; color: #1565c0; }
    .stats {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      font-size: 13px;
      color: #666;
    }
    .empty-state {
      text-align: center;
      padding: 64px 32px;
      background: #f9f9f9;
      border-radius: 12px;
      margin-top: 24px;
    }
    .empty-state h3 {
      font-size: 20px;
      color: #666;
      margin-bottom: 12px;
    }
  </style>
</head>
<body style="margin: 0; background: #f5f5f5;">
  <div class="nav-bar">
    <h1>🏷️ NFC Tag Tracker</h1>
    <div class="nav-links">
      <a href="/dashboard" class="nav-link active">Objects</a>
      <a href="/dashboard/messages" class="nav-link">
        Messages ${props.unreadMessages > 0 ? `<span style="background: #ff5252; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; margin-left: 4px;">${props.unreadMessages}</span>` : ''}
      </a>
      <a href="/dashboard/settings" class="nav-link">Settings</a>
      <form method="POST" action="/api/auth/logout" style="margin: 0;">
        <button type="submit" class="nav-link" style="background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px;">
          Logout
        </button>
      </form>
    </div>
  </div>

  <div class="main-content">
    <div class="page-header">
      <div>
        <h2>My Objects</h2>
        <p style="color: #666; margin: 4px 0 0 0;">Track your tagged items</p>
      </div>
      <button
        hx-get="/dashboard/objects/new"
        hx-target="#modal-container"
        hx-swap="innerHTML"
        class="cta-button"
        style="width: auto; padding: 12px 24px;"
      >
        + Add Object
      </button>
    </div>

    <!-- Filter and Sort Controls -->
    <div style="margin-bottom: 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <label for="status-filter" style="font-weight: 500; color: #666;">
        Filter:
      </label>
      <select
        id="status-filter"
        onchange="updateDashboardUrl()"
        style="padding: 10px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; min-width: 150px; font-family: inherit;"
      >
        <option value="all" ${(!props.currentFilter || props.currentFilter === 'all') ? 'selected' : ''}>
          All Objects
        </option>
        <option value="active" ${props.currentFilter === 'active' ? 'selected' : ''}>
          Active
        </option>
        <option value="lost" ${props.currentFilter === 'lost' ? 'selected' : ''}>
          Lost
        </option>
        <option value="recovered" ${props.currentFilter === 'recovered' ? 'selected' : ''}>
          Recovered
        </option>
      </select>

      <label for="sort-by" style="font-weight: 500; color: #666; margin-left: 12px;">
        Sort:
      </label>
      <select
        id="sort-by"
        onchange="updateDashboardUrl()"
        style="padding: 10px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; min-width: 170px; font-family: inherit;"
      >
        <option value="recent_scan" ${(!props.currentSort || props.currentSort === 'recent_scan') ? 'selected' : ''}>
          Recent Scan
        </option>
        <option value="status" ${props.currentSort === 'status' ? 'selected' : ''}>
          Status (Lost First)
        </option>
        <option value="created" ${props.currentSort === 'created' ? 'selected' : ''}>
          Date Created
        </option>
      </select>

      ${(props.currentFilter && props.currentFilter !== 'all') || (props.currentSort && props.currentSort !== 'recent_scan') ? `
        <a
          href="/dashboard"
          style="color: #667eea; text-decoration: none; font-size: 13px; padding: 8px 12px; background: #f5f5f5; border-radius: 6px; transition: background 0.2s;"
          onmouseover="this.style.background='#eeeeee'"
          onmouseout="this.style.background='#f5f5f5'"
        >
          Reset
        </a>
      ` : ''}
    </div>

    ${props.objects.length === 0 ? `
      <div class="empty-state">
        <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
        <h3>No objects yet</h3>
        <p style="color: #999; margin-bottom: 24px;">Start by adding your first object to track</p>
        <button
          hx-get="/dashboard/objects/new"
          hx-target="#modal-container"
          hx-swap="innerHTML"
          class="cta-button"
          style="width: auto; padding: 12px 24px;"
        >
          + Add Your First Object
        </button>
      </div>
    ` : `
      <div class="objects-grid">
        ${props.objects.map(obj => `
          <div class="object-card" style="position: relative;">
            <!-- Edit button (top-right corner) -->
            <button
              hx-get="/dashboard/objects/${obj.id}/edit"
              hx-target="#modal-container"
              hx-swap="innerHTML"
              onclick="event.stopPropagation()"
              style="position: absolute; top: 16px; right: 16px; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: 500; color: #666; transition: all 0.2s; z-index: 10;"
              onmouseover="this.style.background='#667eea'; this.style.color='white'; this.style.borderColor='#667eea'"
              onmouseout="this.style.background='#f5f5f5'; this.style.color='#666'; this.style.borderColor='#e0e0e0'"
              title="Edit object"
            >
              ✏️ Edit
            </button>

            <!-- Clickable area (exclude edit button) -->
            <a href="/dashboard/objects/${obj.id}" style="text-decoration: none; color: inherit; display: block; padding-right: 80px;">
              <h3>${escapeHtml(obj.name)}</h3>
              ${obj.description ? `<p>${escapeHtml(obj.description)}</p>` : ''}
              <span class="status-badge status-${obj.status}">${obj.status}</span>
              <div class="stats">
                <span>🏷️ ${obj.tag_count} tag${obj.tag_count !== 1 ? 's' : ''}</span>
                <span>👁️ ${obj.scan_count} scan${obj.scan_count !== 1 ? 's' : ''}</span>
              </div>
              ${obj.last_scan ? `<p style="font-size: 12px; color: #999; margin-top: 8px;">Last seen: ${formatDate(obj.last_scan)}</p>` : ''}
            </a>
          </div>
        `).join('')}
      </div>
    `}
  </div>

  <div id="modal-container"></div>

  <script>
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return minutes + 'm ago';
      if (hours < 24) return hours + 'h ago';
      if (days < 7) return days + 'd ago';
      return date.toLocaleDateString();
    }

    function updateDashboardUrl() {
      const filter = document.getElementById('status-filter').value;
      const sort = document.getElementById('sort-by').value;
      const params = new URLSearchParams();

      if (filter && filter !== 'all') {
        params.set('status', filter);
      }
      if (sort && sort !== 'recent_scan') {
        params.set('sort', sort);
      }

      const queryString = params.toString();
      window.location.href = '/dashboard' + (queryString ? '?' + queryString : '');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateStr: string): string {
  // This is a placeholder - actual formatting happens client-side
  return dateStr;
}
