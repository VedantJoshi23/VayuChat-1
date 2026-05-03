export const Colors = {
  // Primary - Fresh Air / Sky
  primary: '#00AEEF',        // Bright sky blue (clean air)
  primaryLight: '#33C3FF',  
  primaryDark: '#007EA7',

  // Secondary - Nature / Oxygen
  secondary: '#00C853',      // Vibrant green (good AQI)
  secondaryLight: '#5EFC82',
  secondaryDark: '#009624',

  // Accent - Energy / Visibility
  accent: '#FFD60A',         // Bright yellow (moderate AQI highlight)

  // AQI Scale (core differentiation)
  aqiGood: '#00E400',        // Green
  aqiModerate: '#FFFF00',    // Yellow
  aqiUnhealthySensitive: '#FF7E00', // Orange
  aqiUnhealthy: '#FF0000',   // Red
  aqiVeryUnhealthy: '#8F3F97', // Purple
  aqiHazardous: '#7E0023',   // Maroon

  // Neutrals (slightly cooler toned)
  white: '#FFFFFF',
  offWhite: '#E8F5E9',       // Subtle green bluish tint
  lightGray: '#E6EEF5',
  gray: '#B0BEC5',
  darkGray: '#546E7A',
  charcoal: '#263238',
  black: '#000000',
  background: '#F4F9FF',

  // Additional air-themed colors
  cyan: '#00E5FF',           // Fresh air indicator
  teal: '#0891b2',           // Air quality theme

  // Semantic (aligned with AQ theme)
  success: '#00C853',        // Matches good AQI
  warning: '#FFB300',        // Strong amber
  error: '#D32F2F',          // Deep red
  info: '#29B6F6',           // Light blue (air flow feel)

  // Atmospheric overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(255, 255, 255, 0.08)',

  // Gradients (more dynamic, less dull)
  gradientFreshAirStart: '#00E5FF',
  gradientFreshAirEnd: '#00C853',

  gradientPollutionStart: '#FF7E00',
  gradientPollutionEnd: '#7E0023',
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
