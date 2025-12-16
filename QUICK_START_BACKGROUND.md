# ⚡ QUICK START - Background Notifications

## 🚀 One-Time Setup

### 1. Rebuild App
```powershell
Set-Location "d:\Academic\Mobile Computing\Project\Codebase\frontend"
npx expo prebuild --clean
npx expo run:android
```

### 2. Grant Permissions
When app opens, allow:
- ✅ Notifications
- ✅ Location (while using)
- ⚠️ **Location (all the time)** ← CRITICAL!

### 3. Verify
Check test panel shows: `BG: ✅`

---

## 🧪 Quick Test

### Test Background Notification:
1. Add event starting in **1-2 minutes**
2. **Close app completely** (swipe from recent apps)
3. Wait for notification time
4. 🎉 Notification appears!

---

## 📱 What You'll See

### Persistent Notification
```
Event Reminders Active
Checking for upcoming events near you
```
↑ This means background task is working!

### Test Panel
```
🧪 Test Notifications:
[📨 Test] [📍 Location] [🔐 Perms] [🔄 BG Task]

Perms: ✅ Notif | ✅ Location | BG: ✅
```

---

## ⚙️ Configuration

Edit `constants/campus.ts`:

```typescript
// Campus location (YOUR UNIVERSITY)
CAMPUS_COORDINATES = {
  latitude: 5.949490,
  longitude: 80.512983,
}

// Notification radius
NOTIFICATION_RADIUS_KM = 2

// Time window (2 min test, 60 production)
REMINDER_TIME_BEFORE_EVENT_MINUTES = 2
```

---

## 🐛 Quick Fixes

### "BG: ❌" showing
→ Tap "🔄 BG Task" button

### No notification with app closed
→ Settings → Apps → Uni Mate → Permissions
→ Location → **Allow all the time**

### Test notification doesn't work
→ Tap "🔐 Perms" button

---

## ✅ Working When...

1. `BG: ✅` in test panel
2. Persistent notification visible
3. Test notification works
4. Notification appears with app closed

---

## 📚 Full Documentation

- `BACKGROUND_FIX_SUMMARY.md` - What was fixed
- `BACKGROUND_NOTIFICATIONS_SETUP.md` - Complete guide
- `TESTING_GUIDE.md` - Detailed testing

---

**Key Point**: The persistent "Event Reminders Active" notification means background checking is working!
