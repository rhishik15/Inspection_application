import { Platform } from 'react-native';

export const Colors = {
  primary: '#3b82f6', // Open Blue from Web
  secondary: '#0f172a', // Slate from Web
  success: '#10b981', // Emerald from Web
  warning: '#f59e0b', // Amber from Web
  danger: '#ef4444', // Red from Web
  background: '#f8fafc', // Light slate background
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  white: '#ffffff',
  lightGray: '#f1f5f9',
  muted: '#94a3b8',

  // Specific priority colors from web
  priority: {
    URGENT: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
    HIGH: { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
    MEDIUM: { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
    LOW: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' }
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  round: 9999,
};

export const Shadow = {
  light: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};
