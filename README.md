# 🎓 UniMate - University Companion App

<p align="center">
  <img src="assets/images/unimate.png" alt="UniMate Logo" width="120" height="120" style="border-radius: 24px;">
</p>

<p align="center">
  <strong>Your all-in-one university companion for events, lost & found, and campus connectivity</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-0.81.4-blue?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-SDK%2054-black?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-Backend-green?logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-lightgrey" alt="Platforms">
</p>

---

## 📖 Overview

**UniMate** is a cross-platform mobile application designed to enhance the university experience by providing students with:

- 📅 **Event Discovery & Management** - Create, discover, and manage campus events
- 🔍 **Lost & Found System** - Report and find lost items on campus
- 💬 **Real-time Chat** - Connect with fellow students instantly
- 🗺️ **Interactive Campus Map** - Locate events and navigate campus
- 📍 **Location-based Reminders** - Get notified when near event locations
- ⭐ **Personal Wishlist** - Save events and items for quick access

---

## ✨ Features

### 🏠 Home Feed
- Unified view of events and lost & found items
- Smart filtering (All, Events, Lost & Found)
- Search functionality across all content
- Automatic hiding of resolved items and past events

### 📅 Events
- Create events with location picker on map
- Event details with image upload
- Share events with friends
- Add events to personal wishlist
- Location-based event reminders
- Owner can edit/delete their events

### 🔍 Lost & Found
- Report lost or found items
- Image upload for items
- Contact information sharing
- Mark items as resolved
- Filter by "All" or "My Posts"

### 💬 Real-time Chat
- One-on-one messaging
- Location sharing in chat
- Real-time message delivery
- Read receipts
- Push notifications for new messages

### 🗺️ Campus Map
- Interactive Google Maps integration
- View events on map with markers
- User's current location display
- Navigate to event locations

### ⭐ Wishlist
- Save favorite events
- Save interesting lost & found items
- Quick access to saved items
- Real-time sync across devices

### 🔔 Notifications
- Push notifications for messages
- Event reminder notifications
- Proximity-based alerts
- In-app notification center

### 👤 Profile
- User profile management
- Edit profile information
- Sign out functionality

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.4 | Cross-platform mobile framework |
| **Expo** | SDK 54 | Development platform & tooling |
| **TypeScript** | 5.9 | Type-safe development |
| **Expo Router** | 6.0 | File-based navigation |
| **React Navigation** | 7.x | Navigation management |

### Backend & Database
| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service (BaaS) |
| PostgreSQL | Relational database |
| Supabase Auth | User authentication |
| Supabase Realtime | Live subscriptions |
| Supabase Storage | Image storage |
| Row Level Security | Data access control |

### Key Libraries
| Library | Purpose |
|---------|---------|
| `react-native-maps` | Interactive maps |
| `expo-location` | GPS & location services |
| `expo-notifications` | Push notifications |
| `expo-image-picker` | Image selection |
| `expo-background-fetch` | Background tasks |
| `expo-task-manager` | Task scheduling |
| `@react-native-async-storage/async-storage` | Local storage |
| `react-native-reanimated` | Animations |

---

## 📁 Project Structure

```
Uni_Mate/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation screens
│   │   ├── index.tsx             # Home feed
│   │   ├── events.tsx            # Events list
│   │   ├── lost-found.tsx        # Lost & Found
│   │   ├── wishlist.tsx          # User's wishlist
│   │   └── profile.tsx           # User profile
│   ├── chat/
│   │   └── [otherUserId].tsx     # Chat screen
│   ├── event/
│   │   └── [id].tsx              # Event details
│   ├── lost-found/
│   │   └── [id].tsx              # Lost item details
│   ├── chats.tsx                 # Chat list
│   ├── map.tsx                   # Campus map
│   ├── notifications.tsx         # Notifications
│   └── edit-profile.tsx          # Edit profile
├── components/                   # Reusable components
│   ├── add-event-modal.tsx       # Create event modal
│   ├── edit-event-modal.tsx      # Edit event modal
│   ├── lost-found-modal.tsx      # Lost & found modal
│   ├── event-card.tsx            # Event card component
│   ├── lost-found-item-card.tsx  # Lost item card
│   ├── map-location-picker.tsx   # Map location selector
│   ├── AuthProvider.tsx          # Auth context
│   └── ...
├── services/                     # API & business logic
│   ├── supabase.ts               # Supabase client
│   ├── auth.ts                   # Authentication
│   ├── events.ts                 # Events CRUD
│   ├── lostFound.ts              # Lost & Found CRUD
│   ├── chat.ts                   # Chat service
│   ├── notifications.ts          # Notifications
│   ├── selectiveWishlist.ts      # Wishlist service
│   ├── backgroundTaskService.ts  # Background tasks
│   ├── immediateNotifier.ts      # Location notifications
│   └── ...
├── contexts/                     # React contexts
│   └── UserContext.tsx           # User state
├── hooks/                        # Custom hooks
│   ├── useEventScheduler.ts      # Event scheduling
│   └── ...
├── constants/                    # App constants
│   ├── campus.ts                 # Campus coordinates
│   └── theme.ts                  # Theme colors
├── utils/                        # Utility functions
│   ├── distance.ts               # Haversine distance
│   └── maps.ts                   # Map utilities
├── supabase/
│   └── migrations/               # Database migrations
└── assets/                       # Images & assets
```

