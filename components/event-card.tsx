import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EventCardProps {
  id?: string;
  title: string;
  category?: string;
  organizer: string;
  date: string;
  time?: string;
  location: string;
  description?: string;
  attendees?: { registered: number; capacity?: number };
  registrationDeadline?: string;
  price?: string;
  /** Accept either a remote uri string or a local require(...) resource */
  imageUrl?: ImageSourcePropType | string | number;
  onPress: () => void;
  onBookmark: () => void;
  onRsvp?: () => void;
  onShare?: () => void;
  onLongPress?: () => void;
  isBookmarked?: boolean;
}

export function EventCard({
  id,
  title,
  category,
  organizer,
  date,
  time,
  location,
  description,
  attendees,
  registrationDeadline,
  price,
  imageUrl,
  onPress,
  onBookmark,
  onRsvp,
  onShare,
  onLongPress,
  isBookmarked,
}: EventCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const resolveImageSource = (): ImageSourcePropType | undefined => {
    if (!imageUrl) return undefined;

    if (typeof imageUrl === 'number') return imageUrl as number;
    if (typeof imageUrl === 'object') return imageUrl as ImageSourcePropType;

    const src = String(imageUrl);
    return { uri: src };
  };

  const source = resolveImageSource();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} onLongPress={onLongPress}>
        {source && (
          <View>
            <Image source={source} style={styles.image} resizeMode="cover" />
            {category && (
              <View style={[styles.categoryBadge, { backgroundColor: colors.background }]}> 
                <Text style={[styles.categoryText, { color: colors.primary }]}>{category}</Text>
              </View>
            )}
            <TouchableOpacity onPress={onBookmark} style={[styles.bookmarkOverlay, { backgroundColor: colors.card }]} accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
              <FontAwesome name={isBookmarked ? 'bookmark' : 'bookmark-o'} size={16} color={isBookmarked ? colors.primary : colors.icon} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
            {price && (
              <View style={[styles.pricePill, { borderColor: colors.cardBorder }]}>
                <Text style={[styles.priceText, { color: colors.text }]}>{price}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.organizer, { color: colors.textSecondary }]}>{organizer}</Text>

          {description ? <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>{description}</Text> : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <FontAwesome name="calendar" size={12} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{date}{time ? ` • ${time}` : ''}</Text>
            </View>

            <View style={styles.metaItem}>
              <FontAwesome name="map-marker" size={12} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{location}</Text>
            </View>
          </View>

          <View style={styles.metaRowSecondary}>
            {attendees && (
              <Text style={[styles.smallMeta, { color: colors.textSecondary }]}>{attendees.registered}{attendees.capacity ? `/${attendees.capacity}` : ''} registered</Text>
            )}
            {registrationDeadline && (
              <Text style={[styles.smallMeta, { color: colors.textSecondary }]}>{'  '}Registration deadline: {registrationDeadline}</Text>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.rsvpButton, { backgroundColor: colors.primary }]} onPress={onRsvp}>
              <Text style={styles.rsvpText}>RSVP</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={onShare}>
              <FontAwesome name="share" size={16} color={colors.icon} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  image: {
    height: 200,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  bookmarkButton: {
    padding: 4,
  },
  organizer: {
    fontSize: 14,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  footerText: {
    fontSize: 14,
    marginLeft: 4,
  },
  categoryBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookmarkOverlay: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  pricePill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    marginLeft: 6,
    fontSize: 12,
  },
  metaRowSecondary: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallMeta: {
    fontSize: 12,
    marginRight: 12,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  rsvpText: {
    color: '#fff',
    fontWeight: '700',
  },
  shareButton: {
    marginLeft: 12,
    padding: 10,
    borderRadius: 8,
  },
});