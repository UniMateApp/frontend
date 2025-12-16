# Quick Start Commands

## Rebuild and Run (REQUIRED)

```powershell
# Navigate to project
Set-Location "d:\Academic\Mobile Computing\Project\Codebase\frontend"

# Run the app (this will build if needed)
npx expo run:android
```

## If You Need Clean Build

```powershell
Set-Location "d:\Academic\Mobile Computing\Project\Codebase\frontend"

# Clean prebuild
npx expo prebuild --clean

# Build and run
npx expo run:android
```

## Open Dev Console (for logs)

While app is running, in the terminal:
```
Press 'j' key
```
This opens Chrome DevTools to see console logs.

## Uninstall and Reinstall (if permissions stuck)

```powershell
# Uninstall from device
adb uninstall com.anonymous.unimate

# Rebuild and install
npx expo run:android
```

## Check Connected Devices

```powershell
adb devices
```

## Test the Feature

1. Open app → Allow permissions when asked
2. Check test panel at top of Events screen
3. Tap "📨 Send Test" → Should see notification
4. Tap "📍 Check Location" → Should show distance
5. Add event starting in 1-2 minutes → Should get notification

## See Console Logs

Look for these in Chrome DevTools:
- `[App]` - App initialization
- `[EventScheduler]` - Scheduler status
- `[ImmediateNotifier]` - Notification logic

## Change Reminder Time

Edit `constants/campus.ts`:
```typescript
// For testing (2 minutes):
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 2;

// For production (1 hour):
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 60;
```

## Update Campus Coordinates

Edit `constants/campus.ts`:
```typescript
export const CAMPUS_COORDINATES = {
  latitude: 5.949490,   // Your university latitude
  longitude: 80.512983, // Your university longitude
};
```

## Common Issues

### No notification permission dialog
```powershell
adb uninstall com.anonymous.unimate
npx expo run:android
```

### Test panel not showing
You're not in development mode. It only shows with `npx expo run:android`

### Notification doesn't appear
1. Check permissions in device: Settings → Apps → Uni Mate → Notifications
2. Check console for errors
3. Try "📨 Send Test" button first

### Outside campus radius
Use "📍 Check Location" to see your actual distance. Update campus coordinates if needed.

---

**Most Important**: Use `npx expo run:android` NOT `expo start`
