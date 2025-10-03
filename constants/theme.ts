/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const primaryColor = '#800000'; // Deep maroon
const secondaryColor = '#1a237e'; // Royal blue
const accentColor = '#ff6b6b'; // Vibrant accent for CTAs

export const Colors = {
  light: {
    primary: primaryColor,
    secondary: secondaryColor,
    accent: accentColor,
    text: '#11181C',
    textSecondary: '#687076',
    background: '#fff',
    card: '#ffffff',
    cardBorder: '#E5E7EB',
    tint: primaryColor,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryColor,
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    primary: '#a32929', // Lighter maroon for dark mode
    secondary: '#3949ab', // Lighter royal blue for dark mode
    accent: '#ff8a8a', // Lighter accent for dark mode
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    background: '#151718',
    card: '#1E2122',
    cardBorder: '#2A2F30',
    tint: '#a32929',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#a32929',
    shadow: 'rgba(0, 0, 0, 0.2)',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
