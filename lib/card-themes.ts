export interface CardTheme {
  name: string;
  bg: string;
  text: string;
  accent: string;
  sub: string;
  divider: string;
  layout: 'grid' | 'stack' | 'centered' | 'row' | 'ticker' | 'single';
}

export const CARD_THEMES: CardTheme[] = [
  { name: 'Light', bg: '#FFFFFF', text: '#000000', accent: '#000000', sub: 'rgba(0,0,0,0.4)', divider: '#000000', layout: 'grid' },
  { name: 'Dark', bg: '#000000', text: '#FFFFFF', accent: '#FFFFFF', sub: 'rgba(255,255,255,0.4)', divider: '#FFFFFF', layout: 'stack' },
  { name: 'Feminine', bg: '#F9E4E4', text: '#4A2C2C', accent: '#C47B7B', sub: 'rgba(74,44,44,0.4)', divider: '#C47B7B', layout: 'centered' },
  { name: 'Masculine', bg: '#1C1C1E', text: '#E0E0E0', accent: '#4A90A4', sub: 'rgba(224,224,224,0.35)', divider: '#4A90A4', layout: 'row' },
  { name: 'Modern', bg: '#0A0A0A', text: '#C0C0C0', accent: '#C0C0C0', sub: 'rgba(192,192,192,0.35)', divider: '#C0C0C0', layout: 'ticker' },
  { name: 'Minimal', bg: '#FAFAFA', text: '#999999', accent: '#CCCCCC', sub: 'rgba(153,153,153,0.4)', divider: '#E0E0E0', layout: 'single' },
];

export function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
