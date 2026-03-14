export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F2F2F2',
    border: '#DCDCDC',
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
    border: '#3A3A3A',
    text: '#FFFFFF',
    textSecondary: '#8A8A8A',
    chrome: '#C0C0C0',
    chromeLight: '#E8E8E8',
    white: '#FFFFFF',
    black: '#000000',
  },
};

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = typeof Colors.dark;
