# 🧪 Testing the Immediate Location-Based Notification System

## ✅ What Changed

The system now works **completely differently** from before:

### Old System (Scheduled):
- Scheduled notifications for 1 hour before each event
- Location checked at notification trigger time (requires background tasks)
- Didn't work in Expo managed workflow

### New System (Immediate):
- Checks location **immediately** when you add/load events
- Sends notification **right away** if you're within 2km of campus
- Event must be starting within the reminder time window (2 minutes for testing)
- Works perfectly in Expo managed workflow

## 🎯 How It Works Now

1. **User opens app** → Permissions requested automatically
2. **Events load** → System checks your location immediately
3. **Within 2km of campus?** → Check if any events starting within 2 minutes
4. **Event found?** → Send notification immediately!

## 📱 Step-by-Step Testing Guide

### Step 1: Rebuild the App

**IMPORTANT**: You MUST rebuild after code changes:

```bash
cd "d:\Academic\Mobile Computing\Project\Codebase\frontend"
npx expo run:android
```

### Step 2: Open the App

When you first open the app, you should see:

**In Console (Chrome DevTools - press 'j' in terminal):**
```
[App] 🚀 Initializing app...
[App] ✅ Notification handler configured
[App] Requesting notification permissions...
```

**On Device:**
- Permission dialog for notifications (tap "Allow")
- Permission dialog for location (tap "Allow" or "Allow while using app")

### Step 3: Check Test Buttons

At the top of the Events screen, you'll see a blue test panel with 3 buttons:

#### Button 1: "📨 Send Test"
- Sends immediate test notification
- Should appear in notification tray
- **If this works**: Notifications are configured correctly ✅

#### Button 2: "📍 Check Location"
- Gets your current location
- Calculates distance to campus
- Shows alert with result
- **If shows < 2km**: You're within range ✅

#### Button 3: "🔐 Request Perms"
- Requests all permissions again
- Use if permissions were denied

### Step 4: Test Real Event Notification

1. **Add a Test Event:**
   - Tap "+ Add Event" button
   - Create event with:
     - Title: "Test Event"
     - Start time: **Current time + 1 minute** (very important!)
     - Location: "Campus"
     - Description: "Testing notifications"
   - Tap "Create Event"

2. **What Should Happen:**
   ```
   [EventScheduler] Events changed, checking location and notifying...
   [ImmediateNotifier] 🔍 Checking 1 events for notifications...
   [ImmediateNotifier] 📍 Getting user location...
   [ImmediateNotifier] User location: {lat: X.XXX, lng: Y.YYY}
   [ImmediateNotifier] Distance to campus: X.XX km
   [ImmediateNotifier] ✅ User is within campus radius!
   [ImmediateNotifier] ✅ Event "Test Event" is eligible for notification
   [ImmediateNotifier] 📨 Sending notification for: "Test Event"
   [ImmediateNotifier] ✅ Notification sent for "Test Event"
   [ImmediateNotifier] 🎉 Sent 1 notification(s)
   ```

3. **Check Notification Tray:**
   - You should see: "📍 Event Starting Soon! 'Test Event' is starting soon at Campus! You're X.XX km away."

## 🔍 Troubleshooting

### "Test notification button doesn't send anything"

**Check:**
1. Notification permission granted?
   - Check status text below buttons
   - Go to Settings → Apps → Uni Mate → Notifications
   - Enable all notification settings

2. Check console for errors:
   ```
   [ImmediateNotifier] ❌ Error sending test notification: ...
   ```

**Fix:**
```bash
# Uninstall and reinstall
adb uninstall com.anonymous.unimate
npx expo run:android
```

### "Location check says permission denied"

**Check:**
1. Location permission granted?
   - Settings → Apps → Uni Mate → Permissions
   - Location → Allow while using app

2. Location services enabled?
   - Settings → Location → Turn on

**Fix:**
- Tap "🔐 Request Perms" button
- Or reinstall app

### "Notification sent but event isn't starting soon"

**Expected!** Event must start within 2 minutes (testing window).

**To test:**
1. Create event starting in 1 minute
2. OR change `REMINDER_TIME_BEFORE_EVENT_MINUTES` to larger value (e.g., 60 for 1 hour)

### "I'm on campus but it says I'm outside radius"

