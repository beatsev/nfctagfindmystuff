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
<body class="landing-page">
  <div class="container">
    <div class="card">
      <h1>Lost Item Found!</h1>
      <h2>${escapeHtml(props.objectName)}</h2>
      ${props.description ? `<p class="description">${escapeHtml(props.description)}</p>` : ''}

      <div class="location-section">
        <div class="location-icon">📍</div>
        <h3 class="location-title">Help Return This Item</h3>
        <p class="location-description">Share your location so the owner knows where to find their item</p>
        <button
          id="share-location-btn"
          class="location-btn"
          aria-label="Share your current location with the owner">
          <span class="btn-icon">📍</span>
          <span class="btn-text">Tap to Share Location</span>
        </button>
        <p class="location-hint">Just tap and allow when prompted</p>
      </div>

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
      const btnIcon = btn.querySelector('.btn-icon');
      const btnText = btn.querySelector('.btn-text');

      btnIcon.textContent = '⏳';
      btnText.textContent = 'Getting location...';
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
            btnIcon.textContent = '✅';
            btnText.textContent = 'Location Shared!';
            btn.classList.add('success');
          } else {
            btnIcon.textContent = '❌';
            btnText.textContent = 'Failed to share';
            btn.classList.add('error');
            btn.disabled = false;
          }
        } catch (error) {
          btnIcon.textContent = '❌';
          btnText.textContent = 'Error occurred';
          btn.classList.add('error');
          btn.disabled = false;
        }
      }, (error) => {
        btnIcon.textContent = '❌';
        btnText.textContent = 'Location access denied';
        btn.classList.add('error');
        btn.disabled = false;
      });
    });

  </script>
</body>
</html>`;
}
