# Quick Reference Guide

## 🚀 Getting Started

### Start the Backend Server
```bash
cd /Users/anuragnarsingoju/Projects/nithya-analysis-backend
npm run dev
```

Server runs on: `http://localhost:5005`

---

## 🔑 Admin Access

**Admin Email:** `anuragnarsingoju@gmail.com`

**Admin Features:**
- Model selection (Gemini/Local)
- API key management
- Default model configuration

**Access:** Dashboard → Settings → Admin Settings (top panel)

---

## 🎯 Quick API Reference

### Analyze Video with Gemini
```bash
curl -X POST http://localhost:5005/getanalysis \
  -F "video=@dance.mp4" \
  -F "modelType=gemini" \
  -F "prompt=Analyze this Bharatanatyam performance"
```

### Analyze Video with Local Model
```bash
curl -X POST http://localhost:5005/getanalysis \
  -F "video=@dance.mp4" \
  -F "modelType=local"
```

### Get Available Models
```bash
curl http://localhost:5005/models
```

### Get Settings (Admin)
```bash
curl http://localhost:5005/settings
```

### Update Settings (Admin)
```bash
curl -X PUT http://localhost:5005/settings \
  -H "Content-Type: application/json" \
  -d '{
    "default_model": "local",
    "gemini_api_key": "your-api-key-here"
  }'
```

---

## 📊 Database Quick Commands

### Connect to Database
```bash
psql -U anuragnarsingoju -d nithya_analysis
```

### Check Analyses
```sql
SELECT id, video_filename, model_type, status 
FROM analyses 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Settings
```sql
SELECT * FROM settings;
```

### View Model Usage Stats
```sql
SELECT 
  model_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
FROM analyses
GROUP BY model_type;
```

---

## 🔧 Common Tasks

### Add New Admin User
1. Edit `nithya-analysis/lib/adminCheck.ts`
2. Add email to `ADMIN_EMAILS` array
3. Edit `src/middleware/adminAuth.ts`
4. Add same email to `ADMIN_EMAILS` array

### Change Default Model
1. Login as admin
2. Go to Settings
3. Click desired model in Admin Settings
4. Click "Save Admin Settings"

### Update Gemini API Key
1. Login as admin
2. Go to Settings
3. Enter new API key in password field
4. Click "Save Admin Settings"

### Test Both Models
```bash
./test_dual_models.sh
```

---

## 📁 Important Files

### Backend
- `src/controllers/analysisController.ts` - Analysis logic
- `src/controllers/settingsController.ts` - Settings management
- `src/services/mlService.ts` - Gemini AI integration
- `src/services/localModelService.ts` - Local model integration
- `database/schema.sql` - Main database schema
- `database/settings_schema.sql` - Settings table schema

### Frontend
- `pages/SettingsPage.tsx` - Settings UI with admin panel
- `lib/adminCheck.ts` - Admin role checker

### Documentation
- `COMPLETE_IMPLEMENTATION_SUMMARY.md` - Master summary
- `DUAL_MODEL_GUIDE.md` - Dual model usage guide
- `ADMIN_SETTINGS_IMPLEMENTATION.md` - Admin settings guide
- `ADMIN_ROLE_IMPLEMENTATION.md` - Admin role details

---

## 🐛 Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -ti:5005

# Kill process if needed
kill -9 $(lsof -ti:5005)

# Restart server
npm run dev
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL if needed
brew services start postgresql

# Test connection
psql -U anuragnarsingoju -d nithya_analysis -c "SELECT NOW();"
```

### Admin Panel Not Showing
1. Verify you're logged in as `anuragnarsingoju@gmail.com`
2. Check browser console for errors
3. Refresh the page
4. Clear browser cache

### API Key Not Working
1. Verify key is correct (from Google AI Studio)
2. Check database: `SELECT gemini_api_key FROM settings;`
3. Try updating via admin panel again
4. Check server logs for errors

---

## 📚 Documentation Index

1. **COMPLETE_IMPLEMENTATION_SUMMARY.md** - Start here! Master overview
2. **DUAL_MODEL_GUIDE.md** - How to use dual models
3. **IMPLEMENTATION_DUAL_MODELS.md** - Technical implementation details
4. **ADMIN_SETTINGS_IMPLEMENTATION.md** - Admin settings guide
5. **ADMIN_ROLE_IMPLEMENTATION.md** - Admin role and security

---

## 🎯 Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/getanalysis` | POST | Analyze video |
| `/models` | GET | Get available models |
| `/settings` | GET | Get settings (admin) |
| `/settings` | PUT | Update settings (admin) |
| `/history` | GET | Get analysis history |
| `/analysis/:id` | GET | Get specific analysis |
| `/analysis/:id` | DELETE | Delete analysis |

---

## 💡 Tips

- Use `modelType=gemini` for best accuracy
- Use `modelType=local` for offline processing
- Admin settings persist in database
- API key in database overrides .env
- Check `/models` endpoint to verify both models are available

---

## 🆘 Need Help?

1. Check documentation files
2. Review server logs
3. Test with `./test_dual_models.sh`
4. Check database with SQL queries above

---

**Last Updated:** 2026-01-12  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
