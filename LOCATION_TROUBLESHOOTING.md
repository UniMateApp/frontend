# 🔧 Location Issues Troubleshooting

## Common Error: "Current location is unavailable"

This error means the app cannot get your location. Here's how to fix it:

## ✅ Step-by-Step Fix

### 1. Enable Location Services on Device

**Android:**
```
Settings → Location → Turn ON
```

Make sure the main location toggle is ON (blue).

### 2. Grant App Permissions

**For Background Notifications (CRITICAL):**
```
Settings → Apps → Uni Mate → Permissions → Location
→ Select "Allow all the time"
```

**Options:**
- ❌ Don't allow - Won't work
- ❌ Allow only while using the app - Only works when app is open
- ✅ **Allow all the time** - Works even when app is closed ← SELECT THIS!

### 3. Disable Battery Optimization

Some Android devices kill background tasks to save battery.

```
Settings → Apps → Uni Mate → Battery
→ Select "Unrestricted"
```

**OR:**

```
Settings → Battery → Battery optimization
→ Find "Uni Mate"
→ Select "Don't optimize"
```

### 4. Check Location Mode

```
Settings → Location → Location mode
→ Select "High accuracy"
```

Options:
- High accuracy (GPS + WiFi + Mobile) - Best
- Battery saving (WiFi + Mobile only) - OK
- Device only (GPS only) - May be slow

### 5. Restart Location Services

If still not working:

1. Turn OFF location (Settings → Location → OFF)
2. Wait 5 seconds
3. Turn ON location
4. Open Uni Mate app

### 6. Rebuild App

Sometimes permissions get stuck:

```powershell
# Uninstall
adb uninstall com.anonymous.unimate

# Reinstall
cd "d:\Academic\Mobile Computing\Project\Codebase\frontend"
npx expo run:android
```

## 🧪 Test Location is Working

### Method 1: Use Test Button

1. Open Uni Mate app
2. Go to Events screen
3. Tap "📍 Location" button
4. Should show distance to campus

**If you see:**
- ✅ "You are within campus radius" - Location working!
- ❌ Error message - Location not working, follow steps above

### Method 2: Check Console

```powershell
# Connect device and run:
adb logcat | Select-String "ImmediateNotifier"
```

**Good logs:**
```
[ImmediateNotifier] 📍 Getting user location...
[ImmediateNotifier] User location: {lat: 5.9494, lng: 80.5129}
[ImmediateNotifier] Distance to campus: 0.15 km
[ImmediateNotifier] ✅ User is within campus radius!
```

**Bad logs:**
```
[ImmediateNotifier] ⚠️ Location services are disabled on device
→ Fix: Enable location in Settings → Location

[ImmediateNotifier] ⚠️ Location permission not granted
→ Fix: Settings → Apps → Uni Mate → Permissions → Location → Allow all the time

[ImmediateNotifier] ❌ Location request timed out
→ Fix: Change location mode to "High accuracy"
```

## 📱 Device-Specific Issues

### Samsung Phones

Samsung has aggressive battery management:

```
Settings → Apps → Uni Mate → Battery
→ Allow background activity: ON
→ Optimize battery usage: OFF

Settings → Device care → Battery → App power management
→ Apps that won't be put to sleep: Add Uni Mate
```

### Xiaomi/Redmi Phones (MIUI)

MIUI is very aggressive with background apps:

```
Settings → Apps → Manage apps → Uni Mate
→ Autostart: ON
→ Battery saver: No restrictions
→ Display pop-up windows while running in the background: Allow

Settings → Additional settings → Privacy → Location
→ Turn ON
```

### OnePlus/Realme Phones

```
Settings → Battery → Battery optimization
→ Uni Mate → Don't optimize

Settings → Apps → Uni Mate
→ Mobile data & Wi-Fi → Enable background data
```

### Huawei Phones

```
Settings → Apps → Apps → Uni Mate
→ Battery → Launch
→ Manage manually
→ Auto-launch: ON
→ Secondary launch: ON
→ Run in background: ON
```

## 🔍 Check Background Task Status

### Visual Check

When background task is running, you should see a **persistent notification**:

```
┌─────────────────────────────────┐
│ Event Reminders Active          │
│ Checking for upcoming events    │
│ near you                        │
└─────────────────────────────────┘
```

**If you don't see this notification:**
- Background task is NOT running
- Tap "🔄 BG Task" button in Events screen
- Check if `BG: ✅` shows in status line

### Console Check

```powershell
adb logcat | Select-String "BackgroundTask"
```

**Should see every 1 minute:**
```
[BackgroundTask] 🔄 Background task triggered at 10:23:45
[BackgroundTask] Checking 3 events
[BackgroundTask] User location: {lat: 5.9494, lng: 80.5129}
```

**If you see:**
```
[BackgroundTask] ⚠️ No location data in task
```

This means background location is not providing data. Fix:
1. Grant "Allow all the time" permission
2. Disable battery optimization
3. Rebuild app

## 🎯 Complete Setup Checklist

Verify each item:

- [ ] Location services enabled (Settings → Location → ON)
- [ ] App permission: "Allow all the time"
- [ ] Battery optimization: "Unrestricted" or "Don't optimize"
- [ ] Location mode: "High accuracy"
- [ ] Background task status: `BG: ✅`
- [ ] Persistent notification visible: "Event Reminders Active"
- [ ] Test button works (📍 Location shows distance)
- [ ] Console shows location updates every minute

## 🚨 Emergency Fix

If nothing works:

```powershell
# 1. Completely uninstall
adb uninstall com.anonymous.unimate

# 2. Clear ADB data
adb shell pm clear com.anonymous.unimate

# 3. Clean rebuild
cd "d:\Academic\Mobile Computing\Project\Codebase\frontend"
npx expo prebuild --clean
npx expo run:android

# 4. When app opens:
#    - Allow notifications
#    - Allow location "All the time"
#    - Tap "🔄 BG Task" button
```

## 📊 Expected vs Actual

### Expected (Working):

```
Status: Perms: ✅ Notif | ✅ Location | BG: ✅
Persistent notification: Visible
Test location: Shows distance
Console: Location updates every minute
Notifications: Work even with app closed
```

### Actual (Your Issue):

```
Error: Current location is unavailable
Cause: Location services disabled OR permission not granted OR battery optimization killing task
```

## 🔑 Most Common Causes

1. **Location permission NOT "Allow all the time"** (90% of issues)
2. **Location services disabled on device** (5%)
3. **Battery optimization killing background task** (3%)
4. **Device-specific battery management** (2%)

## 💡 Pro Tips

1. **After granting "Allow all the time"**, restart the app
2. **Keep persistent notification visible** - it confirms background task is running
3. **Test with "📍 Location" button first** before testing full flow
4. **Check console logs** to see exactly what's failing
5. **Some devices need manual battery exception** for aggressive battery management

## ✅ Working Indicator

You'll know it's working when:

1. ✅ "📍 Location" button shows your distance
2. ✅ Console shows location updates
3. ✅ `BG: ✅` in status
4. ✅ Persistent notification visible
5. ✅ Event added → Close app → Get notification!

---

**Bottom line**: Make sure you grant "Allow all the time" location permission and disable battery optimization for the app!
