import dotenv from "dotenv";
dotenv.config();

/**
 * Twilio SMS Alert Service - CrimeWatch AI
 *
 * Sends SMS alerts via Twilio REST API when violence/fights are detected.
 * Uses native fetch (no extra npm dependency needed).
 */

interface ThreatAlertPayload {
    threatType: string;
    severity: string;
    alertCategory: string;
    description: string;
    incidentSummary?: string;
    videoUrl?: string;
    location?: string;
    toPhone?: string;
    timestamp?: string;
}

/**
 * Send an SMS alert via Twilio when a threat is detected
 */
export const sendThreatAlert = async (
    payload: ThreatAlertPayload
): Promise<{ success: boolean; messageSid?: string; error?: string }> => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    // Use payload phone number if provided, otherwise fallback to env
    let targetPhone = payload.toPhone || process.env.TWILIO_TO_PHONE;

    // Auto-prefix Indian numbers with +91 if they don't have a country code
    if (targetPhone && !targetPhone.startsWith("+")) {
        // Remove any non-digit characters in case user entered dashes/spaces
        const digitsOnly = targetPhone.replace(/\D/g, "");
        if (digitsOnly.length === 10) {
            targetPhone = `+91${digitsOnly}`;
        } else {
            targetPhone = `+${digitsOnly}`;
        }
    }

    // Validate configuration
    if (!accountSid || !authToken || !messagingServiceSid) {
        console.warn("⚠️ Twilio not configured — skipping SMS alert");
        console.warn("   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID in .env");
        return { success: false, error: "Twilio not configured" };
    }

    if (!targetPhone) {
        console.warn("⚠️ No target phone number provided for SMS alert");
        return { success: false, error: "Missing target phone number" };
    }

    // Compose the alert message
    const now = payload.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    let message = `🚨 *CrimeWatch AI ALERT* 🚨\n\n`;
    message += `⚠️ Threat: ${payload.threatType}\n`;
    message += `🔴 Severity: ${payload.severity}\n`;
    message += `📋 Category: ${payload.alertCategory}\n`;
    message += `📝 ${payload.description}\n\n`;

    if (payload.location) {
        message += `📍 Location: ${payload.location}\n`;
    }

    message += `🕐 Time: ${now}\n`;

    if (payload.incidentSummary) {
        message += `\n📄 Incident Summary:\n${payload.incidentSummary}\n`;
    }

    if (payload.videoUrl) {
        message += `\n🎥 View Footage:\n${payload.videoUrl}\n`;
    }

    message += `\n⚡ Immediate response recommended.`;

    try {
        console.log(`📱 Sending SMS alert to ${targetPhone}...`);

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const body = new URLSearchParams({
            To: targetPhone,
            MessagingServiceSid: messagingServiceSid,
            Body: message,
        });

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },


            body: body.toString(),
        });

        const result: any = await response.json();

        if (response.ok) {
            console.log(`✅ SMS alert sent successfully! SID: ${result.sid}`);
            return { success: true, messageSid: result.sid };
        } else {
            console.error(`❌ Twilio API error: ${result.message || result.code}`);
            return { success: false, error: result.message || "Twilio API error" };
        }
    } catch (error: any) {
        console.error("❌ Failed to send SMS alert:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Check if any segments contain a fight/violence that warrants an SMS alert.
 * Returns the most severe violence segment, or null if none found.
 */
export const findViolenceAlert = (
    segments: any[]
): ThreatAlertPayload | null => {
    if (!segments || segments.length === 0) return null;

    // Find segments with VIOLENCE or WEAPON category that are HIGH or CRITICAL severity
    const alertSegments = segments.filter((s) => {
        const category = (s.alertCategory || "").toUpperCase();
        const severity = (s.severity || "").toUpperCase();
        return (
            (category === "VIOLENCE" || category === "WEAPON") &&
            (severity === "HIGH" || severity === "CRITICAL")
        );
    });

    if (alertSegments.length === 0) return null;

    // Return the most critical one
    const sorted = alertSegments.sort((a, b) => {
        const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (severityOrder[b.severity?.toUpperCase()] || 0) - (severityOrder[a.severity?.toUpperCase()] || 0);
    });

    const worst = sorted[0];

    return {
        threatType: worst.threatType || "Violence Detected",
        severity: worst.severity || "HIGH",
        alertCategory: worst.alertCategory || "VIOLENCE",
        description: worst.description || "Violent activity detected in CCTV footage",
    };
};
