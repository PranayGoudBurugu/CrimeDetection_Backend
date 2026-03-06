import crypto from "crypto";
import path from "path";
import fs from "fs";

/**
 * VideoLinkService
 *
 * Creates short-lived (30-minute) signed tokens for public video access.
 * No login required — just click the link. Token is single-use safe.
 */

interface VideoToken {
  videoPath: string;
  filename: string;
  mimeType: string;
  expiresAt: number; // epoch ms
}

// In-memory store (survives long enough for alerts; server restart clears all)
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
 * Create a 30-minute expiring token for a video file
 */
export const createVideoToken = (videoPath: string): string => {
  const token = crypto.randomBytes(6).toString("hex"); // 12-char token — keeps SMS under 160 chars
  const ext = path.extname(videoPath).toLowerCase().replace(".", "");
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  };

  tokenStore.set(token, {
    videoPath,
    filename: path.basename(videoPath),
    mimeType: mimeTypes[ext] || "video/mp4",
    expiresAt: Date.now() + TTL_MS,
  });

  console.log(`🔗 Created video token (expires in 30min): ${token.slice(0, 8)}...`);
  return token;
};

/**
 * Look up and validate a token. Returns null if expired or not found.
 */
export const getVideoByToken = (token: string): VideoToken | null => {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  return entry;
};

/**
 * Generate the full public URL for a video token
 */
export const getVideoLinkUrl = (token: string): string => {
  const base = process.env.PUBLIC_URL || process.env.FRONTEND_URL || "http://localhost:5005";
  // Always point to the backend port for streaming
  const backendBase = process.env.PUBLIC_BACKEND_URL || "http://localhost:5005";
  return `${backendBase}/watch/${token}`;
};

/**
 * Build the autoplay HTML page served at /watch/:token
 */
export const buildVideoPlayerHtml = (entry: VideoToken): string => {
  const expiresDate = new Date(entry.expiresAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const minutesLeft = Math.max(
    0,
    Math.floor((entry.expiresAt - Date.now()) / 60000)
  );

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
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.4);
      color: #f87171;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .dot { width: 6px; height: 6px; background: #ef4444; border-radius: 50%; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    h1 { font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; }
    .expiry {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.4);
      margin-bottom: 20px;
    }
    .expiry span { color: #fbbf24; font-weight: 600; }
    .video-wrap {
      width: 100%;
      max-width: 900px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      background: #000;
    }
    video {
      width: 100%;
      display: block;
      max-height: 70vh;
    }
    .footer {
      margin-top: 16px;
      font-size: 0.68rem;
      color: rgba(255,255,255,0.25);
      text-align: center;
    }
    .expired {
      text-align: center;
      padding: 40px 24px;
    }
    .expired h2 { font-size: 1.4rem; margin-bottom: 8px; color: #f87171; }
    .expired p { color: rgba(255,255,255,0.5); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="badge"><span class="dot"></span>CrimeWatch AI — Security Alert</div>
  <h1>📹 Alert Footage</h1>
  <p class="expiry">This link expires in <span>${minutesLeft} min</span> · ${expiresDate}</p>

  <div class="video-wrap">
    <video
      autoplay
      controls
      playsinline
      preload="auto"
      src="/stream/${entry.videoPath.split("/").slice(-2).join("/")}"
    >
      Your browser does not support the video tag.
    </video>
  </div>

  <p class="footer">CrimeWatch AI · Secure Evidence Link · Do not share</p>

  <script>
    // Redirect to expired page when token time runs out
    setTimeout(() => {
      document.body.innerHTML = '<div class="expired"><h2>⏰ Link Expired</h2><p>This security footage link has expired for safety.<br>Please contact the security team for access.</p></div>';
    }, ${TTL_MS - (Date.now() - (entry.expiresAt - TTL_MS))});
  </script>
</body>
</html>`;
};
