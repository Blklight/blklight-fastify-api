const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parse a duration string ("15m", "7d", "30s", "2h") into milliseconds.
 * Single source of truth for JWT expiration strings. Falls back to 7 days
 * when the format is invalid or the unit is unknown.
 * @param duration - Duration string with unit suffix (s, m, h, d)
 * @returns Milliseconds represented by the duration string
 */
export function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    return DEFAULT_DURATION_MS;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] ?? 86400000);
}