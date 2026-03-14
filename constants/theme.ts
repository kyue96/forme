export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F2F2F2',
    border: '#E0E0E0',
    text: '#000000',
    textSecondary: '#8A8A8A',
    chrome: '#888888',
    chromeLight: '#EBEBEB',
    white: '#FFFFFF',
    black: '#000000',
  },
  dark: {
    background: '#0A0A0A',
    surface: '#1A1A1A',
    border: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#8A8A8A',
    chrome: '#888888',
    chromeLight: '#2A2A2A',
    white: '#FFFFFF',
    black: '#000000',
  },
};

export const SemanticColors = {
  success: '#22C55E',
  warning: '#EAB308',
  danger: '#EF4444',
};

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = typeof Colors.dark;