---

## 🗄️ Database Schema

### Tables

#### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | User ID (from auth) |
| full_name | text | Display name |
| avatar_url | text | Profile image |
| email | text | User email |
| expo_push_token | text | Push notification token |

#### `events`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Event title |
| description | text | Event description |
| category | text | Event category |
| organizer | text | Organizer name |
| start_at | timestamptz | Start time |
| end_at | timestamptz | End time |
| location | text | Location string |
| latitude | float | GPS latitude |
| longitude | float | GPS longitude |
| location_name | text | Readable location |
| image_url | text | Event image |
| created_by | uuid | Creator's user ID |

#### `lost_found`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Item name |
| description | text | Item description |
| kind | text | 'lost' or 'found' |
| location | text | Location found/lost |
| contact | text | Contact information |
| image_url | text | Item image |
| resolved | boolean | Is resolved |
| created_by | uuid | Reporter's user ID |

#### `conversations`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| participant1 | uuid | First user |
| participant2 | uuid | Second user |

#### `messages`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| conversation_id | uuid | Conversation ref |
| sender_id | uuid | Sender's user ID |
| content | text | Message content |
| sent_at | timestamptz | Timestamp |
| is_read | boolean | Read status |

#### `wishlist`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| profile_id | uuid | User reference |
| item_type | text | 'event' or 'lost_found' |
| item_id | text | Reference ID |
| item_name | text | Cached name |
| added_at | timestamptz | Timestamp |

#### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| recipient_id | uuid | User reference |
| title | text | Notification title |
| message | text | Notification body |
| type | text | Notification type |
| read | boolean | Read status |
| data | jsonb | Extra data |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Supabase Account** with project created

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/UniMate.git
   cd UniMate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/` folder
   - Enable Row Level Security on all tables
   - Configure authentication providers

5. **Configure Google Maps API**
   
   Update `app.json` with your Google Maps API keys:
   ```json
   {
     "expo": {
       "ios": {
         "config": {
           "googleMapsApiKey": "YOUR_IOS_API_KEY"
         }
       },
       "android": {
         "config": {
           "googleMaps": {
             "apiKey": "YOUR_ANDROID_API_KEY"
           }
         }
       }
     }
   }
   ```

### Running the App

#### Development (Expo Go)
```bash
npm start
```

#### Android
```bash
npx expo run:android
```

#### iOS
```bash
npx expo run:ios
```

#### Web
```bash
npm run web
```

### Building for Production

#### Android APK/AAB
```bash
npx expo prebuild --clean
cd android
./gradlew assembleRelease  # APK
./gradlew bundleRelease    # AAB for Play Store
```

#### iOS
```bash
npx expo prebuild --clean
cd ios
xcodebuild -workspace UniMate.xcworkspace -scheme UniMate archive
```

---

## 🔧 Configuration

### Campus Coordinates
Update `constants/campus.ts` with your university location:

```typescript
export const CAMPUS_COORDINATES = {
  latitude: YOUR_LATITUDE,
  longitude: YOUR_LONGITUDE,
};

export const DEFAULT_LOCATION_NAME = "Your University Name";
export const NOTIFICATION_RADIUS_KM = 2; // Notification radius
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 60; // Reminder time
```

### Theme Colors
Customize theme in `constants/theme.ts`:

```typescript
export const Colors = {
  light: {
    primary: '#007AFF',
    background: '#FFFFFF',
    // ...
  },
  dark: {
    primary: '#0A84FF',
    background: '#000000',
    // ...
  },
};
```

---

## 📱 Key Mobile Challenges Addressed

| Challenge | Solution |
|-----------|----------|
| **Cross-Platform Storage** | Platform-specific Supabase initialization (AsyncStorage for native, localStorage for web) |
| **Background Notifications** | Expo Background Fetch + Task Manager for periodic event checking |
| **Real-time Updates** | Supabase Realtime subscriptions for live chat and notifications |
| **Location Services** | Haversine formula for distance calculations, proximity-based reminders |
| **Permission Handling** | Sequential permission requests with graceful degradation |
| **Session Persistence** | Auto-refresh tokens with secure storage |
| **Duplicate Prevention** | Tracked notified events with timestamps in local storage |
| **Battery Optimization** | Location checked only when needed, not continuous |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Expo](https://expo.dev/) - Development platform
- [Supabase](https://supabase.com/) - Backend infrastructure
- [React Native](https://reactnative.dev/) - Mobile framework
- [React Navigation](https://reactnavigation.org/) - Navigation library

---

<p align="center">
  Made with ❤️ for university students everywhere
</p>
