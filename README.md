# ⚙️ CrimeWatch AI — Backend

> Node.js + Express + TypeScript backend for CrimeWatch AI.  
> **For full setup instructions, see the [Frontend README](https://github.com/PranayGoudBurugu/CrimeDetection_Frontend/blob/main/README.md).**

---

## Quick Start (Local)

```bash
git clone https://github.com/PranayGoudBurugu/CrimeDetection_Backend.git
cd CrimeDetection_Backend
npm install
cp .env.example .env    # Then fill in your values
npx prisma db push      # Sync DB schema
npm run dev             # Starts on http://localhost:5005
```

---

## Environment Variables

Create a `.env` file in the root:

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# ImageKit (video storage)
IMAGEKIT_PRIVATE_KEY=private_XXXXXXXX
IMAGEKIT_PUBLIC_KEY=public_XXXXXXXX
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/yourusername

# Google Gemini AI
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXX

# Server
FRONTEND_URL=http://localhost:3000
PUBLIC_BACKEND_URL=http://localhost:5005   # Change to Vercel URL in production

# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TO_PHONE=+91XXXXXXXXXX

# Gmail Email Alerts
ALERT_EMAIL_USER=your-gmail@gmail.com
ALERT_EMAIL_PASS=xxxxxxxxxxxxxxxxxxxx   # Gmail App Password (no spaces)
ALERT_EMAIL_TO=your-gmail@gmail.com
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/getanalysis` | Upload video + run ML analysis |
| `GET` | `/history` | Get all past analyses |
| `GET` | `/analysis/:id` | Get a specific analysis |
| `DELETE` | `/analysis/:id` | Delete an analysis |
| `GET` | `/watch/:token` | View expiring video (no auth) |
| `GET` | `/stream/uploads/:filename` | Stream video bytes (Range support) |
| `GET` | `/settings` | Get admin settings |
| `PUT` | `/settings` | Update Gemini API key |
| `GET` | `/health` | Health check |

---

## Gemini Model Fallback Chain

The app tries models in this order when one fails:
1. `gemini-2.5-flash` — current stable, fastest
2. `gemini-2.5-flash-preview-09-2025` — preview, separate quota
3. `gemini-2.0-flash-001` — deprecated but operational fallback

**Retry logic:**
- `429 Quota exceeded` → waits **60 seconds** then retries
- `503 Overload` → waits **6 seconds** then retries

---

## SMS Alert Format

```
CrimeWatch ALERT: {threat_type} ({severity}) @ {location}.
Map: https://maps.google.com/?q={lat},{lng}
Footage: https://your-backend.vercel.app/watch/{token}
```

The watch link is a **30-minute expiring token** — no login required to view.

---

## Email Alert

Sends a rich HTML email via Gmail SMTP with:
- Threat type, severity, category
- GPS location + Google Maps link
- "Watch Footage Now" button (opens auto-playing video)

> Setup: Generate a Gmail **App Password** at https://myaccount.google.com/apppasswords

---

## Deploy to Vercel

1. Push to GitHub (already done)
2. Go to https://vercel.com → Import this repo
3. Add all `.env` variables in Vercel's Environment Variables panel
4. Set `PUBLIC_BACKEND_URL` = your Vercel deployment URL
5. Deploy ✓

---

*Full documentation: [Frontend README](https://github.com/PranayGoudBurugu/CrimeDetection_Frontend/blob/main/README.md)*
