/** WCAG relative luminance of a #RRGGBB colour (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Picks black or white text, whichever contrasts more with the background. */
export function readableTextColor(hex: string): '#1d2427' | '#ffffff' {
  // 0.179 is the luminance where contrast against black and white is equal
  return relativeLuminance(hex) > 0.179 ? '#1d2427' : '#ffffff';
}

export function formatRgb({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r}, ${g}, ${b})`;
}