**Check:**
1. Campus coordinates in `constants/campus.ts`:
   ```typescript
   latitude: 5.949490,  // Your university
   longitude: 80.512983,
   ```

2. Use "📍 Check Location" button to see your actual coordinates

3. Update campus coordinates if needed

4. Radius set to 2km in `constants/campus.ts`

### "No logs appearing in console"

**Fix:**
```bash
# In terminal where expo is running, press:
j  # Opens Chrome DevTools
```

Then check Console tab for logs starting with `[App]`, `[EventScheduler]`, or `[ImmediateNotifier]`

## 📊 Expected Console Logs (Full Flow)

### When App Starts:
```
[App] 🚀 Initializing app...
[App] ✅ Notification handler configured
[App] Requesting notification permissions...
[App] Notification permission: ✅ Granted
[App] Requesting location permissions...
[App] Location permission: ✅ Granted
[App] Background location permission: ✅ Granted
[App] 🎉 App initialization complete

[EventScheduler] 🚀 Initializing event scheduler...
[EventScheduler] Checked permissions: {notifications: true, location: "granted"}
[EventScheduler] ✅ Scheduler initialized and ready
```

### When Events Load:
```
[EventScheduler] 🔍 Checking location and notifying for 3 events...
[EventScheduler] Found 3 upcoming events
[ImmediateNotifier] 🔍 Checking 3 events for notifications...
[ImmediateNotifier] 📍 Getting user location...
[ImmediateNotifier] User location: {lat: 5.9494, lng: 80.5129}
[ImmediateNotifier] Campus location: {latitude: 5.94949, longitude: 80.512983}
[ImmediateNotifier] Distance to campus: 0.01 km
[ImmediateNotifier] ✅ User is within campus radius!
[ImmediateNotifier] Event "Test Event" starting in 1.5 minutes
[ImmediateNotifier] ✅ Event "Test Event" is eligible for notification
[ImmediateNotifier] 📨 Sending notification for: "Test Event"
[ImmediateNotifier] ✅ Notification sent for "Test Event"
[ImmediateNotifier] Event "Other Event" not in notification window (starts in 60.0 min)
[ImmediateNotifier] 🎉 Sent 1 notification(s)
[EventScheduler] ✅ Location check complete
```

### When Test Button Pressed:
```
[ImmediateNotifier] 🧪 Sending test notification...
[ImmediateNotifier] ✅ Test notification sent
```

## 🎛️ Configuration

In `constants/campus.ts`:

```typescript
// Your university coordinates
export const CAMPUS_COORDINATES = {
  latitude: 5.949490,   // Change to your university
  longitude: 80.512983, // Change to your university
};

// Distance from campus to trigger notifications
export const NOTIFICATION_RADIUS_KM = 2; // 2 kilometers

// How soon before event to send notification
// 2 minutes for testing, 60 for production (1 hour)
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 2;
```

## ✅ Success Checklist

- [ ] App rebuilt with `npx expo run:android`
- [ ] Notification permission granted (✅ in test panel)
- [ ] Location permission granted (✅ in test panel)
- [ ] Test notification button works (notification appears)
- [ ] Location check shows distance to campus
- [ ] Created event starting in 1-2 minutes
- [ ] Notification appeared for test event
- [ ] Console logs show successful flow

## 🎉 When Working Correctly

You should see:
1. ✅ Test panel shows: "Perms: ✅ Notif | ✅ Location"
2. ✅ Test notification button → Notification appears
3. ✅ Check location → Shows distance < 2km (if on campus)
4. ✅ Add event (starting soon) → Immediate notification
5. ✅ Console logs show successful flow

## 🚀 For Production

When ready to deploy:

1. Change reminder time to 1 hour:
   ```typescript
   // constants/campus.ts
   export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 60; // 1 hour
   ```

2. Remove test buttons (already wrapped in `__DEV__`)

3. Build release version:
   ```bash
   eas build --platform android --profile production
   ```

## 📞 Still Not Working?

1. Check all console logs for ❌ or ⚠️ symbols
2. Verify app was rebuilt (not just refreshed)
3. Check device settings for both notification and location permissions
4. Try uninstall/reinstall
5. Make sure you're actually within 2km of campus coordinates
6. Make sure event starts within 2 minutes of creation
