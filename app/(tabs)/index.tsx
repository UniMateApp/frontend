import { EventCard } from '@/components/event-card';
import LostFoundItemCard from '@/components/lost-found-item-card';
import { SearchBar } from '@/components/search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listEvents as apiListEvents } from '@/services/events';
import { resolveLostFoundItem } from '@/services/lostFound';
import {
    Event,
    MappedLostFoundItem,
    addEventToWishlist,
    addLostFoundToWishlist,
    getEventsWithWishlistStatus,
    getLostFoundWithWishlistStatus,
    removeItemFromWishlist,
} from '@/services/selectiveWishlist';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Unified item type for both events and lost-found items
type UnifiedItem = 
  | (Event & { isInWishlist: boolean; itemType: 'event' })
  | (MappedLostFoundItem & { isInWishlist: boolean; itemType: 'lost_found' });

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [allItems, setAllItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = ['All', 'Events', 'Lost & Found'];
  const hasFocusedOnce = useRef(false);

  /** Filter items by search + type and exclude resolved lost-found items */
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allItems;

    // Filter by item type (Events, Lost & Found, or All)
    if (activeFilter === 'Events') {
      list = list.filter(item => item.itemType === 'event');
    } else if (activeFilter === 'Lost & Found') {
      list = list.filter(item => item.itemType === 'lost_found');
    }

    // Exclude resolved lost-found items so only unresolved are visible
    list = list.filter(item => !(item.itemType === 'lost_found' && (item as any).is_resolved));

    // Filter by search query
    if (!q) return list;
    return list.filter(item => {
      if (item.itemType === 'event') {
        const event = item as Event & { isInWishlist: boolean; itemType: 'event' };
        return (event.title + ' ' + (event.organizer || '') + ' ' + (event.location || '')).toLowerCase().includes(q);
      } else {
        const lostFound = item as MappedLostFoundItem & { isInWishlist: boolean; itemType: 'lost_found' };
        return (lostFound.item_name + ' ' + (lostFound.description || '') + ' ' + (lostFound.location || '')).toLowerCase().includes(q);
      }
    });
  }, [query, activeFilter, allItems]);

  const handleSearch = (text: string) => setQuery(text);

  /** Mark a lost-found item as resolved (acts like delete/resolve) */
  const handleMarkResolved = async (itemId: string) => {
    try {
      await resolveLostFoundItem(String(itemId));
      setAllItems(prev => prev.map(i => i.id === itemId && i.itemType === 'lost_found' ? { ...i, is_resolved: true } : i));
    } catch (err: any) {
      console.error('Failed to mark resolved', err);
      Alert.alert('Error', err?.message || 'Could not mark item resolved');
    }
  };

  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/event/[id]', params: { id: eventId } });
  };

  /** Navigate to lost-found item details */
  const handleLostFoundPress = (itemId: string) => {
    router.push({ pathname: '/lost-found/[id]', params: { id: itemId } });
  };

  const handleWishlistToggle = async (itemId: string, itemType: 'event' | 'lost_found', isCurrentlyInWishlist: boolean) => {
    try {
      if (isCurrentlyInWishlist) {
        await removeItemFromWishlist(itemType, itemId);
      } else {
        if (itemType === 'event') {
          await addEventToWishlist(itemId);
        } else {
          await addLostFoundToWishlist(itemId);
        }
      }
      
      // Update local state immediately
      setAllItems(prev => 
        prev.map(item => 
          item.id === itemId && item.itemType === itemType
            ? { ...item, isInWishlist: !isCurrentlyInWishlist }
            : item
        )
      );
    } catch (error: any) {
      console.error('Error toggling wishlist:', error);
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      if (isWeb) {
        window.alert(error.message || 'Failed to update wishlist');
      } else {
        Alert.alert('Error', error.message || 'Failed to update wishlist');
      }
    }
  };

  /** Fetch both events and lost-found items with wishlist status */
  const loadAllItems = useCallback(
    async ({ showLoader = false, shouldUpdate }: { showLoader?: boolean; shouldUpdate?: () => boolean } = {}) => {
      if (showLoader) {
        setLoading(true);
        setError(null);
      }

      try {
        // Fetch both events and lost-found items in parallel
        const [eventsWithWishlist, lostFoundWithWishlist] = await Promise.all([
          getEventsWithWishlistStatus(),
          getLostFoundWithWishlistStatus()
        ]);

        if (!shouldUpdate || shouldUpdate()) {
          // Combine both arrays with itemType identifier
          const combinedItems: UnifiedItem[] = [
            ...eventsWithWishlist.map(event => ({ ...event, itemType: 'event' as const })),
            ...lostFoundWithWishlist.map(lostFound => ({ ...lostFound, itemType: 'lost_found' as const }))
          ];
          
          setAllItems(combinedItems);
        }
      } catch (err: any) {
        if (!shouldUpdate || shouldUpdate()) {
          if (showLoader) {
            console.error('Failed to load items with wishlist status', err);
            setError(err?.message || String(err));
            // Fallback to basic events only
            try {
              const basicEvents = await apiListEvents();
              if (Array.isArray(basicEvents)) {
                const eventsWithDefault = basicEvents.map(event => ({ 
                  ...event, 
                  isInWishlist: false, 
                  itemType: 'event' as const 
                }));
                setAllItems(eventsWithDefault);
              }
            } catch (fallbackErr) {
              console.error('Fallback also failed', fallbackErr);
              setAllItems([]);
            }
          } else {
            console.warn('Reload failed', err);
          }
        }
      } finally {
        if (showLoader && (!shouldUpdate || shouldUpdate())) {
          setLoading(false);
        }
      }
    },
    []
  );

  /** Initial fetch */
  useEffect(() => {
    let active = true;
    loadAllItems({ showLoader: true, shouldUpdate: () => active });
    return () => {
      active = false;
    };
  }, [loadAllItems]);

  /** Refresh on refocus */
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      void loadAllItems();
    }, [loadAllItems])
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.headerSection}>
        <SearchBar onSearch={handleSearch} />

        <View style={styles.chipsRow}>
          {filterOptions.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.chip,
                activeFilter === filter
                  ? { borderColor: colors.primary, backgroundColor: colors.card }
                  : { borderColor: colors.cardBorder },
              ]}
              onPress={() => setActiveFilter(filter)}>
              <Text
                style={[
                  styles.chipText,
                  { color: activeFilter === filter ? colors.primary : colors.text },
                ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {activeFilter === 'All' ? 'Recent Activity' : activeFilter}
      </Text>

      {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />}

      {error && (
        <Text style={{ color: 'red', marginHorizontal: 16, marginBottom: 12 }}>
          {error}
        </Text>
      )}

      {filteredItems.map((item) => {
        if (item.itemType === 'event') {
          const event = item as Event & { isInWishlist: boolean; itemType: 'event' };
          return (
            <EventCard
              key={`event-${event.id}`}
              title={event.title}
              category={event.category}
              organizer={event.organizer || 'Unknown Organizer'}
              date={event.start_at ? new Date(event.start_at).toLocaleDateString() : 'Date TBD'}
              location={event.location || 'Location TBD'}
              locationName={event.location_name}
              latitude={event.latitude}
              longitude={event.longitude}
              price={event.price !== null ? (event.price === 0 ? 'Free' : `LKR ${event.price.toFixed(2)}`) : undefined}
              imageUrl={event.image_url || require('../../assets/images/icon.png')}
              createdBy={event.created_by}
              onPress={() => handleEventPress(event.id)}
              onBookmark={() => handleWishlistToggle(event.id, 'event', event.isInWishlist)}
              isBookmarked={event.isInWishlist}
              onShare={() => {
                Alert.alert('Share', `Share "${event.title}" - Feature coming soon!`);
              }}
              onEdit={() => {
                Alert.alert('Edit Event', 'Edit functionality coming soon');
              }}
              onDelete={() => {
                Alert.alert('Delete Event', `Delete "${event.title}" - Navigate to event details to delete`);
              }}
            />
          );
        } else {
          const lostFound = item as MappedLostFoundItem & { isInWishlist: boolean; itemType: 'lost_found' };
          return (
            <LostFoundItemCard
              key={`lostfound-${lostFound.id}`}
              item={{
                id: lostFound.id,
                item_name: lostFound.item_name,
                description: lostFound.description,
                type: lostFound.type,
                location: lostFound.location,
                contact_info: lostFound.contact_info,
                image_url: lostFound.image_url,
                created_by: lostFound.created_by,
                created_at: lostFound.created_at,
                updated_at: lostFound.updated_at,
                is_resolved: lostFound.is_resolved,
              }}
              isInWishlist={lostFound.isInWishlist}
              onPress={() => handleLostFoundPress(lostFound.id)}
              onWishlistToggle={(id, current) => handleWishlistToggle(String(id), 'lost_found', Boolean(current))}
              onResolve={(id) => handleMarkResolved(String(id))}
            />
          );
        }
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingVertical: 16, paddingBottom: 90 },
  headerSection: { paddingHorizontal: 16 },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
