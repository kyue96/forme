/**
 * Format seconds into MM:SS format.
 * Used globally across the app for all time displays.
 */
export function formatTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format milliseconds into MM:SS or HH:MM:SS (when ≥ 1 hour).
 */
export function formatTimeMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a number with commas for 4+ digit numbers.
 * e.g. 1250 → "1,250", 950 → "950"
 */
export function formatNumber(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(Math.round(n));
}

/** Strip parenthetical text from workout names, e.g. "Pull Day (Back, Biceps)" → "Pull Day" */
export function stripParens(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/\s*\(.*?\)\s*/g, '').trim();
}

/**
 * Shared smooth layout animation config (400ms easeInEaseOut).
 * Use before any state change that affects layout.
 */
export function animateLayout() {
  const { LayoutAnimation } = require('react-native');
  LayoutAnimation.configureNext({
    duration: 250,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: 200 },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: 150 },
  });
}

/**
 * Slower layout animation for expand/collapse transitions (500ms).
 */
export function animateLayoutSlow() {
  const { LayoutAnimation } = require('react-native');
  LayoutAnimation.configureNext({
    duration: 500,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: 400 },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity, duration: 300 },
  });
}
