export const Colors = {
  // Primary - Air-inspired palette
  primary: '#0891b2', // Cyan
  primaryLight: '#06b6d4', // Light cyan
  primaryDark: '#0e7490', // Dark cyan
  secondary: '#14b8a6', // Teal
  accent: '#06d6a0', // Fresh green

  // Neutral
  white: '#ffffff',
  offWhite: '#f8f9fa',
  lightGray: '#f0f1f5',
  gray: '#d0d5dd',
  darkGray: '#667085',
  charcoal: '#1a202c',
  black: '#000000',

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Transparency
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(255, 255, 255, 0.1)',

  // Gradient stops (for future use)
  gradientStart: '#0891b2',
  gradientEnd: '#06b6d4',
};

export const Shadows = {
  small: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};
