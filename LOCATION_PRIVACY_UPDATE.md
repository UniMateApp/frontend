# Location Privacy Update - University of Moratuwa

## Overview
The Lost & Found system has been updated to use a **fixed location** approach for privacy and simplicity.

---

## What Changed

### 1. **Fixed Location**
- All Lost & Found posts automatically use: **"University of Moratuwa"**
- Coordinates: `6.7964, 79.9014`
- Location is set in the backend - users cannot see or modify it
- No GPS or device location permissions required

### 2. **UI Simplification**
✅ **Removed:**
- Google Maps integration
- GPS location picker
- Manual coordinate entry
- "Use My Location" button
- All location-related UI components

✅ **Kept:**
- Item title
- Description
- Contact info
- Photo upload
- Lost/Found type selection

✅ **Added:**
- Simple read-only location indicator showing "University of Moratuwa"

### 3. **Bi-Directional Notifications**
The notification system now works both ways:

**When a LOST item is posted:**
- → Notifies all users who posted FOUND items

**When a FOUND item is posted:**
- → Notifies all users who posted LOST items

**No distance/location matching** - all notifications assume University of Moratuwa campus.

---

## Technical Implementation

### Files Modified

#### 1. `constants/campus.ts`
```typescript
// Fixed location for University of Moratuwa
export const CAMPUS_COORDINATES = {
  latitude: 6.7964,
  longitude: 79.9014,
};

export const DEFAULT_LOCATION_NAME = "University of Moratuwa";
export const DEFAULT_LOCATION = `${CAMPUS_COORDINATES.latitude},${CAMPUS_COORDINATES.longitude}`;
```

#### 2. `components/lost-found-modal.tsx`
**Removed:**
- `expo-location` imports
- `react-native-maps` imports
- Location state variables (`selectedLocation`, `latInput`, `lngInput`)
- Map UI components
- GPS permission requests
- Location handler functions

**Added:**
- Import `DEFAULT_LOCATION` and `DEFAULT_LOCATION_NAME` from constants
- Read-only location info box with university icon
- Automatic location assignment in submit function

**Updated:**
- Validation logic (no longer checks for location)
- Submit function uses `DEFAULT_LOCATION`
- Notification metadata uses `DEFAULT_LOCATION_NAME`

#### 3. Notification Logic
```typescript
// Post creation
const post = {
  // ... other fields
  location: DEFAULT_LOCATION, // Fixed: 6.7964,79.9014
};

// Notification metadata
const metadata = {
  matched_post_ids: matchedIds,
  new_post_client_id: post.id,
  kind: post.type.toLowerCase(),
  location: DEFAULT_LOCATION_NAME, // "University of Moratuwa"
};
```

---

## Benefits

### Privacy
✅ No GPS tracking
✅ No device location access
✅ No location data collection
✅ Users' whereabouts remain private

### Simplicity
✅ Faster post creation
✅ Less friction in UI
✅ No permission prompts
✅ Works offline (for location part)

### University-Scoped
✅ All items assumed to be on campus
✅ Notifications relevant to campus community
✅ Simple mental model for users

---

## Future Customization

To change the default location, simply edit `constants/campus.ts`:

```typescript
export const CAMPUS_COORDINATES = {
  latitude: YOUR_LATITUDE,
  longitude: YOUR_LONGITUDE,
};

export const DEFAULT_LOCATION_NAME = "Your University Name";
```

All Lost & Found posts will automatically use the new location.

---

## Testing Checklist

- [ ] Create a LOST item → verify it posts successfully
- [ ] Create a FOUND item → verify it posts successfully  
- [ ] Check database → location should be `6.7964,79.9014`
- [ ] Post LOST item → users with FOUND items should get notified
- [ ] Post FOUND item → users with LOST items should get notified
- [ ] UI should show "Location: University of Moratuwa" (read-only)
- [ ] No map should appear in the modal
- [ ] No location permissions requested

---

## Migration Notes

### For Existing Posts
- Old posts with GPS coordinates will still work
- New posts will use the fixed location
- Notifications will work for both old and new posts

### For Existing Users
- No action required
- Next time they post, location will be automatic
- No more location permission prompts

---

**Last Updated:** December 17, 2025
**Status:** ✅ Implemented and Ready for Production
