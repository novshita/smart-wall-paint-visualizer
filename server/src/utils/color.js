/** Converts "#RRGGBB" to { r, g, b }; returns undefined for anything else. */
function hexToRgb(hex) {
  if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return undefined;
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

module.exports = { hexToRgb };
