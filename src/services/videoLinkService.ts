import crypto from "crypto";
import path from "path";

/**
 * VideoLinkService
 *
 * Creates short-lived (30-minute) signed tokens for public video access.
 * No login required — just click the link.
 */

interface VideoToken {
  videoUrl: string;     // Cloud/public URL to the video (ImageKit, etc.)
  filename: string;
  mimeType: string;
  location?: string;
  lat?: number;
  lng?: number;
  expiresAt: number;
}

const tokenStore = new Map<string, VideoToken>();

// Auto-clean expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenStore.entries()) {
    if (now > entry.expiresAt) tokenStore.delete(token);
  }
}, 10 * 60 * 1000);

const TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Create a 30-minute expiring token
 * @param videoUrl - The PUBLIC/cloud URL of the video (e.g. ImageKit URL)
 */
export const createVideoToken = (
  videoUrl: string,
  opts?: { location?: string; lat?: number; lng?: number }
): string => {
  const token = crypto.randomBytes(6).toString("hex"); // 12-char token
  const ext = path.extname(videoUrl).toLowerCase().replace(".", "") || "mp4";
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    avi: "video/x-msvideo", mkv: "video/x-matroska",
  };

  tokenStore.set(token, {
    videoUrl,
    filename: path.basename(videoUrl) || "footage.mp4",
    mimeType: mimeTypes[ext] || "video/mp4",
    location: opts?.location,
    lat: opts?.lat,
    lng: opts?.lng,
    expiresAt: Date.now() + TTL_MS,
  });

  console.log(`🔗 Created video token (expires in 30min): ${token}`);
  return token;
};

export const getVideoByToken = (token: string): VideoToken | null => {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  return entry;
};

export const getVideoLinkUrl = (token: string): string => {
  const base = process.env.PUBLIC_BACKEND_URL || "http://localhost:5005";
  return `${base}/watch/${token}`;
};

/**
 * Build a Google Maps URL from coordinates
 */
export const buildMapsUrl = (lat: number, lng: number): string =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

/**
 * Build the autoplay HTML page served at /watch/:token
 */
export const buildVideoPlayerHtml = (entry: VideoToken): string => {
  const minutesLeft = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 60000));
  const expiresDate = new Date(entry.expiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const mapsUrl = entry.lat && entry.lng ? buildMapsUrl(entry.lat, entry.lng) : null;
  const msLeft = entry.expiresAt - Date.now();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CrimeWatch AI — Alert Footage</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4);
      color: #f87171; font-size: 0.7rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      padding: 4px 12px; border-radius: 999px; margin-bottom: 12px;
    }
    .dot { width: 6px; height: 6px; background: #ef4444; border-radius: 50%; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    h1 { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-bottom: 16px; }
    .meta span { color: #fbbf24; font-weight: 600; }
    .video-wrap {
      width: 100%; max-width: 900px;
      border-radius: 12px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 20px 60px rgba(0,0,0,0.7); background: #000;
    }
    video { width: 100%; display: block; max-height: 72vh; }
    .actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; justify-content: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 20px; border-radius: 8px;
      font-size: 0.8rem; font-weight: 700; text-decoration: none; cursor: pointer;
    }
    .btn-map { background: #22c55e22; border: 1px solid #22c55e66; color: #4ade80; }
    .btn-dl  { background: #6366f122; border: 1px solid #6366f166; color: #818cf8; }
    .footer { margin-top: 14px; font-size: 0.65rem; color: rgba(255,255,255,0.2); text-align: center; }
    .expired { text-align: center; padding: 40px 24px; }
    .expired h2 { font-size: 1.4rem; margin-bottom: 8px; color: #f87171; }
    .expired p  { color: rgba(255,255,255,0.5); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="badge"><span class="dot"></span>CrimeWatch AI — Security Alert</div>
  <h1>📹 Alert Footage</h1>
  <p class="meta">
    Expires in <span>${minutesLeft} min</span>
    ${entry.location ? ` &nbsp;·&nbsp; 📍 ${entry.location}` : ""}
    &nbsp;·&nbsp; ${expiresDate}
  </p>

  <div class="video-wrap">
    <video
      id="player"
      autoplay
      controls
      playsinline
      preload="auto"
      src="${entry.videoUrl}"
      crossorigin="anonymous"
    >
      Your browser does not support the video tag.
    </video>
  </div>

  <div class="actions">
    ${mapsUrl ? `
    <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-map">
      🗺️ Open in Google Maps
      ${entry.lat && entry.lng ? `<span style="font-weight:400;opacity:0.7">(${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)})</span>` : ""}
    </a>` : ""}
    <a href="${entry.videoUrl}" download="${entry.filename}" class="btn btn-dl">
      ⬇ Download Footage
    </a>
  </div>

  <p class="footer">CrimeWatch AI · Secure Evidence Link · Do not share · Expires ${expiresDate}</p>

  <script>
    // Auto-show expired screen when time runs out
    setTimeout(() => {
      document.body.innerHTML = '<div class="expired"><h2>⏰ Link Expired</h2><p>This security footage link has expired for safety.<br>Contact the security team for access.</p></div>';
    }, ${Math.max(0, msLeft)});

    // Try to autoplay (browsers may block until user interacts)
    const v = document.getElementById('player');
    if (v) {
      v.play().catch(() => {
        // Autoplay blocked — show a play hint
        const hint = document.createElement('p');
        hint.style.cssText = 'text-align:center;margin-top:10px;font-size:0.75rem;color:rgba(255,255,255,0.4)';
        hint.textContent = 'Tap the video to play';
        v.parentElement.insertAdjacentElement('afterend', hint);
      });
    }
  </script>
</body>
</html>`;
};
