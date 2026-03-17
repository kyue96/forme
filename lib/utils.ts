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
 * Format milliseconds into MM:SS format.
 */
export function formatTimeMs(ms: number): string {
  return formatTime(Math.floor(ms / 1000));
}

/**
 * Format a number with commas for 4+ digit numbers.
 * e.g. 1250 → "1,250", 950 → "950"
 */
export function formatNumber(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(Math.round(n));
}

/**
 * Shared smooth layout animation config (400ms easeInEaseOut).
 * Use before any state change that affects layout.
 */
export function animateLayout() {
  const { LayoutAnimation } = require('react-native');
  LayoutAnimation.configureNext({
    duration: 400,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
