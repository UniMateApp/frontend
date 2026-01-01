// Import theme colors for light/dark mode support
import { Colors } from '@/constants/theme';
// Import user context to get currently logged-in user
import { useUser } from '@/contexts/UserContext';
// Import hook to detect light/dark mode preference
import { useColorScheme } from '@/hooks/use-color-scheme';
// Import service function to fetch all user profiles from database
import { getAllProfiles } from '@/services/profiles';
// Import FontAwesome icons for search, chevron, user icons
import { FontAwesome } from '@expo/vector-icons';
// Import router for navigation to individual chat screens
import { useRouter } from 'expo-router';
// Import React hooks for state management and lifecycle
import React, { useEffect, useState } from 'react';
// Import React Native UI components
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// Import SafeAreaView to avoid notch/status bar overlap
import { SafeAreaView } from 'react-native-safe-area-context';

// Define Profile type representing a user in the system
// Used for displaying list of users that current user can chat with
type Profile = {
  id: string;          // Unique user ID from Supabase auth
  email?: string;      // User's email address (optional)
  full_name?: string;  // User's display name (optional)
  avatar_url?: string; // Profile picture URL (optional, not used in current UI)
};

// ChatsScreen: Main screen for selecting users to chat with
// Displays searchable list of all users in the system
export default function ChatsScreen() {
  // Get currently logged-in user from context
  const { user } = useUser();
  // Detect current theme (light or dark mode)
  const colorScheme = useColorScheme();
  // Get theme-specific colors based on current mode
  const colors = Colors[colorScheme ?? 'light'];
  // Get router instance for navigation to chat screens
  const router = useRouter();

  // State: All user profiles fetched from database (excluding current user)
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // State: Filtered profiles based on search query (subset of profiles)
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  // State: Current search text entered by user
  const [searchQuery, setSearchQuery] = useState('');
  // State: Loading indicator while fetching profiles from database
  const [loading, setLoading] = useState(true);

  // Effect: Load all user profiles when component mounts
  // Empty dependency array [] means this runs only once on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  // Function: Load all user profiles from database
  // Filters out current user since you can't chat with yourself
  const loadProfiles = async () => {
    try {
      // Show loading spinner while fetching
      setLoading(true);
      // Fetch all profiles from Supabase profiles table
      const data = await getAllProfiles();
      // Filter out current user from the list
      // user?.id is the currently logged-in user's ID from auth context
      const others = data.filter((p: Profile) => p.id !== user?.id);
      // Store all profiles (for resetting search)
      setProfiles(others);
      // Initialize filtered list with all profiles (no search applied yet)
      setFilteredProfiles(others);
    } catch (err) {
      // Log error if database fetch fails
      console.error('Failed to load profiles', err);
    } finally {
      // Hide loading spinner regardless of success/failure
      setLoading(false);
    }
  };

  // Function: Filter users based on search query
  // Searches both email and full_name fields (case-insensitive)
  const handleSearch = (query: string) => {
    // Update search query state to display in TextInput
    setSearchQuery(query);
    // If query is empty or only whitespace, show all users
    if (!query.trim()) {
      setFilteredProfiles(profiles);
      return;
    }
    // Convert search query to lowercase for case-insensitive matching
    const lowerQuery = query.toLowerCase();
    // Filter profiles array to find matches
    const filtered = profiles.filter((p) => {
      // Get lowercase email (or empty string if undefined)
      const email = p.email?.toLowerCase() || '';
      // Get lowercase full name (or empty string if undefined)
      const name = p.full_name?.toLowerCase() || '';
      // Return true if query is found in either email or name
      // includes() checks if substring exists anywhere in the string
      return email.includes(lowerQuery) || name.includes(lowerQuery);
    });
    // Update filtered list to show only matching users
    setFilteredProfiles(filtered);
  };

  // Function: Navigate to individual chat screen with selected user
  // Takes the selected user's ID and navigates to dynamic route /chat/[otherUserId]
  const handleSelectUser = (otherUserId: string) => {
    // Push to chat screen using dynamic route parameter
    // Route will be handled by app/chat/[otherUserId].tsx
    router.push({ pathname: `/chat/${otherUserId}` as any });
  };

  // Render: Main UI with header, search bar, and user list
  return (
    // SafeAreaView prevents content from going under notch/status bar
    // edges={['bottom']} applies safe area only to bottom (top handled by stack navigator)
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header section with title and subtitle */}
      <View style={styles.header}>
        {/* Main title "Chats" */}
        <Text style={[styles.title, { color: colors.text }]}>Chats</Text>
        {/* Subtitle with instructions */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select a user to start chatting
        </Text>
      </View>

      {/* Search bar with icon, input field, and clear button */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Search icon on the left */}
        <FontAwesome name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
        {/* Text input field for search query */}
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name or email..."  // Hint text when empty
          placeholderTextColor={colors.textSecondary}  // Gray color for placeholder
          value={searchQuery}  // Controlled input bound to state
          onChangeText={handleSearch}  // Call handleSearch on every keystroke
        />
        {/* Clear button (X icon) - only shown when there's text */}
        {searchQuery ? (
          <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearButton}>
            <FontAwesome name="times-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Conditional rendering: Show spinner while loading, list when ready */}
      {loading ? (
        // Show loading spinner while fetching profiles from database
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        // FlatList: Efficient scrollable list for rendering user profiles
        <FlatList
          data={filteredProfiles}  // Data source (filtered based on search)
          keyExtractor={(item) => item.id}  // Unique key for each item (user ID)
          contentContainerStyle={styles.list}  // Padding around list items
          // Empty state component shown when filteredProfiles is empty
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              {/* Users icon for empty state */}
              <FontAwesome name="users" size={48} color={colors.textSecondary} />
              {/* Message explaining why list is empty */}
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {/* Different message based on whether search is active */}
                {searchQuery ? 'No users found' : 'No users available'}
              </Text>
            </View>
          )}
          // renderItem: How to render each user profile in the list
          renderItem={({ item }) => (
            // Touchable card that navigates to chat when pressed
            <TouchableOpacity
              style={[styles.userItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => handleSelectUser(item.id)}  // Navigate to chat on tap
            >
              {/* Avatar circle with first letter of email/name */}
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {/* Get first character from email or name, fallback to '?' */}
                  {/* [0] gets first character, .toUpperCase() makes it capital */}
                  {(item.email?.[0] || item.full_name?.[0] || '?').toUpperCase()}
                </Text>
              </View>
              {/* User information (email and optional full name) */}
              <View style={styles.userInfo}>
                {/* Primary text: email address (or 'Unknown User' if missing) */}
                <Text style={[styles.userName, { color: colors.text }]}>
                  {item.email || 'Unknown User'}
                </Text>
                {/* Secondary text: full name (only shown if available) */}
                {item.full_name ? (
                  <Text style={[styles.userFullName, { color: colors.textSecondary }]}>
                    {item.full_name}
                  </Text>
                ) : null}
              </View>
              {/* Chevron right icon indicating tappable/navigable item */}
              <FontAwesome name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userFullName: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
