export interface LandingPageProps {
  objectName: string;
  description: string | null;
  scanEventId: number;
  tagId: string;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function renderLandingPage(props: LandingPageProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lost Item Found - ${escapeHtml(props.objectName)}</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">📦</div>
      <h1>Lost Item Found!</h1>
      <h2>${escapeHtml(props.objectName)}</h2>
      ${props.description ? `<p class="description">${escapeHtml(props.description)}</p>` : ''}

      <div class="section">
        <h3>💬 Send a Message to the Owner</h3>
        <form
          hx-post="/api/t/${props.tagId}/message"
          hx-swap="outerHTML"
          class="message-form"
          aria-label="Contact owner form">
          <input type="hidden" name="scan_event_id" value="${props.scanEventId}">
          <div>
            <label for="message">Your message</label>
            <textarea
              id="message"
              name="message"
              placeholder="I found your item at..."
              required
              aria-required="true"
              maxlength="1000"
              rows="4"></textarea>
          </div>
          <div>
            <label for="contact">Contact info (optional)</label>
            <input
              id="contact"
              type="text"
              name="contact"
              placeholder="Your email or phone (optional)"
              aria-label="Your contact information"
              maxlength="200">
          </div>
          <button type="submit" aria-label="Send message to item owner">📨 Send Message</button>
        </form>
      </div>

      <div class="section">
        <h3>📍 Help Return This Item</h3>
        <p style="color: #6b7280; margin-bottom: 1rem; font-size: 0.95rem;">
          Share your location so the owner knows where to find their item
        </p>
        <button
          id="share-location-btn"
          class="secondary-btn"
          aria-label="Share your current location with the owner">
          📍 Share My Location
        </button>
      </div>

      <div class="privacy">
        <small>
          🔒 <strong>Privacy:</strong> We log scan time and approximate location (city/region from your IP address).
          Precise GPS location is only shared if you click "Share My Location" above.
          Any contact information you provide will be sent to the owner.
        </small>
      </div>
    </div>
  </div>

  <script>
    // Handle location sharing
    document.getElementById('share-location-btn').addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('❌ Geolocation not supported by your browser');
        return;
      }

      const btn = document.getElementById('share-location-btn');
      btn.textContent = '⏳ Getting location...';
      btn.disabled = true;

      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const response = await fetch('/api/t/${props.tagId}/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scan_event_id: ${props.scanEventId},
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
          });

          if (response.ok) {
            btn.textContent = '✅ Location Shared!';
            btn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
          } else {
            btn.textContent = '❌ Failed to share';
            btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            btn.disabled = false;
          }
        } catch (error) {
          btn.textContent = '❌ Error occurred';
          btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          btn.disabled = false;
        }
      }, (error) => {
        btn.textContent = '❌ Location access denied';
        btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        btn.disabled = false;
      });
    });

    // Handle HTMX form success
    document.body.addEventListener('htmx:afterSwap', (event) => {
      const target = event.detail.target;
      if (target.classList && target.classList.contains('message-form')) {
        target.innerHTML = '<div class="success-message"><p>✅ <strong>Message sent to owner!</strong></p><p>They will be notified and can reach out to you if you provided contact information.</p></div>';
      }
    });
  </script>
</body>
</html>`;
}
