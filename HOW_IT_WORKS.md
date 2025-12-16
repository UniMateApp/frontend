# 🔔 How the Notification System Works

## Quick Overview

**When you add or load events, the app:**
1. ✅ Gets your current location
2. ✅ Checks if you're within 2km of campus
3. ✅ Checks if any events are starting within 2 minutes (testing) or 1 hour (production)
4. ✅ If YES to all → Sends notification immediately!

## Key Files

### Services
- `services/immediateNotifier.ts` - Main notification logic
- `services/backgroundScheduler.ts` - Permission requests & notification handler

### Configuration
- `constants/campus.ts` - Campus location & notification settings

### Integration
- `hooks/useEventScheduler.ts` - React hook that runs the system
- `app/_layout.tsx` - Requests permissions on app start
- `app/(tabs)/events.tsx` - Uses the hook and shows test buttons

## Important Configuration

```typescript
// constants/campus.ts

// YOUR UNIVERSITY LOCATION
CAMPUS_COORDINATES = {
  latitude: 5.949490,
  longitude: 80.512983,
}

// Distance from campus to send notifications
NOTIFICATION_RADIUS_KM = 2 // kilometers

// How soon before event to notify
// For testing: 2 minutes
// For production: 60 minutes (1 hour)
REMINDER_TIME_BEFORE_EVENT_MINUTES = 2
```

## Testing in 3 Steps

1. **Test Notification Permission:**
   - Open app
   - Tap "📨 Send Test" button
   - Should see notification

2. **Test Location:**
   - Tap "📍 Check Location" button
   - Should show distance to campus

3. **Test Full Flow:**
   - Add event starting in 1-2 minutes
   - If within 2km → Notification appears immediately

## Console Logs to Watch

Good:
```
✅ User is within campus radius!
✅ Event "Test" is eligible for notification
📨 Sending notification for: "Test"
🎉 Sent 1 notification(s)
```

Bad:
```
❌ Notification permission not granted
⚠️ User is outside campus radius
⚠️ Event has no start time
```

## Common Issues

| Problem | Solution |
|---------|----------|
| No notification permission | Tap "🔐 Request Perms" button |
| Outside campus | Use "📍 Check Location" to see distance |
| Event not notifying | Event must start within 2 minutes |
| No test panel | Rebuild: `npx expo run:android` |

## How to Change Reminder Time

```typescript
// For 1 hour before event:
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 60;

// For 30 minutes before event:
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 30;

// For 2 minutes (testing):
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 2;
```

## Notification Message

```
📍 Event Starting Soon!
"[Event Title]" is starting soon at [Location]!
You're [X.XX] km away.
```

## Files Modified from Original

1. ✅ Created `services/immediateNotifier.ts` (NEW)
2. ✅ Updated `hooks/useEventScheduler.ts` (immediate checking instead of scheduling)
3. ✅ Updated `constants/campus.ts` (changed to minutes)
4. ✅ Updated `app/_layout.tsx` (permission requests on start)
5. ✅ Updated `app/(tabs)/events.tsx` (added test buttons)

## Build Commands

```bash
# Development build (shows test buttons)
npx expo run:android

# Check for a specific device
adb devices
npx expo run:android --device [device-id]

# Clean build
npx expo prebuild --clean
npx expo run:android
```
