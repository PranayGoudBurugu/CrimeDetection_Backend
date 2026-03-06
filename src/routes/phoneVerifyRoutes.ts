import express, { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

/**
 * POST /verify-phone/start
 *
 * Initiates a Twilio Outgoing Caller ID verification call.
 * Twilio calls the phone, reads a code, user enters it on their keypad.
 * The same code is returned to us — we show it on the UI so the user knows what to expect.
 */
router.post("/verify-phone/start", async (req: Request, res: Response) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        res.status(400).json({ success: false, error: "phoneNumber is required" });
        return;
    }

    // Normalise to E.164 — add +91 if a bare 10-digit Indian number is given
    let e164 = phoneNumber.trim();
    if (/^\d{10}$/.test(e164)) e164 = `+91${e164}`;
    if (!e164.startsWith("+")) e164 = `+${e164}`;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        res.status(500).json({ success: false, error: "Twilio credentials not configured on server" });
        return;
    }

    try {
        console.log(`📞 Starting Twilio caller ID verification for: ${e164}`);

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json`;

        const body = new URLSearchParams({
            PhoneNumber: e164,
            FriendlyName: "CrimeWatch Alert Number",
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
        console.log("📞 Twilio verification initiation response:", JSON.stringify(result, null, 2));

        if (!response.ok) {
            const msg = result?.message || "Verification failed";
            console.error(`❌ Twilio verification error ${result?.code}: ${msg}`);
            res.status(400).json({ success: false, error: msg, code: result?.code });
            return;
        }

        // validation_code is the code Twilio will ask the user to enter on their phone during the call
        const validationCode: string = result.validation_code;
        const callSid: string = result.call_sid;

        console.log(`✅ Twilio is calling ${e164}. Validation code: ${validationCode}`);

        res.json({
            success: true,
            validationCode,
            callSid,
            phoneNumber: e164,
            message: `Twilio is calling ${e164}. When you answer, enter the code shown below followed by #`,
        });
    } catch (error: any) {
        console.error("❌ Error starting phone verification:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /verify-phone/status/:callSid
 *
 * Check if the verification call completed (caller entered the code).
 * Twilio marks the OutgoingCallerIds entry as verified once the user enters the code.
 */
router.get("/verify-phone/status/:phoneNumber", async (req: Request, res: Response) => {
    const rawPhone = decodeURIComponent(req.params.phoneNumber);
    let e164 = rawPhone.trim();
    if (/^\d{10}$/.test(e164)) e164 = `+91${e164}`;
    if (!e164.startsWith("+")) e164 = `+${e164}`;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        res.status(500).json({ success: false, error: "Twilio credentials not configured" });
        return;
    }

    try {
        // List verified OutgoingCallerIds and see if this number appears
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(e164)}`;

        const response = await fetch(url, {
            headers: {
                Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
            },
        });

        const result: any = await response.json();
        const verified = result?.outgoing_caller_ids?.length > 0;

        res.json({ success: true, verified, phoneNumber: e164 });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
