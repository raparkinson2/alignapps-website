import { useTeamStore } from './store';

const FALLBACK_COLOR = '#67e8f9';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

/**
 * Ensures a team color is visible against a dark background.
 * If the color is too dark (e.g. black jersey), it lightens it
 * so it remains legible in the dark UI.
 */
function ensureVisibleOnDark(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return FALLBACK_COLOR;

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

  if (luminance < 0.2) {
    // Blend toward white so dark colors stay usable
    const blend = 0.65;
    const r = Math.round(rgb.r + (255 - rgb.r) * blend);
    const g = Math.round(rgb.g + (255 - rgb.g) * blend);
    const b = Math.round(rgb.b + (255 - rgb.b) * blend);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  return hex;
}

/** Converts a hex color to rgba() string */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(103, 232, 249, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Returns the team's primary color, safe for use on dark backgrounds.
 * Prefers a color named "Home" or "Primary", otherwise uses the first jersey color.
 * Falls back to the default cyan if no jersey colors are set.
 */
export function useTeamColor(): string {
  const jerseyColors = useTeamStore((s) => s.teamSettings?.jerseyColors);

  if (!jerseyColors || jerseyColors.length === 0) return FALLBACK_COLOR;

  const primary =
    jerseyColors.find(
      (c) =>
        c.name.toLowerCase().includes('home') ||
        c.name.toLowerCase().includes('primary') ||
        c.name.toLowerCase().includes('main')
    ) ?? jerseyColors[0];

  return ensureVisibleOnDark(primary.color);
}
