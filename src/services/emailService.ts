import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/**
 * Email Alert Service — CrimeWatch AI
 *
 * Sends rich HTML email alerts via Gmail SMTP when violence is detected.
 * No DLT registration required. Works instantly for any email address.
 *
 * Setup:
 *  1. Enable 2FA on your Gmail account
 *  2. Go to https://myaccount.google.com/apppasswords
 *  3. Generate an App Password for "Mail"
 *  4. Set ALERT_EMAIL_USER and ALERT_EMAIL_PASS in .env
 */

interface EmailAlertPayload {
    threatType: string;
    severity: string;
    alertCategory: string;
    description: string;
    incidentSummary?: string;
    videoUrl?: string;
    location?: string;
    toEmail?: string;
    timestamp?: string;
}

const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
        case "CRITICAL": return "#ef4444";
        case "HIGH": return "#f97316";
        case "MEDIUM": return "#eab308";
        default: return "#22c55e";
    }
};

export const sendEmailAlert = async (
    payload: EmailAlertPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const user = process.env.ALERT_EMAIL_USER;
    const pass = process.env.ALERT_EMAIL_PASS;
    const toEmail = payload.toEmail || process.env.ALERT_EMAIL_TO || user;

    if (!user || !pass) {
        console.warn("⚠️ Email alerts not configured — set ALERT_EMAIL_USER and ALERT_EMAIL_PASS in .env");
        return { success: false, error: "Email not configured" };
    }

    if (!toEmail) {
        console.warn("⚠️ No recipient email address provided");
        return { success: false, error: "No recipient email" };
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });

    const now = payload.timestamp
        || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const sevColor = getSeverityColor(payload.severity);

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f14;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px 16px 0 0;padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <table width="100%"><tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:4px;">CrimeWatch AI</div>
              <div style="font-size:22px;font-weight:800;color:#ffffff;">🚨 Security Alert</div>
            </td>
            <td align="right">
              <div style="display:inline-block;background:${sevColor}22;border:1px solid ${sevColor}66;color:${sevColor};font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:5px 14px;border-radius:999px;">
                ${payload.severity} SEVERITY
              </div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Threat Info -->
        <tr><td style="background:#13131f;padding:28px 32px;">
          <div style="font-size:18px;font-weight:700;color:#ffffff;margin-bottom:6px;">
            ⚠️ ${payload.threatType}
          </div>
          <div style="font-size:12px;font-weight:600;color:${sevColor};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
            ${payload.alertCategory}
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.6;">${payload.description}</p>
          </div>

          ${payload.location && payload.location !== "Unknown Location" ? `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:13px;color:rgba(255,255,255,0.4);">📍 Location:</span>
            <span style="font-size:13px;font-weight:600;color:#ffffff;">${payload.location}</span>
          </div>` : ""}

          <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
            <span style="font-size:13px;color:rgba(255,255,255,0.4);">🕐 Detected:</span>
            <span style="font-size:13px;font-weight:600;color:#ffffff;">${now}</span>
          </div>

          ${payload.incidentSummary ? `
          <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:10px;padding:16px;margin-bottom:20px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(99,102,241,0.8);margin-bottom:8px;">Incident Summary</div>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.7;font-style:italic;">"${payload.incidentSummary}"</p>
          </div>` : ""}

          ${payload.videoUrl ? `
          <!-- Video Button -->
          <div style="text-align:center;margin-top:8px;">
            <a href="${payload.videoUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">
              ▶ Watch Footage Now
            </a>
            <p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.25);">
              ⏰ This link expires in 30 minutes — click immediately
            </p>
            <p style="margin:4px 0 0;font-size:10px;color:rgba(255,255,255,0.15);word-break:break-all;">${payload.videoUrl}</p>
          </div>` : ""}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0d0d18;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);text-align:center;">
            CrimeWatch AI · Automated Security Alert · Do not reply to this email
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const textBody = [
        `[CrimeWatch AI] SECURITY ALERT`,
        `Threat: ${payload.threatType} (${payload.severity})`,
        `Category: ${payload.alertCategory}`,
        payload.description,
        payload.location && payload.location !== "Unknown Location" ? `Location: ${payload.location}` : "",
        `Time: ${now}`,
        payload.incidentSummary ? `Summary: ${payload.incidentSummary}` : "",
        payload.videoUrl ? `\nWatch footage (expires in 30 min):\n${payload.videoUrl}` : "",
    ].filter(Boolean).join("\n");

    try {
        console.log(`📧 Sending email alert to: ${toEmail}`);
        const info = await transporter.sendMail({
            from: `"CrimeWatch AI" <${user}>`,
            to: toEmail,
            subject: `🚨 [${payload.severity}] ${payload.threatType} Detected — ${payload.location || "Unknown Location"}`,
            text: textBody,
            html: htmlBody,
        });

        console.log(`✅ Email alert sent! MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error(`❌ Email alert failed:`, error.message);
        return { success: false, error: error.message };
    }
};
